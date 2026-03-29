function normalizeBackupPayload(backup) {
  if (!backup || typeof backup !== "object") return null;

  const hasStorageEnvelope = backup.storage && typeof backup.storage === "object";
  if (hasStorageEnvelope) return backup;

  const legacyMaster = backup.master || backup[MASTER_KEY] || null;
  const legacyPlan = backup.plan || backup[PLAN_KEY] || null;
  const legacyUi = backup.ui || backup.uiState || backup[UI_KEY] || null;
  const legacyDarkMode = backup.wochenplan_dark;

  if (!legacyMaster && !legacyPlan && !legacyUi) return null;

  return {
    backupVersion: backup.backupVersion || 0,
    createdAt: backup.createdAt || "",
    storage: {
      [MASTER_KEY]: legacyMaster,
      [PLAN_KEY]: legacyPlan,
      [UI_KEY]: legacyUi,
      wochenplan_dark: legacyDarkMode
    }
  };
}

function validateBackupData(backup) {
  const normalizedBackup = normalizeBackupPayload(backup);
  if (!normalizedBackup) {
    return "Die Sicherungsdatei ist ungültig.";
  }

  if (!normalizedBackup.storage || typeof normalizedBackup.storage !== "object") {
    return "Die Sicherungsdatei enthält keine wiederherstellbaren Daten.";
  }

  const requiredKeys = [MASTER_KEY, PLAN_KEY, UI_KEY];
  const missing = requiredKeys.filter((key) => !(key in normalizedBackup.storage));

  if (missing.length > 0) {
    return `Die Sicherungsdatei ist unvollständig (fehlend: ${missing.join(", ")}).`;
  }

  const master = normalizedBackup.storage[MASTER_KEY];
  if (!master || typeof master !== "object" || !Array.isArray(master.employees)) {
    return "Die Stammdaten in der Sicherungsdatei sind ungültig.";
  }

  const plan = normalizedBackup.storage[PLAN_KEY];
  if (!plan || typeof plan !== "object") {
    return "Die Planungsdaten in der Sicherungsdatei sind ungültig.";
  }

  const ui = normalizedBackup.storage[UI_KEY];
  if (!ui || typeof ui !== "object") {
    return "Die Einstellungen in der Sicherungsdatei sind ungültig.";
  }

  return "";
}
