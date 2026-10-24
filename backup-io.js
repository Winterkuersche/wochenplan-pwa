// Backup serialization/download is kept separate from the planning editor.
// The existing v10 keys and format-2 envelope remain compatible.
function collectFullBackupSnapshot() {
  const savedTheme = loadJson("wochenplan_dark", null);
  return {
    backupVersion: 2,
    capabilities: { vacationCalendar: true },
    app: { name: APP_META.name, version: APP_META.version },
    createdAt: new Date().toISOString(),
    storage: {
      [MASTER_KEY]: saveMasterData({ snapshotOnly: true }),
      [PLAN_KEY]: savePlanData({ snapshotOnly: true }),
      [UI_KEY]: { ...uiState },
      wochenplan_dark: savedTheme === null ? null : String(savedTheme),
      [BACKUP_MEP_CALIBRATION_KEY]: loadJson(BACKUP_MEP_CALIBRATION_KEY, null)
    }
  };
}

function triggerBackupDownload(snapshot, filename = `wochenplan-backup-${formatIsoDateForFileName()}.json`) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
