(function (root) {
  "use strict";
  const errors = {
    ACCESS_DENIED: "Dein Zugang zu dieser Filiale wurde beendet. Dein lokaler Entwurf bleibt erhalten.",
    READ_ONLY: "Du darfst gerade ansehen und Vorschläge machen. Deine lokalen Änderungen bleiben als Entwurf erhalten.",
    OWNER_REQUIRED: "Diese Aktion ist der Filialverwaltung vorbehalten.",
    REVISION_CONFLICT: "Inzwischen wurde ein neuer Stand gespeichert. Bitte zuerst vergleichen.",
    CHANGE_CONFLICT: "Diese Änderung überschneidet sich mit einer späteren Änderung. Bitte einzeln prüfen.",
    INVITE_INVALID: "Die Einladung ist abgelaufen, widerrufen oder bereits verwendet.",
    EMPTY_CHANGE: "Es gibt keine Änderungen zum Übernehmen.",
    PUBLISH_DENIED: "Du darfst diesen Wochenstand nicht freigeben.",
    INVALID_PLAN: "Der Plan ist unvollständig. Bitte zuerst die lokale Sicherung prüfen."
  };
  function explain(error) {
    return Object.entries(errors).find(([code]) => error?.message?.includes(code))?.[1]
      || "Die Filialverbindung ist gerade nicht verfügbar. Deine Änderungen bleiben auf diesem Gerät.";
  }
  function create(options) {
    const state = { user: null, branches: [], branch: null, selected: null, mode: "signed-out", message: "Bitte zuerst anmelden.", busy: false };
    let epoch = 0, timer = null, linked = false, disposed = false;
    const fingerprint = root.WochenplanCloud.fingerprint;
    const prefix = () => `wochenplan_shared_v1:${options.projectRef}:${state.user.id}`;
    const notify = () => options.onChange?.({ ...state });
    const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
    function setMode(mode, message) { state.mode = mode; state.message = message; notify(); }
    function metadata() { try { return JSON.parse(options.storage.getItem(prefix() + ":" + state.selected) || "null"); } catch (_) { return null; } }
    function remember(revision, signature) { options.storage.setItem(prefix() + ":" + state.selected, JSON.stringify({ revision, signature })); linked = true; }
    async function call(action, args = {}) {
      const { data, error } = await options.client.rpc("wochenplan_collaboration", { p_action: action, p_args: { branch_id: state.selected, ...args } });
      if (error) { const e = new Error(explain(error)); e.code = error.code; e.serverMessage = error.message; throw e; }
      return data;
    }
    async function inspect(remote, thisEpoch) {
      let signature = null;
      try { signature = await fingerprint(options.getSnapshot()); } catch (_) { /* local recovery remains available */ }
      const remoteSignature = await fingerprint(remote.payload);
      if (epoch !== thisEpoch) return;
      state.branch = remote;
      const previous = metadata();
      if (signature === remoteSignature) {
        remember(remote.revision, signature);
        setMode("synced", remote.can_edit ? "Gemeinsamer Plan ist aktuell. Änderungen werden online gesichert." : "Du darfst ansehen und Vorschläge vorbereiten.");
      } else if (signature && previous?.revision === remote.revision && previous.signature === remoteSignature) {
        linked = true;
        setMode("draft", remote.can_edit ? "Lokale Änderungen warten auf die Online-Sicherung." : "Lokaler Vorschlag: noch nicht im gemeinsamen Plan.");
      } else {
        linked = false;
        setMode("compare", "Gerät und Filialplan unterscheiden sich. Sichere deinen Entwurf und wähle den gewünschten Stand.");
      }
    }
    async function refresh() {
      if (!state.user || state.busy || disposed) return;
      const thisEpoch = epoch;
      state.busy = true; cancel(); notify();
      try {
        const branches = await call("list");
        if (epoch !== thisEpoch) return;
        state.branches = branches;
        if (state.selected) await inspect(await call("read"), thisEpoch);
        else setMode("personal", "Du kannst eine Filiale anlegen oder einer Einladung folgen.");
      } catch (error) {
        if (epoch === thisEpoch) { linked = false; setMode("offline", error.message); }
      } finally { if (epoch === thisEpoch) { state.busy = false; notify(); } }
    }
    async function setUser(user) {
      if (state.user?.id === user?.id || disposed) return;
      epoch++; cancel(); linked = false;
      state.user = user; state.branch = null; state.branches = []; state.busy = false;
      state.selected = user ? options.storage.getItem(prefix() + ":selected") : null;
      notify();
      if (user) await refresh(); else setMode("signed-out", "Bitte zuerst anmelden.");
    }
    async function select(id) {
      epoch++; cancel(); linked = false; state.busy = false; state.branch = null;
      state.selected = id || null;
      options.onContextChange?.();
      if (id) options.storage.setItem(prefix() + ":selected", id); else options.storage.removeItem(prefix() + ":selected");
      await refresh();
    }
    async function exclusive(work) {
      if (!state.user || state.busy) throw new Error("Bitte warten, bis der Abgleich abgeschlossen ist.");
      const thisEpoch = epoch;
      state.busy = true; cancel(); notify();
      try { return await work(thisEpoch); }
      catch (error) { if (epoch === thisEpoch) { linked = false; setMode("attention", error.message); } throw error; }
      finally { if (epoch === thisEpoch) { state.busy = false; notify(); } }
    }
    async function establish(action, args) {
      const id = await exclusive(async () => (await call(action, args)).id);
      await select(id);
      return id;
    }
    async function save(reason = "", explicit = false, preview = null) {
      return exclusive(async (thisEpoch) => {
        if (!state.branch || (!linked && !(explicit && preview))) throw new Error("Bitte zuerst den Filialplan vergleichen und die Übernahme bestätigen.");
        const payload = options.getSnapshot();
        const signature = await fingerprint(payload);
        if (preview && preview.signature !== signature) throw new Error("Dein Entwurf hat sich seit der Vorschau geändert. Bitte erneut vergleichen.");
        const result = await call("save", { payload, reason, expected_revision: preview?.revision ?? state.branch.revision });
        if (epoch !== thisEpoch) return;
        remember(result.revision, signature);
        await inspect(await call("read"), thisEpoch);
      });
    }
    function scheduleSave() {
      cancel();
      if (!state.selected || !state.branch || !state.user) return;
      setMode("draft", state.branch.can_edit ? "Lokale Änderungen: Online-Sicherung folgt …" : "Lokaler Vorschlag: noch nicht im gemeinsamen Plan.");
      if (!linked || !state.branch.can_edit) return;
      timer = setTimeout(() => { timer = null; if (!state.busy) void save().then(() => { if (state.mode === "draft") scheduleSave(); }).catch(() => {}); }, options.delayMs ?? 1500);
    }
    async function adopt() {
      return exclusive(async (thisEpoch) => {
        const remote = await call("read");
        if (epoch !== thisEpoch) return;
        options.applySnapshot(remote.payload);
        try { remember(remote.revision, await fingerprint(remote.payload)); }
        finally { options.reload?.(); }
      });
    }
    async function perform(action, args = {}) {
      const result = await exclusive(() => call(action, { expected_revision: state.branch?.revision, ...args }));
      await refresh(); return result;
    }
    async function history(args = {}) { return exclusive(() => call("history", args)); }
    async function compare() {
      return exclusive(async () => {
        const payload = options.getSnapshot();
        return { ...await call("compare", { payload }), signature: await fingerprint(payload) };
      });
    }
    async function archive() {
      return exclusive(async () => {
        const branch = await call("read");
        let events = [], before_id;
        do {
          const page = await call("history", { before_id }); events.push(...page);
          if (page.length < 100) break;
          before_id = page[page.length - 1].id;
        } while (events.length < 100000);
        if (events.length >= 100000) throw new Error("Der Verlauf ist zu groß für einen einzelnen Export.");
        return { ...branch.payload, createdAt: new Date().toISOString(),
          sharedArchive: { format: "wochenplan-filialarchiv-v1", branch: { ...branch, payload: undefined }, events } };
      });
    }
    return { setUser, select, refresh, save, scheduleSave, adopt, perform, history, compare, archive,
      create: (name, display_name) => establish("create", { name, display_name, payload: options.getSnapshot() }),
      join: (token, display_name) => establish("accept_invite", { token, display_name }),
      propose: (reason) => perform("propose", { payload: options.getSnapshot(), reason }),
      dispose() { disposed = true; epoch++; cancel(); },
      get status() { return { ...state }; }, get active() { return Boolean(state.selected); }
    };
  }
  root.WochenplanCollaboration = Object.freeze({ create, explain });
})(typeof window === "undefined" ? globalThis : window);
