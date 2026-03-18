document.title = `${APP_META.name} ${APP_META.version}`;

const appTitleEl = document.getElementById("app-title");
if (appTitleEl) {
  appTitleEl.textContent = `${APP_META.name} ${APP_META.version}`;
}

const DAYS = [
  { key: "mo", label: "Mo", full: "Montag" },
  { key: "di", label: "Di", full: "Dienstag" },
  { key: "mi", label: "Mi", full: "Mittwoch" },
  { key: "do", label: "Do", full: "Donnerstag" },
  { key: "fr", label: "Fr", full: "Freitag" },
  { key: "sa", label: "Sa", full: "Samstag" },
  { key: "so", label: "So", full: "Sonntag" }
];

const ROLE_OPTIONS = [
  { key: "", label: "-", target: "", contractModel: "" },
  { key: "TL", label: "TL", target: "30:00", contractModel: "VZ30" },
  { key: "TZ30", label: "TZ30", target: "30:00", contractModel: "TZ30" },
  { key: "TZ20", label: "TZ20", target: "20:00", contractModel: "TZ20" },
  { key: "TZ15", label: "TZ15", target: "15:00", contractModel: "TZ15" },
  { key: "GFB", label: "GfB", target: "9:30", contractModel: "" }
];

const SHIFTS = [
  { key: "-", label: "-", start: "", end: "", type: "free" },
  { key: "F3", label: "F3", start: "09:00", end: "12:00", type: "early" },
  { key: "F4", label: "F4", start: "09:00", end: "13:00", type: "early" },
  { key: "F5", label: "F5", start: "09:00", end: "14:00", type: "early" },
  { key: "F6", label: "F6", start: "09:00", end: "15:00", type: "early" },
  { key: "G1", label: "G1", start: "09:00", end: "19:10", type: "full" },
  { key: "L1", label: "L1", start: "13:00", end: "19:10", type: "late" },
  { key: "L2", label: "L2", start: "14:00", end: "19:10", type: "late" },
  { key: "L3", label: "L3", start: "15:00", end: "19:10", type: "late" },
  { key: "L4", label: "L4", start: "16:00", end: "19:10", type: "late" },
  { key: "L1E", label: "L1E", start: "13:00", end: "19:00", type: "lateNo" },
  { key: "L2E", label: "L2E", start: "14:00", end: "19:00", type: "lateNo" },
  { key: "L3E", label: "L3E", start: "15:00", end: "19:00", type: "lateNo" },
  { key: "L4E", label: "L4E", start: "16:00", end: "19:00", type: "lateNo" }
];

const MASTER_KEY = "wochenplan_master_v10";
const PLAN_KEY = "wochenplan_plan_v10";
const UI_KEY = "wochenplan_ui_v10";
const BACKUP_INTERNAL_KEY = "wochenplan_import_backup_v1";
const LAST_BACKUP_BEFORE_IMPORT_KEY = "wochenplan_last_backup_before_import_v1";
const BACKUP_META_KEY = "wochenplan_backup_meta_v1";
const BACKUP_MEP_CALIBRATION_KEY = "mep-calibration";
const LAST_SAVED_AT_KEY = "wochenplan_last_saved_at_v1";
const AUTOSAVE_DELAY_MS = 600;
const MAX_WEEKLY_MINUTES = 159 * 60;

let currentDayIndex = 0;
let lastSelectedShift = null;
let autoSaveTimerId = null;
let saveStatusTimerId = null;
let saveStatusMessage = "";
let saveStatusHasError = false;
let responsiveViewRefreshTimerId = null;

function isResponsiveEmbeddedViewActive() {
  const currentView = uiState?.currentView || "week";
  return currentView === "form";
}

function updateAppViewportHeightVar() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;

  const onePercent = viewportHeight * 0.01;
  document.documentElement.style.setProperty("--app-vh", `${onePercent}px`);
  document.documentElement.style.setProperty("--app-dvh", `${viewportHeight}px`);
}

function updateEmbeddedViewMaxHeightVar(selector, cssVar) {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const targetEl = document.querySelector(selector);

  if (!targetEl || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    document.documentElement.style.removeProperty(cssVar);
    return;
  }

  const rect = targetEl.getBoundingClientRect();
  const topOffset = Math.max(rect.top, 0);
  const availableHeight = Math.max(240, Math.floor(viewportHeight - topOffset - 12));

  document.documentElement.style.setProperty(cssVar, `${availableHeight}px`);
}

function updateResponsiveViewportMetrics() {
  updateAppViewportHeightVar();
  updateEmbeddedViewMaxHeightVar("#formView", "--form-view-max-height");
  updateEmbeddedViewMaxHeightVar("#mepTemplateView", "--mep-template-view-max-height");
}

function refreshCurrentResponsiveView() {
  const currentView = uiState?.currentView || "week";

  if (currentView === "form" && typeof renderFormView === "function") {
    renderFormView();
  }
}

function scheduleResponsiveViewRefresh() {
  if (responsiveViewRefreshTimerId) {
    window.clearTimeout(responsiveViewRefreshTimerId);
  }

  responsiveViewRefreshTimerId = window.setTimeout(() => {
    responsiveViewRefreshTimerId = null;
    updateResponsiveViewportMetrics();
    refreshCurrentResponsiveView();
  }, 120);
}

function requestActiveResponsiveViewRefresh() {
  if (!isResponsiveEmbeddedViewActive()) return;
  scheduleResponsiveViewRefresh();
}

const loadedAppState = loadAppState();
let uiState = loadedAppState.ui;
let state = loadedAppState.state;
let lastSavedAt = loadedAppState.lastSavedAt;
state.schedule = state.schedule || {};
state.absences = state.absences || [];

/* ========= PLAN API ========= */

function ensureScheduleDay(isoDate) {
  if (!state.schedule) state.schedule = {};
  if (!state.schedule[isoDate]) state.schedule[isoDate] = {};
  return state.schedule[isoDate];
}

function normalizePlanEntry(entry) {
  // status is unified via status-utils.js
  if (!entry || typeof entry !== "object") return null;

  const entryStatus = getEntryStatus(entry);
  const isExternalHelp = entryStatus === ENTRY_STATUS.EXTERNAL || Boolean(entry.externalHelp);
  const isVacation = entryStatus === ENTRY_STATUS.VACATION;
  const type = isExternalHelp
    ? "external-help"
    : isVacation
      ? "vacation"
      : entryStatus === ENTRY_STATUS.WORK
        ? "shift"
        : "off";
  const status = entryStatus;

  const start = isValidHHMM(entry.start || "")
    ? normalizePlanTime(entry.start)
    : "";
  const end = isValidHHMM(entry.end || "")
    ? normalizePlanTime(entry.end)
    : "";

  const rawPause = Number(entry.pause ?? entry.breakMinutes ?? 0) || 0;
  const pause = isExternalHelp
    ? 0
    : start && end
      ? getEffectiveBreakMinutes(start, end, rawPause, {
        includeBillingBonus: end === "19:10"
      })
      : normalizePlanBreakMinutes(rawPause);

  let minutes = 0;

  if (isVacation) {
    minutes = 0;
  } else if (typeof entry.minutes === "number") {
    minutes = normalizeMinutesToQuarterHour(entry.minutes);
  } else if (typeof entry.minutes === "string" && isValidHHMM(entry.minutes)) {
    minutes = normalizeMinutesToQuarterHour(parseTimeToMinutes(entry.minutes));
  } else if (start && end) {
    minutes = isExternalHelp
      ? normalizeMinutesToQuarterHour(getExternalHelpWorkedMinutes(start, end))
      : normalizeMinutesToQuarterHour(Math.max(0, diffMinutesBetweenHHMM(start, end) - pause));
  }

  const shiftKey = entry.shiftKey || entry.code || "";
  const shiftType = entry.shiftType || entry.mode || "";

  return {
    ...entry,
    type,
    status,
    shiftKey,
    shiftType,
    code: entry.code || shiftKey,
    mode: entry.mode || shiftType,
    start,
    end,
    pause,
    breakMinutes: pause,
    note: entry.note || "",
    branch: entry.branch || "",
    externalHelp: isExternalHelp,
    minutes,
    label: entry.label || (isExternalHelp ? "AH" : isVacation ? "U" : shiftKey || "")
  };
}

function isVacationScheduleEntry(entry) {
  return isVacationEntry(entry);
}

function setVacationEntry(employeeId, isoDate, options = {}) {
  if (!employeeId || !isoDate) return null;

  return updateEmployeeDay(
    employeeId,
    isoDate,
    () => ({
      type: "vacation",
      status: ENTRY_STATUS.VACATION,
      label: "U",
      minutes: 0,
      note: options.note || ""
    }),
    { commit: options.commit !== false }
  );
}

function clearVacationEntry(employeeId, isoDate, options = {}) {
  const current = getPlanEntry(employeeId, isoDate);
  if (!isVacationScheduleEntry(current)) return;
  clearPlanEntry(employeeId, isoDate, options);
}

function syncVacationScheduleFromAbsences(employeeId = null) {
  const targetEmployeeIds = employeeId
    ? [employeeId]
    : state.employees.map((emp) => emp.id);

  targetEmployeeIds.forEach((empId) => {
    Object.entries(state.schedule || {}).forEach(([isoDate, dayEntries]) => {
      if (!dayEntries || !dayEntries[empId]) return;
      if (isVacationScheduleEntry(dayEntries[empId])) {
        delete dayEntries[empId];
        cleanupScheduleDay(isoDate);
      }
    });

    (state.absences || [])
      .filter((entry) => entry?.employeeId === empId && entry.type === "vacation")
      .forEach((entry) => {
        let cursor = entry.from;

        while (cursor <= entry.to) {
          setVacationEntry(empId, cursor, { commit: false, note: entry.note || "" });
          cursor = shiftIsoDateByDays(cursor, 1);
        }
      });
  });
}

function getUsedVacationDaysFromScheduleForEmployee(employeeId, year = new Date().getFullYear()) {
  if (!employeeId || !year) return 0;

  return Object.entries(state.schedule || {}).reduce((sum, [isoDate, dayEntries]) => {
    if (!isoDate.startsWith(`${year}-`)) return sum;
    if (!isWorkdayForVacation(isoDate)) return sum;

    const entry = dayEntries?.[employeeId];
    return sum + (isVacationScheduleEntry(entry) ? 1 : 0);
  }, 0);
}

function refreshEmployeeVacationCounters(year = new Date().getFullYear()) {
  state.employees.forEach((emp) => {
    const totalVacationDays = Number(emp.totalVacationDays ?? emp.vacationDays ?? 30) || 0;
    const usedVacationDays = getUsedVacationDaysFromScheduleForEmployee(emp.id, year);
    const remainingVacationDays = totalVacationDays - usedVacationDays;

    emp.totalVacationDays = totalVacationDays;
    emp.vacationDays = totalVacationDays;
    emp.usedVacationDays = usedVacationDays;
    emp.remainingVacationDays = remainingVacationDays;
  });
}

function normalizeSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") return {};

  const normalized = {};

  Object.entries(schedule).forEach(([isoDate, dayEntries]) => {
    if (!dayEntries || typeof dayEntries !== "object") return;

    const nextDay = {};

    Object.entries(dayEntries).forEach(([employeeId, entry]) => {
      const normalizedEntry = normalizePlanEntry(entry);
      if (normalizedEntry) {
        nextDay[employeeId] = normalizedEntry;
      }
    });

    if (Object.keys(nextDay).length > 0) {
      normalized[isoDate] = nextDay;
    }
  });

  return normalized;
}

function cleanupScheduleDay(isoDate) {
  const day = state.schedule?.[isoDate];
  if (!day) return;

  if (Object.keys(day).length === 0) {
    delete state.schedule[isoDate];
  }
}

function getScheduleEntry(employeeId, isoDate) {
  return getPlanEntry(employeeId, isoDate);
}

function getPlanEntry(employeeId, isoDate) {
  if (!employeeId || !isoDate) return null;
  const entry = state.schedule?.[isoDate]?.[employeeId] || null;
  return normalizePlanEntry(entry);
}

function getScheduleEntrySafe(employeeId, isoDate) {
  return getScheduleEntry(employeeId, isoDate);
}

function getEmployeeDayEntry(employeeId, isoDate) {
  return getScheduleEntrySafe(employeeId, isoDate);
}

function hasEmployeeWorkEntry(employeeId, isoDate) {
  const entry = getEmployeeDayEntry(employeeId, isoDate);
  if (!entry) return false;

  const status = getEntryStatus(entry);
  return status === ENTRY_STATUS.WORK || status === ENTRY_STATUS.EXTERNAL;
}

function updateEmployeeDay(employeeId, isoDate, updater, options = {}) {
  if (!employeeId || !isoDate || typeof updater !== "function") return null;

  const { commit = true } = options;
  const currentEntry = getPlanEntry(employeeId, isoDate);
  const nextEntry = updater(currentEntry ? { ...currentEntry } : null);

  if (nextEntry == null) {
    if (state.schedule?.[isoDate]?.[employeeId]) {
      delete state.schedule[isoDate][employeeId];
      cleanupScheduleDay(isoDate);
    }

    if (commit) {
      commitPlanChange();
    }

    return null;
  }

  const normalizedEntry = normalizePlanEntry(nextEntry);

  if (!normalizedEntry) {
    if (state.schedule?.[isoDate]?.[employeeId]) {
      delete state.schedule[isoDate][employeeId];
      cleanupScheduleDay(isoDate);
    }

    if (commit) {
      commitPlanChange();
    }

    return null;
  }

  const day = ensureScheduleDay(isoDate);
  day[employeeId] = normalizedEntry;

  if (commit) {
    commitPlanChange();
  }

  return day[employeeId];
}

function setScheduleEntry(employeeId, isoDate, entry) {
  return setPlanEntry(employeeId, isoDate, entry);
}

function setPlanEntry(employeeId, isoDate, entry) {
  if (!employeeId || !isoDate || !entry) return;
  return updateEmployeeDay(employeeId, isoDate, () => ({ ...entry }));
}

function clearScheduleEntry(employeeId, isoDate) {
  return clearPlanEntry(employeeId, isoDate);
}

function clearPlanEntry(employeeId, isoDate, options = {}) {
  if (!employeeId || !isoDate) return;
  return updateEmployeeDay(employeeId, isoDate, () => null, options);
}

function setShift(employeeId, isoDate, entryOrShiftKey) {
  let entry = entryOrShiftKey;

  if (typeof entryOrShiftKey === "string") {
    if (entryOrShiftKey === "L") {
      entry = buildLateShiftEntry("13:00", true);
    } else if (entryOrShiftKey === "G") {
      entry = buildFullShiftEntry(true);
    } else {
      entry = buildEarlyShiftEntry(entryOrShiftKey);
    }
  }

  if (!entry || entry.type !== "shift") return;
  setScheduleEntry(employeeId, isoDate, entry);
}

function setExternalHelp(employeeId, isoDate, branch, minutes) {
  const normalizedMinutes = normalizeMinutesToQuarterHour(minutes);

  setPlanEntry(employeeId, isoDate, {
    type: "external-help",
    status: ENTRY_STATUS.EXTERNAL,
    label: "AH",
    branch,
    externalHelp: true,
    minutes: normalizedMinutes,
    pause: 0,
    breakMinutes: 0,
    start: "",
    end: ""
  });
}

function setAbsence(employeeId, from, to, type, note = "", options = {}) {
  const { commit = true } = options;
  const absence = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `abs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    employeeId,
    type,
    from,
    to,
    note
  };

  state.absences.push(absence);
  state.absences = normalizeAbsences(state.absences);

  if (commit) {
    commitPlanChange();
  }

  return absence;
}

function removeAbsence(absenceId) {
  state.absences = state.absences.filter((a) => a.id !== absenceId);

  commitPlanChange();
}
function clearDay(employeeId, isoDate, options = {}) {
  if (!employeeId || !isoDate) return;

  const { commit = true } = options;

 

  clearPlanEntry(employeeId, isoDate, { commit: false });

  removeAbsenceCoverageForEmployee(employeeId, isoDate, isoDate);
  syncVacationScheduleFromAbsences(employeeId);

  if (commit) {
    commitPlanChange();
  }
}
function commitPlanChange() {
  refreshEmployeeVacationCounters();
  saveAppStateDebounced();
  renderAllViews();
}

/* ========= DOM ========= */
const teamListEl = document.getElementById("teamList");
const dayTabsEl = document.getElementById("dayTabs");
const plannerListEl = document.getElementById("plannerList");
const metaDayNameEl = document.getElementById("metaDayName");
const dayWarningsEl = document.getElementById("dayWarnings");
const dayHoursInfoEl = document.getElementById("dayHoursInfo");
const weekTableBodyEl = document.getElementById("weekTableBody");
const weekWarningsEl = document.getElementById("weekWarnings");

const weekFromEl = document.getElementById("weekFrom");
const weekToEl = document.getElementById("weekTo");

const teamSectionEl = document.getElementById("teamSection");
const btnToggleTeamEl = document.getElementById("btnToggleTeam");

const weeklyHoursActualEl = document.getElementById("weeklyHoursActual");
const weeklyHoursRemainingEl = document.getElementById("weeklyHoursRemaining");
const weeklyHoursStatusEl = document.getElementById("weeklyHoursStatus");

const dayViewEl = document.getElementById("dayView");
const weekViewEl = document.getElementById("weekView");
const monthViewEl = document.getElementById("monthView");
const formViewEl = document.getElementById("formView");
const mepTemplateViewEl = document.getElementById("mepTemplateView");

const btnViewDayEl = document.getElementById("btnViewDay");
const btnViewWeekEl = document.getElementById("btnViewWeek");
const btnViewMonthEl = document.getElementById("btnViewMonth");
const btnViewFormEl = document.getElementById("btnViewForm");
const btnViewMepEl = document.getElementById("btnViewMep");
const btnPrevWeekEl = document.getElementById("btnPrevWeek");
const btnCurrentWeekEl = document.getElementById("btnCurrentWeek");
const btnNextWeekEl = document.getElementById("btnNextWeek");
const viewMetaLineEl = document.getElementById("viewMetaLine");
const topToolbarEl = document.getElementById("topToolbar");
const btnResetWeekEl = document.getElementById("btnResetWeek");
const btnExportBackupEl = document.getElementById("btnExportBackup");
const btnImportBackupEl = document.getElementById("btnImportBackup");
const backupFileInputEl = document.getElementById("backupFileInput");
const backupInfoEl = document.getElementById("backupInfo");
const saveStatusEl = document.getElementById("saveStatus");

const mepWeekFromEl = document.getElementById("mepWeekFrom");
const mepWeekToEl = document.getElementById("mepWeekTo");
const mepMonthYearEl = document.getElementById("mepMonthYear");

/* ========= HELPERS ========= */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function fromIsoDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getMondayBasedDayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function hmToMinutes(hm) {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToHM(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatSignedMinutes(min) {
  if (min === 0) return "0:00";
  return `${min > 0 ? "+" : "-"}${minutesToHM(Math.abs(min))}`;
}

function formatHMToQuarterLabel(hmValue) {
  if (typeof hmValue !== "string" || !/^\d{1,2}:\d{2}$/.test(hmValue.trim())) return hmValue || "";

  const [hoursText, minutesText] = hmValue.trim().split(":");
  const hours = String(Number(hoursText));
  const minutes = Number(minutesText);

  if (![0, 15, 30, 45].includes(minutes)) return `${hours}:${minutesText}`;

  const quarterLabelByMinute = {
    0: "00",
    15: "¼",
    30: "½",
    45: "¾"
  };

  return `${hours}:${quarterLabelByMinute[minutes]}`;
}

function formatMonthYear(dateStr) {
  if (!dateStr) return "____________";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "____________";
  return `${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function roleToTarget(roleKey) {
  const found = ROLE_OPTIONS.find((r) => r.key === roleKey);
  return found?.target || "";
}

function roleToContractModel(roleKey) {
  const found = ROLE_OPTIONS.find((r) => r.key === roleKey);
  return found?.contractModel || "";
}

/* ========= STORAGE ========= */
function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function defaultUiState() {
  return {
    teamCollapsed: false,
    currentView: "week"
  };
}

function loadUiState() {
  const rawUi = loadJson(UI_KEY, defaultUiState());
  return { ...defaultUiState(), ...(rawUi || {}) };
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

function saveMasterData() {
  return saveJson(MASTER_KEY, {
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
      serviceBonus: Boolean(emp.serviceBonus)
    }))
  });
}

function savePlanData() {
  return saveJson(PLAN_KEY, {
    weekFrom: state.weekFrom,
    weekTo: state.weekTo,
    schedule: state.schedule || {},
    absences: state.absences || []
  });
}

function saveAppState() {
  const savedAt = new Date().toISOString();
  const masterSaved = saveMasterData();
  const planSaved = savePlanData();
  const uiSaved = saveUiState();
  const savedAtPersisted = saveJson(LAST_SAVED_AT_KEY, savedAt);

  if (masterSaved && planSaved && uiSaved && savedAtPersisted) {
    lastSavedAt = savedAt;
    updateSaveStatus("Gespeichert", { hideAfterMs: 2500 });
    return true;
  }

  updateSaveStatus("Speichern fehlgeschlagen", { isError: true, hideAfterMs: 4000 });
  return false;
}

function saveAppStateDebounced() {
  if (autoSaveTimerId) {
    clearTimeout(autoSaveTimerId);
  }

  autoSaveTimerId = setTimeout(() => {
    autoSaveTimerId = null;
    saveAppState();
  }, AUTOSAVE_DELAY_MS);
}

function flushPendingAutoSave() {
  if (!autoSaveTimerId) return;
  clearTimeout(autoSaveTimerId);
  autoSaveTimerId = null;
  saveAppState();
}

function loadAppState() {
  return {
    ui: loadUiState(),
    state: buildInitialState(),
    lastSavedAt: getLastSavedAt()
  };
}

/* ========= DEFAULT DATA ========= */
function createDefaultEmployees() {
  return [
    { id: "emp_1", name: "Stephan M", roleKey: "TL", target: "30:00", contractModel: "VZ30", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_2", name: "Mitarbeiter 2", roleKey: "TZ30", target: "30:00", contractModel: "TZ30", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_3", name: "Mitarbeiter 3", roleKey: "TZ20", target: "20:00", contractModel: "TZ20", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_4", name: "Mitarbeiter 4", roleKey: "TZ15", target: "15:00", contractModel: "TZ15", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_5", name: "Mitarbeiter 5", roleKey: "TZ20", target: "20:00", contractModel: "TZ20", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_6", name: "", roleKey: "", target: "", contractModel: "", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_7", name: "", roleKey: "", target: "", contractModel: "", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_8", name: "", roleKey: "", target: "", contractModel: "", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_9", name: "", roleKey: "", target: "", contractModel: "", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_10", name: "", roleKey: "", target: "", contractModel: "", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_11", name: "", roleKey: "", target: "", contractModel: "", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_12", name: "", roleKey: "", target: "", contractModel: "", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_13", name: "", roleKey: "", target: "", contractModel: "", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "",
  serviceBonus: false, shifts: {} }
  ];
}

function defaultMasterState() {
  return {
    employees: createDefaultEmployees().map((emp) => ({
      id: emp.id,
      name: emp.name,
      roleKey: emp.roleKey,
      target: emp.target,
      contractModel: emp.contractModel || roleToContractModel(emp.roleKey || ""),
      contractTargetMinutesPerMonth: Number(emp.contractTargetMinutesPerMonth) || 0,
      totalVacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
      usedVacationDays: Number(emp.usedVacationDays ?? 0),
      remainingVacationDays: Number(emp.remainingVacationDays ?? emp.vacationDays ?? 30),
      vacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
      birthDate: emp.birthDate,
      serviceBonus: emp.serviceBonus
    }))
  };
}

function defaultPlanState() {
  return {
    weekFrom: "",
    weekTo: "",
    schedule: {},
    absences: []
  };
}
function buildInitialState() {
  const master = loadJson(MASTER_KEY, defaultMasterState());
  const plan = loadJson(PLAN_KEY, defaultPlanState());

  const baseEmployees = Array.isArray(master.employees)
    ? master.employees
    : defaultMasterState().employees;

 const employees = baseEmployees.map((emp, index) => {
  return {
    id: emp.id || `emp_${index + 1}`,
    name: emp.name || "",
    roleKey: emp.roleKey || "",
    target: emp.target || roleToTarget(emp.roleKey || ""),
    contractModel: emp.contractModel || roleToContractModel(emp.roleKey || ""),
    contractTargetMinutesPerMonth: Number(emp.contractTargetMinutesPerMonth) || 0,
    totalVacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
    usedVacationDays: Number(emp.usedVacationDays ?? 0),
    remainingVacationDays: Number(emp.remainingVacationDays ?? emp.vacationDays ?? 30),
    vacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
    birthDate: emp.birthDate || "",
    serviceBonus: Boolean(emp.serviceBonus),
    shifts: {}
  };
});

  const schedule = plan.schedule && typeof plan.schedule === "object"
    ? normalizeSchedule(plan.schedule)
    : {};

  const absences = Array.isArray(plan.absences)
    ? normalizeAbsences(plan.absences)
    : [];

    return {
    weekFrom: plan.weekFrom || "",
    weekTo: plan.weekTo || "",
    monthPlan: null,
    activeMonth: (plan.weekFrom || toIsoDate(new Date())).slice(0, 7),
    employees,
    schedule,
    absences
  };
}


/* ========= MONTH ENGINE FALLBACK ========= */
function buildMonthPlanFallback(year, monthIndex) {
  const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);

  const gridStart = cloneDate(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - getMondayBasedDayIndex(firstOfMonth));

  const gridEnd = cloneDate(lastOfMonth);
  gridEnd.setDate(lastOfMonth.getDate() + (6 - getMondayBasedDayIndex(lastOfMonth)));

  const weeks = [];
  let cursor = cloneDate(gridStart);

  while (cursor <= gridEnd) {
    const week = [];

    for (let i = 0; i < 7; i++) {
      week.push({
        date: cloneDate(cursor),
        iso: toIsoDate(cursor),
        weekdayIndex: i,
        weekdayLabel: labels[i],
        inCurrentMonth: cursor.getMonth() === monthIndex,
        isOutsideMonth: cursor.getMonth() !== monthIndex
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push(week);
  }

  return {
    meta: {
      year,
      monthIndex,
      month: monthIndex + 1
    },
    weeks
  };
}

function getMonthPlanSafe(dateStr) {
  if (!dateStr) return null;

  if (typeof getMonthPlanFromDateString === "function") {
    return getMonthPlanFromDateString(dateStr);
  }

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;

  return buildMonthPlanFallback(d.getFullYear(), d.getMonth());
}

/* ========= ACTIVE WEEK ========= */
function getActiveMonthPlan() {
  const activeMonth = state.activeMonth || (state.weekFrom || toIsoDate(new Date())).slice(0, 7);
  const [year, month] = activeMonth.split("-").map(Number);

  if (!year || !month) return null;

  return buildMonthPlanFallback(year, month - 1);
}

function syncMonthPlanToState() {
  state.monthPlan = getActiveMonthPlan();
  return state.monthPlan;
}

function getCurrentMonthWeeks() {
  return state.monthPlan?.weeks || [];
}

function getActiveWeekDays() {
  const weeks = getCurrentMonthWeeks();
  if (!weeks.length) return [];

  if (state.weekFrom) {
    const found = weeks.find((week) => week.some((day) => day.iso === state.weekFrom));
    if (found) return found;
  }

  return weeks[0];
}

function syncWeekRangeFromActiveWeek() {
  const week = getActiveWeekDays();
  if (!week.length) return;

  state.weekFrom = week[0].iso;
  state.weekTo = week[6].iso;

  if (weekFromEl) weekFromEl.value = state.weekFrom;
  if (weekToEl) weekToEl.value = state.weekTo;
}

function getDayObjectByIndex(index) {
  const week = getActiveWeekDays();
  return week[index] || null;
}

function getCurrentDayObject() {
  return getDayObjectByIndex(currentDayIndex);
}

function getCurrentDayIso() {
  return getCurrentDayObject()?.iso || "";
}

function shiftActiveWeek(days) {
  const date = fromIsoDate(state.weekFrom);
  if (!date) return;

  date.setDate(date.getDate() + days);
  state.weekFrom = toIsoDate(date);
  state.activeMonth = state.weekFrom.slice(0, 7);

  syncMonthPlanToState();
  syncWeekRangeFromActiveWeek();
  commitPlanChange();
}

/* ========= SHIFT HELPERS ========= */
function getShiftByKey(key) {
  return SHIFTS.find((s) => s.key === key) || SHIFTS[0];
}

function getShiftClassByKey(key) {
  return getShiftByKey(key).type || "free";
}

function getShiftForEmployeeOnIso(emp, iso) {
  const entry = getEmployeeDayEntry(emp.id, iso);
  if (!entry) return "-";

  if (entry.type !== "shift") return "-";
  return entry.code || "-";
}


function shiftDurationMinutes(shiftKey) {
  const shift = getShiftByKey(shiftKey);
  if (!shift.start || !shift.end) return 0;
  return hmToMinutes(shift.end) - hmToMinutes(shift.start);
}

function appliedPauseMinutes(shiftKey) {
  const duration = shiftDurationMinutes(shiftKey);

  if (shiftKey === "G1") return 70;
  if (["L1", "L2", "L3", "L4"].includes(shiftKey)) return 10;
  if (duration > 6 * 60) return 60;

  return 0;
}

function netMinutesForShift(shiftKey) {
  const duration = shiftDurationMinutes(shiftKey);
  if (!duration) return 0;
  return Math.max(0, duration - appliedPauseMinutes(shiftKey));
}

/* ========= CALCULATIONS ========= */
function getResolvedEntryForEmployeeOnIso(emp, isoDate) {
  return getResolvedDayEntry({
    employee: emp,
    isoDate,
    schedule: state.schedule,
    absences: state.absences,
    stateKey: APP_META.stateKey
  });
}

function getResolvedLabelForEmployeeOnIso(emp, isoDate) {
  return getResolvedEntryForEmployeeOnIso(emp, isoDate).label;
}
function getBlockingTypeForEmployeeOnIso(emp, isoDate) {
  const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);

  if (!resolved) return null;
  const status = getResolvedStatus(resolved);

  if (status === ENTRY_STATUS.VACATION) return ENTRY_STATUS.VACATION;
  if (status === ENTRY_STATUS.SICK) return ENTRY_STATUS.SICK;
  if (resolved.type === "holiday") return "holiday";

  return null;
}

function isEmployeeBlockedOnIso(emp, isoDate) {
  return Boolean(getBlockingTypeForEmployeeOnIso(emp, isoDate));
}

function totalMinutesForEmployeeInWeek(emp, weekDays) {
  return weekDays.reduce((sum, day) => {
    if (day.isOutsideMonth) return sum;
    return sum + getResolvedEntryForEmployeeOnIso(emp, day.iso).minutesForMonth;
  }, 0);
}

function totalMinutesForEmployee(emp) {
  return totalMinutesForEmployeeInWeek(emp, getActiveWeekDays());
}

function deltaMinutes(emp) {
  return totalMinutesForEmployee(emp) - hmToMinutes(emp.target || "0:00");
}

function isCreditableResolvedWorkEntry(resolvedEntry) {
  const status = getResolvedStatus(resolvedEntry);
  return status === ENTRY_STATUS.WORK || status === ENTRY_STATUS.EXTERNAL;
}

function isCreditableResolvedAccountEntry(resolvedEntry) {
  const status = getResolvedStatus(resolvedEntry);

  if (status === ENTRY_STATUS.WORK || status === ENTRY_STATUS.EXTERNAL || status === ENTRY_STATUS.SICK || status === ENTRY_STATUS.VACATION) {
    return true;
  }

  return resolvedEntry?.type === "holiday";
}

function getEmployeeTargetMinutes(employee) {
  if (!employee) return 0;
  return hmToMinutes(employee.target || "0:00");
}

function getEmployeeContractTargetMinutesPerMonth(employee) {
  if (!employee) return 0;

  const individualTargetMinutes = Number(employee.contractTargetMinutesPerMonth);
  if (Number.isFinite(individualTargetMinutes) && individualTargetMinutes > 0) {
    return Math.round(individualTargetMinutes);
  }

  const contractModelTargetMinutes = getContractModelTargetMinutesPerMonth(employee.contractModel || employee.roleKey || "");
  if (Number.isFinite(contractModelTargetMinutes) && contractModelTargetMinutes > 0) {
    return Math.round(contractModelTargetMinutes);
  }

  const weeklyTargetMinutes = getEmployeeTargetMinutes(employee);
  if (weeklyTargetMinutes > 0) {
    return Math.round((weeklyTargetMinutes * 52) / 12);
  }

  return 0;
}

function getEmployeePlannedMinutesForWeek(employee, weekDays = getActiveWeekDays()) {
  if (!employee || !Array.isArray(weekDays)) return 0;

  return weekDays.reduce((sum, day) => {
    if (!day || day.isOutsideMonth) return sum;

    const resolved = getResolvedEntryForEmployeeOnIso(employee, day.iso);
    if (!isCreditableResolvedWorkEntry(resolved)) return sum;

    return sum + Math.max(0, resolved.minutesForMonth || 0);
  }, 0);
}

function getEmployeeAccountMinutesForWeek(employee, weekDays = getActiveWeekDays()) {
  if (!employee || !Array.isArray(weekDays)) return 0;

  return weekDays.reduce((sum, day) => {
    if (!day || day.isOutsideMonth) return sum;

    const resolved = getResolvedEntryForEmployeeOnIso(employee, day.iso);
    const status = getResolvedStatus(resolved);

    if (!isCreditableResolvedAccountEntry(resolved)) {
      return sum;
    }

    if (status === ENTRY_STATUS.VACATION) {
      return sum + getAbsenceMinutesForEmployee(employee);
    }

    if (resolved?.type === "holiday") {
      return sum + Math.max(0, resolved.minutesForMonth || getAbsenceMinutesForEmployee(employee));
    }

    return sum + Math.max(0, resolved.minutesForMonth || 0);
  }, 0);
}

function getEmployeeWeekDifferenceMinutes(employee, weekDays = getActiveWeekDays()) {
  const accountMinutes = getEmployeeAccountMinutesForWeek(employee, weekDays);
  const targetMinutes = getEmployeeTargetMinutes(employee);
  return accountMinutes - targetMinutes;
}

function getEmployeeMinusMinutesForWeek(employee, weekDays = getActiveWeekDays()) {
  const difference = getEmployeeWeekDifferenceMinutes(employee, weekDays);
  return difference < 0 ? Math.abs(difference) : 0;
}

function formatMinuteBalance(differenceMinutes) {
  if (differenceMinutes >= 0) return "0:00";
  return `-${minutesToHM(Math.abs(differenceMinutes))}`;
}


function getEmployeeContractTargetMinutesForDays(employee, days = []) {
  if (!employee || !Array.isArray(days)) return 0;

  const dailyTargetMinutes = getAbsenceMinutesForEmployee(employee);

  return days.reduce((sum, day) => {
    if (!day || day.isOutsideMonth) return sum;
    if (isSundayIsoDate(day.iso)) return sum;
    return sum + dailyTargetMinutes;
  }, 0);
}

function getEmployeeContractTargetMinutesForWeeks(employee, weeks = getCurrentMonthWeeks()) {
  if (!employee || !Array.isArray(weeks)) return 0;

  return getEmployeeContractTargetMinutesPerMonth(employee);
}

function getEmployeeAccountMinutesForWeeks(employee, weeks = getCurrentMonthWeeks()) {
  if (!employee || !Array.isArray(weeks)) return 0;

  return weeks.reduce((sum, week) => {
    if (!Array.isArray(week) || week.length === 0) return sum;
    return sum + getEmployeeAccountMinutesForWeek(employee, week);
  }, 0);
}

function getEmployeeAccountMinutesForMonth(employee, yearMonth = state.activeMonth) {
  if (!employee) return 0;

  const monthWeeks = getWeeksForYearMonth(yearMonth);
  if (!monthWeeks.length) return 0;

  return getEmployeeAccountMinutesForWeeks(employee, monthWeeks);
}

function normalizeYearMonthValue(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return "";
  return trimmed;
}

function getYearMonthFromIsoDate(isoDate) {
  if (typeof isoDate !== "string" || isoDate.length < 7) return "";
  return normalizeYearMonthValue(isoDate.slice(0, 7));
}

function shiftYearMonthByMonths(yearMonth, offsetMonths = 0) {
  const normalized = normalizeYearMonthValue(yearMonth);
  if (!normalized) return "";

  const [year, month] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return "";

  date.setMonth(date.getMonth() + Number(offsetMonths || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getWeeksForYearMonth(yearMonth) {
  const normalized = normalizeYearMonthValue(yearMonth);
  if (!normalized) return [];

  const [year, month] = normalized.split("-").map(Number);
  if (!year || !month) return [];

  return buildMonthPlanFallback(year, month - 1).weeks || [];
}

function getRelevantYearMonthsUntilActiveMonth() {
  const activeYearMonth = normalizeYearMonthValue(state.activeMonth || "") || getYearMonthFromIsoDate(state.weekFrom || "") || getYearMonthFromIsoDate(toIsoDate(new Date()));
  if (!activeYearMonth) return [];

  const candidates = [activeYearMonth];

  Object.keys(state.schedule || {}).forEach((isoDate) => {
    const yearMonth = getYearMonthFromIsoDate(isoDate);
    if (yearMonth && yearMonth <= activeYearMonth) candidates.push(yearMonth);
  });

  (state.absences || []).forEach((entry) => {
    const fromMonth = getYearMonthFromIsoDate(entry?.from || "");
    const toMonth = getYearMonthFromIsoDate(entry?.to || "");

    if (fromMonth && fromMonth <= activeYearMonth) candidates.push(fromMonth);
    if (toMonth && toMonth <= activeYearMonth) candidates.push(toMonth);
  });

  const unique = [...new Set(candidates)].sort();
  if (!unique.length) return [activeYearMonth];

  const first = unique[0];
  const months = [];
  let cursor = first;

  while (cursor && cursor <= activeYearMonth) {
    months.push(cursor);
    cursor = shiftYearMonthByMonths(cursor, 1);
  }

  return months;
}

function getEmployeeRunningBalanceMinutesUntilActiveMonth(employee) {
  if (!employee) return 0;

  return getRelevantYearMonthsUntilActiveMonth().reduce((sum, yearMonth) => {
    const weeks = getWeeksForYearMonth(yearMonth);
    if (!weeks.length) return sum;

    const accountMinutes = getEmployeeAccountMinutesForMonth(employee, yearMonth);
    const contractTargetMinutes = getEmployeeContractTargetMinutesPerMonth(employee);

    return sum + (accountMinutes - contractTargetMinutes);
  }, 0);
}

function getEmployeeTotalMinusMinutes(employee) {
  if (!employee) return 0;

  const runningBalanceMinutes = getEmployeeRunningBalanceMinutesUntilActiveMonth(employee);
  return runningBalanceMinutes < 0 ? Math.abs(runningBalanceMinutes) : 0;
}

function getEmployeeMonthDifferenceMinutes(employee, yearMonth = state.activeMonth) {
  if (!employee) return 0;

  const monthWeeks = getWeeksForYearMonth(yearMonth);
  if (!monthWeeks.length) return 0;

  const accountMinutes = getEmployeeAccountMinutesForMonth(employee, yearMonth);
  const contractTargetMinutes = getEmployeeContractTargetMinutesPerMonth(employee);

  return accountMinutes - contractTargetMinutes;
}

function totalMinutesForDayIso(iso) {
  return state.employees.reduce((sum, emp) => {
    return sum + getResolvedEntryForEmployeeOnIso(emp, iso).minutesForBranch;
  }, 0);
}

function totalMinutesForWeek() {
  const week = getActiveWeekDays();
  return week.reduce((sum, day) => {
    if (day.isOutsideMonth) return sum;
    return sum + totalMinutesForDayIso(day.iso);
  }, 0);
}

function formatIsoDateForFileName(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateTimeForDisplay(isoString) {
  if (!isoString) return "-";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function updateBackupInfoLabel() {
  if (!backupInfoEl) return;

  const meta = loadJson(BACKUP_META_KEY, {});
  if (meta?.lastExportAt) {
    backupInfoEl.textContent = `Letzte Sicherung: ${formatDateTimeForDisplay(meta.lastExportAt)}`;
  } else {
    backupInfoEl.textContent = "";
  }
}

function collectFullBackupSnapshot() {
  return {
    backupVersion: 1,
    app: {
      name: APP_META.name,
      version: APP_META.version
    },
    createdAt: new Date().toISOString(),
    storage: {
      [MASTER_KEY]: loadJson(MASTER_KEY, defaultMasterState()),
      [PLAN_KEY]: loadJson(PLAN_KEY, defaultPlanState()),
      [UI_KEY]: loadUiState(),
      ["wochenplan_dark"]: localStorage.getItem("wochenplan_dark"),
      [BACKUP_MEP_CALIBRATION_KEY]: loadJson(BACKUP_MEP_CALIBRATION_KEY, null)
    }
  };
}

function validateBackupData(backup) {
  if (!backup || typeof backup !== "object") {
    return "Die Sicherungsdatei ist ungültig.";
  }

  if (!backup.storage || typeof backup.storage !== "object") {
    return "Die Sicherungsdatei enthält keine wiederherstellbaren Daten.";
  }

  const requiredKeys = [MASTER_KEY, PLAN_KEY, UI_KEY];
  const missing = requiredKeys.filter((key) => !(key in backup.storage));

  if (missing.length > 0) {
    return `Die Sicherungsdatei ist unvollständig (fehlend: ${missing.join(", ")}).`;
  }

  const master = backup.storage[MASTER_KEY];
  if (!master || typeof master !== "object" || !Array.isArray(master.employees)) {
    return "Die Stammdaten in der Sicherungsdatei sind ungültig.";
  }

  const plan = backup.storage[PLAN_KEY];
  if (!plan || typeof plan !== "object") {
    return "Die Planungsdaten in der Sicherungsdatei sind ungültig.";
  }

  const ui = backup.storage[UI_KEY];
  if (!ui || typeof ui !== "object") {
    return "Die Einstellungen in der Sicherungsdatei sind ungültig.";
  }

  return "";
}

function triggerBackupDownload(snapshot) {
  const payload = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `wochenplan-backup-${formatIsoDateForFileName()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function exportBackup() {
  try {
    saveAppState();

    const snapshot = collectFullBackupSnapshot();
    triggerBackupDownload(snapshot);

    saveJson(BACKUP_META_KEY, {
      lastExportAt: snapshot.createdAt
    });
    updateBackupInfoLabel();

    alert("Sicherung wurde exportiert.");
  } catch (_error) {
    alert("Sicherung konnte nicht exportiert werden.");
  }
}

function importBackupFromObject(backupData) {
  const validationError = validateBackupData(backupData);
  if (validationError) {
    throw new Error(validationError);
  }

  const storage = backupData.storage;

  const preImportSnapshot = {
    savedAt: new Date().toISOString(),
    source: "pre-import",
    storage: {
      [MASTER_KEY]: loadJson(MASTER_KEY, defaultMasterState()),
      [PLAN_KEY]: loadJson(PLAN_KEY, defaultPlanState()),
      [UI_KEY]: loadUiState(),
      ["wochenplan_dark"]: localStorage.getItem("wochenplan_dark"),
      [BACKUP_MEP_CALIBRATION_KEY]: loadJson(BACKUP_MEP_CALIBRATION_KEY, null)
    }
  };

  saveJson(BACKUP_INTERNAL_KEY, preImportSnapshot);
  saveJson(LAST_BACKUP_BEFORE_IMPORT_KEY, preImportSnapshot);

  const masterSaved = saveJson(MASTER_KEY, storage[MASTER_KEY]);
  const planSaved = saveJson(PLAN_KEY, storage[PLAN_KEY]);
  const uiSaved = saveJson(UI_KEY, storage[UI_KEY]);

  try {
    if (storage["wochenplan_dark"] === "true" || storage["wochenplan_dark"] === "false") {
      localStorage.setItem("wochenplan_dark", storage["wochenplan_dark"]);
    } else {
      localStorage.removeItem("wochenplan_dark");
    }

    if (storage[BACKUP_MEP_CALIBRATION_KEY] && typeof storage[BACKUP_MEP_CALIBRATION_KEY] === "object") {
      saveJson(BACKUP_MEP_CALIBRATION_KEY, storage[BACKUP_MEP_CALIBRATION_KEY]);
    } else {
      localStorage.removeItem(BACKUP_MEP_CALIBRATION_KEY);
    }
  } catch {
    // continue: core backup data is already restored as far as possible
  }

  if (!masterSaved || !planSaved || !uiSaved) {
    throw new Error("Die Sicherungsdaten konnten nicht vollständig gespeichert werden.");
  }

  saveJson(BACKUP_META_KEY, {
    lastExportAt: backupData.createdAt || new Date().toISOString(),
    lastImportAt: new Date().toISOString()
  });

  window.location.reload();
}

function handleBackupImportFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = JSON.parse(text);

      importBackupFromObject(parsed);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Die Sicherungsdatei konnte nicht importiert werden.";
      alert(`Import fehlgeschlagen: ${message}`);
    }
  };

  reader.onerror = () => {
    alert("Die ausgewählte Datei konnte nicht gelesen werden.");
  };

  reader.readAsText(file);
}

/* ========= WARNINGS ========= */
function isClosingResolvedEntry(entry) {
  if (!entry || entry.type !== "shift") return false;
  return ["G1", "L1", "L2", "L3", "L4"].includes(entry.code);
}

function getClosingWorkersForIso(iso) {
  return state.employees.filter((emp) => {
    const entry = getScheduleEntry(emp.id, iso);
    return isClosingResolvedEntry(entry);
  });
}

function getDayWarningsByIndex(index) {
  const week = getActiveWeekDays();
  const day = week[index];
  if (!day) return [];

  const warnings = [];
  const closers = getClosingWorkersForIso(day.iso);

  if (closers.length > 2) {
    warnings.push(`⚠ ${day.weekdayLabel}: ${closers.length} Personen bis 19:10. Maximal 2 erlaubt.`);
  }

  return warnings;
}

function getWeekWarnings() {
  const week = getActiveWeekDays();
  return week.slice(0, 6).flatMap((_, index) => getDayWarningsByIndex(index));
}

/* ========= FORM / ORIGINAL HELPERS ========= */
function getFormPauseText(shiftKey) {
  switch (shiftKey) {
    case "G1":
      return "14:00-15:10";
    case "L1":
    case "L2":
      return "16:00-16:10";
    case "L3":
    case "L4":
      return "17:00-17:10";
    default:
      return "";
  }
}

function getFormDataForShift(shiftKey) {
  const shift = getShiftByKey(shiftKey);

  if (!shift.start || !shift.end) {
    return {
      start: "",
      end: "",
      pause: "",
      sum: ""
    };
  }

  return {
    start: shift.start,
    end: shift.end,
    pause: getFormPauseText(shiftKey),
    sum: minutesToHM(netMinutesForShift(shiftKey))
  };
}

/* ========= RENDER BASICS ========= */
function renderTeamSectionVisibility() {
  teamSectionEl.classList.toggle("hidden", !!uiState.teamCollapsed);
  btnToggleTeamEl.textContent = uiState.teamCollapsed ? "Team einblenden" : "Team ausblenden";
}

function isWeekViewActive() {
  return (uiState.currentView || "week") === "week";
}

function renderTopbarVisibility() {
  const isWeek = isWeekViewActive();

  if (viewMetaLineEl) {
    viewMetaLineEl.classList.toggle("hidden", !isWeek);
  }

  if (btnResetWeekEl) {
    btnResetWeekEl.classList.toggle("hidden", !isWeek);
  }
}

function renderView() {
  const view = uiState.currentView || "week";

  dayViewEl.classList.toggle("hidden", view !== "day");
  weekViewEl.classList.toggle("hidden", view !== "week");
  monthViewEl.classList.toggle("hidden", view !== "month");
  formViewEl.classList.toggle("hidden", view !== "form");
  mepTemplateViewEl.classList.toggle("hidden", view !== "mep");

  btnViewDayEl.classList.toggle("active", view === "day");
  btnViewWeekEl.classList.toggle("active", view === "week");
  btnViewMonthEl.classList.toggle("active", view === "month");
  btnViewFormEl.classList.toggle("active", view === "form");
  btnViewMepEl.classList.toggle("active", view === "mep");

  renderTopbarVisibility();
  requestActiveResponsiveViewRefresh();
}

function renderTeamSetup() {
  if (!teamListEl) return;

  teamListEl.innerHTML = "";

  state.employees.forEach((emp, idx) => {
    const row = document.createElement("div");
    row.className = "teamRow";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = `Mitarbeiter ${idx + 1}`;
    nameInput.value = emp.name;
    nameInput.addEventListener("change", () => {
      emp.name = nameInput.value;
      saveAppStateDebounced();
      renderAllViews();
    });

    const roleSel = document.createElement("select");
    ROLE_OPTIONS.forEach((role) => {
      const opt = document.createElement("option");
      opt.value = role.key;
      opt.textContent = role.label;
      roleSel.appendChild(opt);
    });
    roleSel.value = emp.roleKey;
    roleSel.addEventListener("change", () => {
      emp.roleKey = roleSel.value;
      emp.target = roleToTarget(emp.roleKey);
      emp.contractModel = roleToContractModel(emp.roleKey);
      saveAppStateDebounced();
      renderAllViews();
    });

    const targetInput = document.createElement("input");
    targetInput.type = "text";
    targetInput.placeholder = "Soll";
    targetInput.value = emp.target || "";
    targetInput.addEventListener("change", () => {
      emp.target = targetInput.value;
      saveAppStateDebounced();
      renderAllViews();
    });

    const vacationInput = document.createElement("input");
vacationInput.type = "number";
vacationInput.min = "0";
vacationInput.max = "36";
vacationInput.placeholder = "Urlaub";
vacationInput.value = Number(emp.totalVacationDays ?? emp.vacationDays ?? 30);

vacationInput.addEventListener("change", () => {
  const raw = Number(vacationInput.value || 0);
  const clamped = Math.max(0, Math.min(36, raw));

  emp.totalVacationDays = clamped;
  emp.vacationDays = clamped;
  emp.remainingVacationDays = clamped - Number(emp.usedVacationDays ?? 0);
  vacationInput.value = clamped;

  saveAppStateDebounced();
  renderAllViews();
});

    const usedVacationInfo = document.createElement("input");
    usedVacationInfo.type = "text";
    usedVacationInfo.value = String(Number(emp.usedVacationDays ?? 0));
    usedVacationInfo.title = "Genommene Urlaubstage";
    usedVacationInfo.readOnly = true;

    const remainingVacationInfo = document.createElement("input");
    remainingVacationInfo.type = "text";
    remainingVacationInfo.value = String(Number(emp.remainingVacationDays ?? 0));
    remainingVacationInfo.title = "Resturlaub";
    remainingVacationInfo.readOnly = true;
    

    const birthDateInput = document.createElement("input");
    birthDateInput.type = "date";
    birthDateInput.value = emp.birthDate || "";
    birthDateInput.addEventListener("change", () => {
      emp.birthDate = birthDateInput.value;
      saveAppStateDebounced();
      renderAllViews();
    });
    const serviceBonusInput = document.createElement("input");
serviceBonusInput.type = "checkbox";
serviceBonusInput.checked = Boolean(emp.serviceBonus);
serviceBonusInput.title = "10 Jahre Betriebszugehörigkeit";

serviceBonusInput.addEventListener("change", () => {
  emp.serviceBonus = serviceBonusInput.checked;
  saveAppStateDebounced();
  renderAllViews();
});

    row.appendChild(nameInput);
    row.appendChild(roleSel);
    row.appendChild(targetInput);
    row.appendChild(vacationInput);
    row.appendChild(usedVacationInfo);
    row.appendChild(remainingVacationInfo);
    row.appendChild(birthDateInput);
    row.appendChild(serviceBonusInput);

    teamListEl.appendChild(row);
    });
}
function renderSummary() {
  const totalWeek = totalMinutesForWeek();
  const rest = MAX_WEEKLY_MINUTES - totalWeek;

  weeklyHoursActualEl.textContent = minutesToHM(totalWeek);
  weeklyHoursRemainingEl.textContent = minutesToHM(Math.abs(rest));
  weeklyHoursStatusEl.textContent = rest >= 0 ? "Noch frei" : "Überplant";

  if (mepWeekFromEl) mepWeekFromEl.textContent = state.weekFrom || "____________";
  if (mepWeekToEl) mepWeekToEl.textContent = state.weekTo || "____________";
  if (mepMonthYearEl) mepMonthYearEl.textContent = formatMonthYear(state.weekFrom);
}

function renderAllViews() {
  renderSummary();

  if (typeof renderDayView === "function") renderDayView();
  if (typeof renderWeekView === "function") renderWeekView();
  if (typeof renderMonthView === "function") renderMonthView();
  if (typeof renderFormView === "function") renderFormView();
  if (typeof renderMepTemplateView === "function") renderMepTemplateView();
  requestActiveResponsiveViewRefresh();
}

function renderAll() {
  syncMonthPlanToState();
  syncWeekRangeFromActiveWeek();
  renderTeamSectionVisibility();
  renderView();
  renderTeamSetup();
  renderAllViews();
  updateResponsiveViewportMetrics();
}

/* ========= EVENTS ========= */
if (btnPrevWeekEl) {
  btnPrevWeekEl.addEventListener("click", () => {
    shiftActiveWeek(-7);
  });
}

if (btnNextWeekEl) {
  btnNextWeekEl.addEventListener("click", () => {
    shiftActiveWeek(7);
  });
}

if (btnCurrentWeekEl) {
  btnCurrentWeekEl.addEventListener("click", () => {
    const today = new Date();
    state.weekFrom = toIsoDate(today);
    state.activeMonth = state.weekFrom.slice(0, 7);

    syncMonthPlanToState();
    syncWeekRangeFromActiveWeek();
    commitPlanChange();
  });
}
if (weekFromEl) {
  weekFromEl.addEventListener("change", () => {
    state.weekFrom = weekFromEl.value;
    syncMonthPlanToState();
    syncWeekRangeFromActiveWeek();
    saveAppStateDebounced();
    renderAllViews();
  });
}

if (weekToEl) {
  weekToEl.addEventListener("change", () => {
    state.weekTo = weekToEl.value;
    saveAppStateDebounced();
    renderAllViews();
  });
}

if (btnToggleTeamEl) {
  btnToggleTeamEl.addEventListener("click", () => {
    uiState.teamCollapsed = !uiState.teamCollapsed;
    saveAppStateDebounced();
    renderTeamSectionVisibility();
  });
}

if (btnViewDayEl) {
  btnViewDayEl.addEventListener("click", () => {
    uiState.currentView = "day";
    saveAppStateDebounced();
    renderView();
    renderAllViews();
  });
}

if (btnViewMonthEl) {
  btnViewMonthEl.addEventListener("click", () => {
    uiState.currentView = "month";
    saveAppStateDebounced();
    renderView();
    renderAllViews();
  });
}

if (btnViewWeekEl) {
  btnViewWeekEl.addEventListener("click", () => {
    uiState.currentView = "week";
    saveAppStateDebounced();
    renderView();
    renderAllViews();
  });
}

if (btnViewFormEl) {
  btnViewFormEl.addEventListener("click", () => {
    uiState.currentView = "form";
    saveAppStateDebounced();
    renderView();
    renderAllViews();
  });
}

if (btnViewMepEl) {
  btnViewMepEl.addEventListener("click", () => {
    uiState.currentView = "mep";
    saveAppStateDebounced();
    renderView();
    renderAllViews();
  });
}

document.getElementById("btnSaveMaster")?.addEventListener("click", () => {
  const ok = saveAppState();
  alert(ok ? "Stammdaten gespeichert." : "Speichern fehlgeschlagen.");
});
document.getElementById("btnResetWeek")?.addEventListener("click", () => {
  const weekDays = getActiveWeekDays();
  if (!weekDays.length) return;

  if (!confirm("Aktuell ausgewählte Woche leeren? Stammdaten bleiben erhalten.")) return;

  const weekIsos = weekDays.map((day) => day.iso);
  const weekStart = weekIsos[0];
  const weekEnd = weekIsos[weekIsos.length - 1];

  weekIsos.forEach((isoDate) => {
    delete state.schedule[isoDate];
  });

  state.absences = (state.absences || []).flatMap((entry) => {
    if (!entry) return [];

    const hasOverlap = !(entry.to < weekStart || entry.from > weekEnd);
    if (!hasOverlap) return [entry];

    return subtractRangeFromAbsenceEntry(entry, weekStart, weekEnd);
  });

  commitPlanChange();
  renderAll();
});
document.getElementById("btnPrint")?.addEventListener("click", () => {
  window.print();
});

btnExportBackupEl?.addEventListener("click", () => {
  exportBackup();
});

btnImportBackupEl?.addEventListener("click", () => {
  if (!backupFileInputEl) return;

  flushPendingAutoSave();
  saveAppState();

  if (!confirm("Der aktuelle Stand wird überschrieben. Import jetzt durchführen?")) {
    return;
  }

  backupFileInputEl.value = "";
  backupFileInputEl.click();
});

backupFileInputEl?.addEventListener("change", () => {
  const file = backupFileInputEl.files?.[0];
  if (!file) return;

  handleBackupImportFile(file);
});


/* ========= DARK MODE ========= */

const btnDarkMode = document.getElementById("btnDarkMode");

function updateDarkModeButton() {
  if (!btnDarkMode) return;
  btnDarkMode.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

btnDarkMode?.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  try {
    localStorage.setItem(
      "wochenplan_dark",
      document.body.classList.contains("dark")
    );
  } catch {
    updateSaveStatus("Theme konnte nicht gespeichert werden", { isError: true, hideAfterMs: 3000 });
  }

  updateDarkModeButton();
});

/* ========= INIT ========= */
window.addEventListener("load", () => {
  updateResponsiveViewportMetrics();

  if (!state.weekFrom) {
    const today = new Date();
    state.weekFrom = toIsoDate(today);
  }

  if (!state.activeMonth) {
    state.activeMonth = (state.weekFrom || toIsoDate(new Date())).slice(0, 7);
  }

  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem("wochenplan_dark");
  } catch {
    savedTheme = null;
  }

  if (savedTheme === "true") {
    document.body.classList.add("dark");
  } else if (savedTheme === "false") {
    document.body.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.body.classList.add("dark");
    }
  }

  updateDarkModeButton();
  updateBackupInfoLabel();
  refreshSaveStatusLabel();

  if (typeof bindMonthNavigation === "function") {
    bindMonthNavigation();
  }

  syncVacationScheduleFromAbsences();
  refreshEmployeeVacationCounters();
  syncMonthPlanToState();
  syncWeekRangeFromActiveWeek();
  renderAll();
});

window.addEventListener("resize", scheduleResponsiveViewRefresh, { passive: true });
window.addEventListener("orientationchange", scheduleResponsiveViewRefresh, { passive: true });
window.addEventListener("pageshow", scheduleResponsiveViewRefresh, { passive: true });

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", scheduleResponsiveViewRefresh, { passive: true });
  window.visualViewport.addEventListener("scroll", scheduleResponsiveViewRefresh, { passive: true });
}
window.addEventListener("beforeunload", () => {
  flushPendingAutoSave();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushPendingAutoSave();
  }
});

// DEBUG toggle with key "D"
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "d") {
    const root = document.documentElement;
    const active = root.getAttribute("data-debug") === "1";
    root.setAttribute("data-debug", active ? "0" : "1");
  }
});
