(function () {
  "use strict";
  const element = (id) => document.getElementById(id);
  const dialog = element("dataDialog");
  let cloud = null;
  let shared = null;
  let uiBusy = false;

  function showError(error) {
    element("dataActionMessage").textContent = error?.message || "Die Aktion konnte nicht abgeschlossen werden. Bitte erneut versuchen.";
  }

  function renderLocal() {
    const summary = getBackupSummary(collectFullBackupSnapshot());
    element("dataLocalSummary").textContent = `${summary.employees} Mitarbeitende · ${summary.shifts} Schichten`;
    element("dataLocalDate").textContent = summary.firstDate
      ? `${formatIsoToShortDate(summary.firstDate)} bis ${formatIsoToShortDate(summary.lastDate)}` : "Noch keine Schichten eingetragen";
    element("dataLocalSaved").textContent = lastSavedAt ? `Zuletzt gespeichert: ${formatDateTimeForDisplay(lastSavedAt)}` : "Noch nicht gespeichert";
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    element("dataLocalContext").textContent = standalone ? "Speicher dieser Home-Bildschirm-App" : "Speicher dieses Browsers";
    element("btnRestoreLocal").disabled = !localDataStore.getPrevious();
    element("storageProblem").classList.toggle("hidden", !localDataStore.blocked);
    element("storageProblemText").textContent = localDataStore.error;
  }

  function renderCloud(status) {
    if (shared && shared.status.user?.id !== status.user?.id) {
      window.WochenplanPlanning?.invalidateUndo();
      void shared.setUser(status.user).then(() => {
        if (shared.personalActive) return cloud.refresh();
      }).catch(showError);
    }
    const signedIn = Boolean(status.user);
    element("cloudSignIn").classList.toggle("hidden", signedIn);
    element("cloudSignedIn").classList.toggle("hidden", !signedIn || status.recovering);
    element("cloudRecovery").classList.toggle("hidden", !status.recovering);
    element("cloudAccount").textContent = status.user?.email || "";
    element("cloudMessage").textContent = status.message;
    element("dataStatus").textContent = status.mode === "synced" ? "Online gesichert" : signedIn ? "Online-Stand prüfen" : "Nur auf diesem Gerät";
    element("dataStatus").dataset.mode = status.mode;
    element("btnCloudDownload").disabled = !status.remote || status.busy || uiBusy;
    element("btnCloudUpload").disabled = status.busy || uiBusy || localDataStore.blocked || status.mode === "loading";
    element("btnCloudRefresh").disabled = status.busy || uiBusy;
    element("btnCloudUpload").textContent = ["first-upload", "choose"].includes(status.mode) ? "Diesen Geräte-Stand online verwenden" : "Jetzt online sichern";
    const remoteSummary = status.remote ? getBackupSummary(status.remote.payload) : null;
    element("cloudRemoteSummary").textContent = remoteSummary
      ? `Online: ${remoteSummary.shifts} Schichten · Stand ${formatDateTimeForDisplay(status.remote.updated_at)}` : "";
    shared?.refreshView();
  }

  async function refreshOnline() {
    if (!cloud) return;
    if (shared) await shared.refresh();
    if (!shared || shared.personalActive) await cloud.refresh();
  }

  async function action(work) {
    if (uiBusy) return;
    uiBusy = true;
    element("dataActionMessage").textContent = "";
    dialog.querySelectorAll("button[data-network]").forEach((button) => { button.disabled = true; });
    try { await work(); } catch (error) { showError(error); }
    finally {
      uiBusy = false;
      dialog.querySelectorAll("button[data-network]").forEach((button) => { button.disabled = false; });
      if (cloud) renderCloud(cloud.status);
    }
  }

  dialog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-data-target]");
    if (!button) return;
    const target = element(button.dataset.dataTarget);
    if (!target || target.classList.contains("hidden") || target.closest(".hidden")) {
      element("dataActionMessage").textContent = "Dieser Bereich ist nach der Anmeldung beziehungsweise mit Filialverwaltung verfügbar.";
      return;
    }
    if (target.tagName === "DETAILS") {
      for (const section of element("sharedSelected").children) {
        if (section.tagName === "DETAILS") section.open = section === target;
      }
      target.open = true;
    }
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    const focus = target.tagName === "DETAILS" ? target.querySelector("summary") : target;
    focus.setAttribute("tabindex", "-1");
    focus.focus({ preventScroll: true });
  });

  function open() {
    try { renderLocal(); } catch (error) { showError(error); }
    if (!dialog.open) dialog.showModal();
    if (cloud) void action(refreshOnline);
  }

  element("btnDataPanel").addEventListener("click", open);
  element("dataStatus").addEventListener("click", open);
  element("btnStorageHelp").addEventListener("click", open);
  element("btnCloseData").addEventListener("click", () => dialog.close());
  element("btnDataExport").addEventListener("click", exportBackup);
  element("btnDataImport").addEventListener("click", () => { backupFileInputEl.value = ""; backupFileInputEl.click(); });
  element("btnRawExport").addEventListener("click", () => {
    try { triggerBackupDownload(localDataStore.exportRaw(), `wochenplan-rohdaten-${formatIsoDateForFileName()}.json`); }
    catch (error) { showError(error); }
  });
  element("btnRestoreLocal").addEventListener("click", () => {
    try {
      const previous = localDataStore.getPrevious();
      if (!previous) return;
      const summary = getBackupSummary(previous);
      if (!confirm(`Letzten lokalen Stand mit ${summary.shifts} Schichten wiederherstellen? Der jetzige Stand wird dabei als Rückweg aufbewahrt.`)) return;
      importBackupFromObject(previous, { source: "local-restore" });
    } catch (error) { showError(error); }
  });

  element("cloudSignIn").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cloud) return;
    void action(async () => {
      await cloud.signIn(element("cloudEmail").value.trim(), element("cloudPassword").value);
      element("cloudPassword").value = "";
    });
  });
  element("btnCloudRegister").addEventListener("click", () => {
    if (!cloud || !element("cloudSignIn").reportValidity()) return;
    void action(async () => {
      await cloud.signUp(element("cloudEmail").value.trim(), element("cloudPassword").value);
      element("cloudPassword").value = "";
    });
  });
  element("btnCloudSignOut").addEventListener("click", () => { if (cloud) void action(() => cloud.signOut()); });
  element("btnCloudResetPassword").addEventListener("click", () => {
    if (!cloud || !element("cloudEmail").reportValidity()) return;
    void action(() => cloud.resetPassword(element("cloudEmail").value.trim()));
  });
  element("cloudRecovery").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cloud) return;
    void action(async () => { await cloud.updatePassword(element("cloudNewPassword").value); element("cloudNewPassword").value = ""; });
  });
  element("btnCloudRefresh").addEventListener("click", () => { if (cloud) void action(() => cloud.refresh()); });
  element("btnCloudUpload").addEventListener("click", () => {
    if (!cloud) return;
    void action(async () => {
      if (!saveAppState()) throw new Error("Bitte zuerst die lokale Speicherung prüfen.");
      await cloud.refresh();
      const remote = cloud.status.remote;
      if (remote && cloud.status.mode === "choose") {
        if (!confirm(`Den Online-Stand vom ${formatDateTimeForDisplay(remote.updated_at)} durch diesen Geräte-Stand ersetzen? Der bisherige Online-Stand bleibt im Sicherungsverlauf.`)) return;
      } else if (cloud.status.mode === "first-upload") {
        if (!confirm("Diesen Filialplan erstmals online sichern? Danach werden Änderungen automatisch online gesichert.")) return;
      }
      await cloud.save({ overwrite: true });
    });
  });
  element("btnCloudDownload").addEventListener("click", () => {
    if (!cloud) return;
    void action(async () => {
      await cloud.refresh();
      const remote = cloud.status.remote;
      if (!remote) return;
      const summary = getBackupSummary(remote.payload);
      if (!confirm(`Online-Stand vom ${formatDateTimeForDisplay(remote.updated_at)} mit ${summary.shifts} Schichten auf dieses Gerät übernehmen? Der bisherige lokale Stand bleibt wiederherstellbar.`)) return;
      await cloud.adopt();
    });
  });
  element("btnCloudHistory").addEventListener("click", () => {
    if (!cloud) return;
    void action(async () => {
      const history = await cloud.history();
      const select = element("cloudHistorySelect");
      select.replaceChildren(...history.map((item) => {
        const option = document.createElement("option");
        option.value = item.revision;
        option.textContent = `${formatDateTimeForDisplay(item.created_at)} · Stand ${item.revision}`;
        return option;
      }));
      element("cloudHistoryActions").classList.toggle("hidden", !history.length);
      if (!history.length) element("dataActionMessage").textContent = "Noch keine Online-Sicherungen vorhanden.";
    });
  });
  element("btnCloudHistoryExport").addEventListener("click", () => {
    if (!cloud) return;
    void action(async () => {
      const revision = Number(element("cloudHistorySelect").value);
      const payload = await cloud.getRevision(revision);
      triggerBackupDownload(payload, `wochenplan-online-stand-${revision}.json`);
      element("dataActionMessage").textContent = "Sicherung heruntergeladen. Über „Sicherung importieren“ kannst du diesen Stand wiederherstellen.";
    });
  });

  window.addEventListener("wochenplan:saved", () => {
    renderLocal();
    if (shared?.active) shared.scheduleSave(); else cloud?.scheduleSave();
  });
  window.addEventListener("wochenplan:storage-error", () => {
    element("storageProblem").classList.remove("hidden");
    element("storageProblemText").textContent = localDataStore.error || saveStatusMessage;
  });
  window.addEventListener("online", () => { void refreshOnline().catch(showError); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && cloud) void refreshOnline().catch(showError);
  });

  window.addEventListener("load", async () => {
    renderLocal();
    const config = window.WOCHENPLAN_CLOUD_CONFIG;
    if (!config?.enabled || !window.supabase || !window.WochenplanCloud) {
      element("cloudMessage").textContent = "Online-Speicherung ist gerade nicht verfügbar. Lokale Planung und Dateisicherungen funktionieren weiter.";
      element("cloudSignIn").classList.add("hidden");
      return;
    }
    try {
      const client = window.supabase.createClient(config.url, config.publishableKey);
      cloud = window.WochenplanCloud.create({
        client, projectRef: config.projectRef, storage: window.localStorage,
        isPersonalActive: () => shared?.personalActive === true,
        redirectUrl: config.redirectUrl,
        getSnapshot: () => {
          if (localDataStore.blocked) throw new Error(localDataStore.error);
          return collectFullBackupSnapshot();
        },
        applySnapshot: (payload) => importBackupFromObject(payload, { source: "cloud", preserveUi: true, reload: false }),
        reload: () => window.location.reload(), onChange: renderCloud
      });
      shared = window.WochenplanCollaborationPanel.mount({
        client, cloud, config,
        getSnapshot: () => { if (localDataStore.blocked) throw new Error(localDataStore.error); return collectFullBackupSnapshot(); },
        applySnapshot: (payload) => importBackupFromObject(payload, { source: "shared", preserveUi: true, reload: false }),
        reload: () => window.location.reload()
      });
      await cloud.start();
    } catch (_) {
      element("cloudMessage").textContent = "Online-Verbindung konnte nicht gestartet werden. Dein lokaler Plan bleibt erhalten.";
    }
  });
})();
