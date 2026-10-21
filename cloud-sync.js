(function (root) {
  "use strict";
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    return value;
  }

  async function fingerprint(snapshot) {
    const master = snapshot.storage.wochenplan_master_v10;
    const { weekFrom, weekTo, ...plan } = snapshot.storage.wochenplan_plan_v10;
    const bytes = new TextEncoder().encode(JSON.stringify(canonical({ master, plan })));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function create(options) {
    const client = options.client;
    const status = { user: null, mode: "signed-out", message: "Nur auf diesem Gerät gespeichert", remote: null, busy: false, recovering: false };
    let linked = false;
    let timer = null;
    let epoch = 0;
    let saveAgain = false;
    let subscription = null;
    const notify = () => options.onChange?.({ ...status });
    const key = () => `wochenplan_cloud_link_v1:${options.projectRef}:${status.user.id}`;
    const snapshot = () => JSON.parse(JSON.stringify(options.getSnapshot()));
    const link = () => {
      try { return JSON.parse(options.storage.getItem(key()) || "null"); } catch (_) { return null; }
    };
    function remember(record, signature) {
      options.storage.setItem(key(), JSON.stringify({ revision: record.revision, signature }));
      status.remote = record;
      linked = true;
    }
    function message(mode, text) { status.mode = mode; status.message = text; notify(); }
    function cancel() { if (timer) clearTimeout(timer); timer = null; }

    async function readRemote() {
      const { data, error } = await client.from("wochenplan_documents")
        .select("revision,payload,updated_at").eq("user_id", status.user.id).maybeSingle();
      if (error) throw error;
      return data;
    }

    async function refresh() {
      if (options.isPersonalActive?.() === false) return;
      if (!status.user || status.busy) return;
      const currentEpoch = epoch;
      saveAgain = saveAgain || Boolean(timer);
      cancel();
      status.busy = true;
      notify();
      try {
        const remote = await readRemote();
        if (currentEpoch !== epoch || options.isPersonalActive?.() === false) return;
        status.remote = remote;
        if (!remote) {
          linked = false;
          message("first-upload", "Noch kein Online-Plan. Wähle einmal den Stand, der online gespeichert werden soll.");
          return;
        }
        const remoteSignature = await fingerprint(remote.payload);
        let localSignature = null;
        try { localSignature = await fingerprint(snapshot()); } catch (_) { /* unreadable local data may still be restored */ }
        if (currentEpoch !== epoch || options.isPersonalActive?.() === false) return;
        if (localSignature === remoteSignature) {
          remember(remote, remoteSignature);
          message("synced", "Auf diesem Gerät und online gespeichert");
          return;
        }
        const previous = link();
        if (previous?.revision === remote.revision && previous.signature === remoteSignature && localSignature !== null) {
          linked = true;
          message("pending", "Lokale Änderungen warten auf die Online-Sicherung");
          scheduleSave();
        } else {
          linked = false;
          cancel();
          message("choose", "Gerät und Online-Plan unterscheiden sich. Bitte den gewünschten Stand auswählen.");
        }
      } catch (_) {
        if (currentEpoch === epoch) message("offline", "Online-Sicherung nicht erreichbar. Dein Plan bleibt auf diesem Gerät gespeichert.");
      } finally {
        if (currentEpoch === epoch) {
          status.busy = false;
          notify();
          if (saveAgain && linked) { saveAgain = false; scheduleSave(); }
        }
      }
    }

    async function save({ overwrite = false } = {}) {
      if (options.isPersonalActive?.() === false) return false;
      cancel();
      if (!status.user || (!linked && !overwrite)) return false;
      if (status.busy) { saveAgain = true; return false; }
      const currentEpoch = epoch;
      const userId = status.user.id;
      const remote = status.remote;
      status.busy = true;
      message("saving", "Online-Sicherung wird gespeichert …");
      try {
        const payload = snapshot();
        const signature = await fingerprint(payload);
        if (currentEpoch !== epoch || options.isPersonalActive?.() === false) return false;
        const previous = link();
        if (remote && previous?.revision === remote.revision && previous.signature === signature) {
          message("synced", "Auf diesem Gerät und online gespeichert");
          return true;
        }
        const revision = remote ? remote.revision + 1 : 1;
        const query = remote
          ? client.from("wochenplan_documents").update({ revision, payload }).eq("user_id", userId).eq("revision", remote.revision)
          : client.from("wochenplan_documents").insert({ user_id: userId, revision, payload });
        const { data, error } = await query.select("revision,payload,updated_at").maybeSingle();
        if (currentEpoch !== epoch) return false;
        if (error || !data) {
          // PostgREST can report a zero-row conditional UPDATE as PGRST116
          // when the SDK requests an object response for maybeSingle().
          if (!error || error.code === "23505" || (remote && error.code === "PGRST116")) {
            linked = false;
            message("choose", "Inzwischen wurde ein anderer Online-Stand gespeichert. Bitte zuerst abgleichen.");
          } else {
            message("offline", "Online-Speichern fehlgeschlagen. Der lokale Stand bleibt erhalten; bitte erneut versuchen.");
          }
          return false;
        }
        remember(data, signature);
        const changedDuringSave = signature !== await fingerprint(snapshot());
        message(changedDuringSave ? "pending" : "synced", changedDuringSave
          ? "Weitere Änderungen werden online gespeichert …" : "Auf diesem Gerät und online gespeichert");
        saveAgain = changedDuringSave;
        return true;
      } catch (_) {
        if (currentEpoch === epoch) message("offline", "Online-Speichern fehlgeschlagen. Bitte den lokalen Stand zusätzlich als Datei sichern.");
        return false;
      } finally {
        if (currentEpoch === epoch) {
          status.busy = false;
          notify();
          if (saveAgain && linked) { saveAgain = false; scheduleSave(); }
        }
      }
    }

    function scheduleSave() {
      if (options.isPersonalActive?.() === false) return;
      if (!status.user || !linked) return;
      if (status.busy) { saveAgain = true; return; }
      cancel();
      message("pending", "Auf diesem Gerät gespeichert; Online-Abgleich folgt …");
      timer = setTimeout(() => { timer = null; void save(); }, options.delayMs ?? 1500);
    }

    async function adopt() {
      if (options.isPersonalActive?.() === false) return false;
      if (!status.remote || !status.user || status.busy) return false;
      const record = status.remote;
      const currentEpoch = epoch;
      const signature = await fingerprint(record.payload);
      if (currentEpoch !== epoch || options.isPersonalActive?.() === false) return false;
      cancel();
      // applySnapshot is synchronous and journaled. Only mark this revision
      // linked if writing to the device actually succeeded.
      options.applySnapshot(record.payload);
      try {
        remember(record, signature);
        message("synced", "Online-Stand wurde übernommen");
      } finally {
        // The stored plan has already changed. Never leave the old in-memory
        // editor active if saving the tiny connection metadata hits a quota.
        options.reload?.();
      }
      return true;
    }

    async function setUser(user) {
      if (status.user?.id === user?.id) return;
      epoch += 1;
      cancel();
      linked = false;
      saveAgain = false;
      status.user = user;
      if (!user) status.recovering = false;
      status.remote = null;
      status.busy = false;
      message(user ? "loading" : "signed-out", user ? "Online-Plan wird geprüft …" : "Nur auf diesem Gerät gespeichert");
      if (user) await refresh();
    }

    async function start() {
      const listener = client.auth.onAuthStateChange((event, session) => {
        // Run API requests outside Supabase's synchronous auth callback.
        setTimeout(() => {
          void setUser(session?.user || null).then(() => {
            if (event === "PASSWORD_RECOVERY") {
              status.recovering = true;
              message("password-recovery", "Bitte ein neues Passwort festlegen.");
            }
          });
        }, 0);
      });
      subscription = listener.data.subscription;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await setUser(data.session?.user || null);
    }

    async function signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Anmeldung fehlgeschlagen. Bitte E-Mail, Passwort und die E-Mail-Bestätigung prüfen.");
      await setUser(data.user);
    }

    async function signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: options.redirectUrl } });
      if (error) throw new Error("Konto konnte nicht erstellt werden. Bitte die Eingaben prüfen und später erneut versuchen.");
      if (data.session) await setUser(data.user);
      else message("signed-out", "Bitte die Bestätigungs-E-Mail öffnen. Danach hier mit E-Mail und Passwort anmelden.");
    }

    async function signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw new Error("Abmelden fehlgeschlagen. Bitte erneut versuchen.");
      await setUser(null);
    }

    async function resetPassword(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: options.redirectUrl });
      if (error) throw new Error("Passwort-E-Mail konnte nicht angefordert werden. Bitte später erneut versuchen.");
      message("signed-out", "Falls ein Konto zu dieser Adresse besteht, erhältst du eine E-Mail zum Zurücksetzen des Passworts.");
    }

    async function updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error("Das neue Passwort konnte nicht gespeichert werden.");
      status.recovering = false;
      await refresh();
    }

    async function history() {
      if (!status.user) return [];
      const { data, error } = await client.from("wochenplan_history").select("revision,created_at")
        .eq("user_id", status.user.id).order("revision", { ascending: false }).limit(40);
      if (error) throw new Error("Der Online-Verlauf ist gerade nicht erreichbar.");
      return data || [];
    }

    async function getRevision(revision) {
      if (!status.user) throw new Error("Bitte zuerst anmelden.");
      const { data, error } = await client.from("wochenplan_history").select("payload")
        .eq("user_id", status.user.id).eq("revision", revision).single();
      if (error) throw new Error("Die Sicherung ist gerade nicht erreichbar.");
      return data.payload;
    }

    function resetLink() { epoch += 1; cancel(); linked = false; saveAgain = false; status.busy = false; if (status.user) options.storage.removeItem(key()); }
    function dispose() { epoch += 1; cancel(); subscription?.unsubscribe(); }
    return { start, refresh, save, adopt, scheduleSave, signIn, signUp, signOut, resetPassword, updatePassword, history, getRevision, resetLink, dispose,
      get status() { return { ...status }; } };
  }

  root.WochenplanCloud = Object.freeze({ create, fingerprint });
})(typeof window === "undefined" ? globalThis : window);
