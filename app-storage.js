// Central persistence, recovery and one-step undo. Loaded before app.js;
// state and storage dependencies are used only after app.js initializes them.
/* ========= STORAGE ========= */
function loadJson(key, fallback) {
  return localDataStore.readJson(key, fallback);
}

function saveJson(key, value) {
  return localDataStore.writeJson(key, value);
}

function defaultUiState() {
  return {
    teamCollapsed: true,
    currentView: "week",
    mepAnonymized: false
  };
}

function loadUiState() {
  const rawUi = loadJson(UI_KEY, defaultUiState());
  const sanitizedUi = sanitizeUiState(rawUi, defaultUiState);

  if (JSON.stringify(rawUi || {}) !== JSON.stringify(sanitizedUi)) {
    saveJson(UI_KEY, sanitizedUi);
  }

  return sanitizedUi;
}

function saveUiState() {
  return saveJson(UI_KEY, uiState);
}

function getLastSavedAt() {
  const value = loadJson(LAST_SAVED_AT_KEY, "");
  return typeof value === "string" ? value : "";
}

function updateSaveStatus(message, options = {}) {
  const { isError = false, hideAfterMs = 0 } = options;

  saveStatusMessage = message || "";
  saveStatusHasError = Boolean(isError);

  if (!saveStatusEl) return;

  saveStatusEl.textContent = saveStatusMessage;
  saveStatusEl.classList.toggle("isError", saveStatusHasError);

  if (saveStatusTimerId) {
    clearTimeout(saveStatusTimerId);
    saveStatusTimerId = null;
  }

  if (hideAfterMs > 0) {
    saveStatusTimerId = setTimeout(() => {
      saveStatusMessage = "";
      saveStatusHasError = false;
      saveStatusTimerId = null;
      refreshSaveStatusLabel();
    }, hideAfterMs);
  }
}

function refreshSaveStatusLabel() {
  if (saveStatusMessage) {
    updateSaveStatus(saveStatusMessage, { isError: saveStatusHasError });
    return;
  }

  const savedAt = getLastSavedAt();
  if (savedAt) {
    updateSaveStatus(`Zuletzt gespeichert: ${formatDateTimeForDisplay(savedAt)}`);
  } else {
    updateSaveStatus("Noch nicht gespeichert");
  }
}

function saveMasterData(options) {
  const snapshotOnly = options?.snapshotOnly === true;
  const payload = {
    employees: state.employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      roleKey: emp.roleKey,
      target: emp.target,
      contractModel: emp.contractModel || "",
      contractTargetMinutesPerMonth: Number(emp.contractTargetMinutesPerMonth) || 0,
      totalVacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
      usedVacationDays: Number(emp.usedVacationDays ?? 0),
      remainingVacationDays: Number(emp.remainingVacationDays ?? emp.vacationDays ?? 30),
      vacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
      birthDate: emp.birthDate || "",
      serviceBonus: Boolean(emp.serviceBonus),
      planning2FullDayCandidate: emp.planning2FullDayCandidate === true,
      availability: normalizeEmployeeAvailability(emp.availability),
      timePreference: normalizeEmployeeTimePreference(emp.timePreference),
      flexibleWeekDistribution: emp.flexibleWeekDistribution === true,
      activeFromMonth: normalizeYearMonth(emp.activeFromMonth),
      activeToMonth: normalizeYearMonth(emp.activeToMonth),
      manualMonthActualMinutes: normalizeManualMonthActualMinutes(emp.manualMonthActualMinutes)
    }))
  };
  return snapshotOnly ? payload : saveJson(MASTER_KEY, payload);
}

function savePlanData(options) {
  const snapshotOnly = options?.snapshotOnly === true;
  const payload = {
    weekFrom: state.weekFrom,
    weekTo: state.weekTo,
    schedule: state.schedule || {},
    absences: state.absences || [],
    salesByDate: state.salesByDate || {},
    monthlyPlanBaselines: normalizeMonthlyPlanBaselines(state.monthlyPlanBaselines),
    ...(state.vacationCalendar !== undefined ? { vacationCalendar: state.vacationCalendar } : {})
  };
  return snapshotOnly ? payload : saveJson(PLAN_KEY, payload);
}

function saveAppState() {
  planning2UndoState = null;
  const savedAt = new Date().toISOString();
  const result = localDataStore.writeBatch({
    [MASTER_KEY]: saveMasterData({ snapshotOnly: true }),
    [PLAN_KEY]: savePlanData({ snapshotOnly: true }),
    [UI_KEY]: uiState,
    [LAST_SAVED_AT_KEY]: savedAt
  });

  if (result.ok) {
    lastSavedAt = savedAt;
    updateSaveStatus("Auf diesem Gerät gespeichert", { hideAfterMs: 2500 });
    window.dispatchEvent(new CustomEvent("wochenplan:saved"));
    return true;
  }

  updateSaveStatus(result.error, { isError: true });
  window.dispatchEvent(new CustomEvent("wochenplan:storage-error"));
  return false;
}

// Planning 2 uses exactly the same journal, stale-tab check and online signal.
function planning2PlanSignature(plan) {
  const value = { ...plan, schedule: plan?.schedule || {}, absences: plan?.absences || [], monthlyPlanBaselines: plan?.monthlyPlanBaselines || {} };
  delete value.weekFrom;
  delete value.weekTo;
  const canonical = item => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
  return JSON.stringify(canonical(value));
}

function commitPlanning2Plan(plan, expectedPlan) {
  flushPendingAutoSave();
  const current = JSON.parse(localStorage.getItem(PLAN_KEY) || "{}");
  if (expectedPlan && planning2PlanSignature(current) !== planning2PlanSignature(expectedPlan)) {
    throw new Error("Der Plan wurde inzwischen geändert. Öffne den Eintrag erneut.");
  }
  const previous = state;
  const before = localStorage.getItem(PLAN_KEY) === null ? savePlanData({ snapshotOnly: true }) : current;
  state = { ...state, ...plan };
  if (!saveAppState()) {
    state = previous;
    throw new Error(saveStatusMessage || "Speichern fehlgeschlagen. Der bisherige Stand bleibt erhalten.");
  }
  planning2UndoState = { before, plan: localStorage.getItem(PLAN_KEY), master: localStorage.getItem(MASTER_KEY) };
  return true;
}

function canUndoPlanning2Plan() {
  return Boolean(planning2UndoState) && !localDataStore.blocked && !autoSaveTimerId
    && localStorage.getItem(PLAN_KEY) === planning2UndoState.plan
    && localStorage.getItem(MASTER_KEY) === planning2UndoState.master;
}

function undoPlanning2Plan() {
  if (!canUndoPlanning2Plan()) throw new Error("Seitdem wurde weitergeplant. Die Änderung kann hier nicht mehr zurückgenommen werden.");
  const previous = state;
  const undo = planning2UndoState;
  // Legacy snapshots may omit optional plan fields. Replace them explicitly so
  // values introduced by the undone edit cannot survive the state merge.
  state = { ...state, ...undo.before,
    schedule: undo.before.schedule || {},
    absences: undo.before.absences || [],
    salesByDate: undo.before.salesByDate || {},
    monthlyPlanBaselines: undo.before.monthlyPlanBaselines || {},
    vacationCalendar: undo.before.vacationCalendar
  };
  if (!saveAppState()) {
    state = previous;
    throw new Error(saveStatusMessage || "Rücknahme konnte nicht gespeichert werden.");
  }
  return true;
}

window.WochenplanPlanning = { save: commitPlanning2Plan, undo: undoPlanning2Plan, canUndo: canUndoPlanning2Plan, invalidateUndo: () => { planning2UndoState = null; } };

function saveAppStateDebounced() {
  updateSaveStatus("Änderungen werden gespeichert …");
  if (autoSaveTimerId) {
    clearTimeout(autoSaveTimerId);
  }

  autoSaveTimerId = setTimeout(() => {
    autoSaveTimerId = null;
    saveAppState();
  }, AUTOSAVE_DELAY_MS);
}

function flushPendingAutoSave() {
  if (overviewRevenueDebounceTimerId) {
    saveOverviewRevenueFromEditor({ source: "debounce", showValidationErrors: false });
  }
  if (!autoSaveTimerId) return;
  clearTimeout(autoSaveTimerId);
  autoSaveTimerId = null;
  saveAppState();
}

function loadAppState() {
  const rawPlan = loadJson(PLAN_KEY, defaultPlanState());
  const calendarError = typeof WochenplanVacationCalendar !== "undefined" ? WochenplanVacationCalendar.validateData(rawPlan.vacationCalendar) : "";
  if (calendarError) localDataStore.protect(calendarError + " Der vorhandene Speicher bleibt geschützt.");
  const normalizedSchedule = rawPlan.schedule && typeof rawPlan.schedule === "object"
    ? normalizeSchedule(rawPlan.schedule)
    : {};
  const {
    schedule: validatedSchedule,
    report: scheduleValidationReport
  } = validateNormalizedSchedule(normalizedSchedule, { logWarnings: true });
  const originalEntryCount = Object.values(rawPlan.schedule || {}).reduce((sum, day) => sum + Object.keys(day || {}).length, 0);
  const loadedEntryCount = Object.values(validatedSchedule).reduce((sum, day) => sum + Object.keys(day).length, 0);
  if (loadedEntryCount < originalEntryCount) {
    localDataStore.protect("Nicht alle gespeicherten Einträge konnten geladen werden. Automatisches Speichern ist zum Schutz der Originaldaten angehalten.");
  }

  // Persist normalization only through the next journaled save. The original
  // input must remain recoverable if a migration changes or drops entries.

  return {
    ui: loadUiState(),
    state: buildInitialState({
      planOverride: {
        ...rawPlan,
        schedule: validatedSchedule
      }
    }),
    scheduleValidationReport,
    lastSavedAt: getLastSavedAt()
  };
}

