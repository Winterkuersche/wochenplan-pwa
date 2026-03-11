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
  { key: "", label: "-", target: "" },
  { key: "TL", label: "TL", target: "30:00" },
  { key: "TZ30", label: "TZ30", target: "30:00" },
  { key: "TZ20", label: "TZ20", target: "20:00" },
  { key: "TZ15", label: "TZ15", target: "15:00" },
  { key: "GFB", label: "GfB", target: "9:30" }
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
const MAX_WEEKLY_MINUTES = 159 * 60;

let currentDayIndex = 0;
let uiState = loadUiState();
let state = buildInitialState();
state.schedule = state.schedule || {};
state.absences = state.absences || [];
rebuildScheduleFromLegacyShifts();

/* ========= PLAN API ========= */

function ensureScheduleDay(isoDate) {
  if (!state.schedule) state.schedule = {};
  if (!state.schedule[isoDate]) state.schedule[isoDate] = {};
  return state.schedule[isoDate];
}

function cleanupScheduleDay(isoDate) {
  const day = state.schedule?.[isoDate];
  if (!day) return;

  if (Object.keys(day).length === 0) {
    delete state.schedule[isoDate];
  }
}

function getScheduleEntry(employeeId, isoDate) {
  return state.schedule?.[isoDate]?.[employeeId] || null;
}

function updateEmployeeDay(employeeId, isoDate, updater, options = {}) {
  if (!employeeId || !isoDate || typeof updater !== "function") return null;

  const { commit = true } = options;
  const currentEntry = getScheduleEntry(employeeId, isoDate);
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

  const day = ensureScheduleDay(isoDate);
  day[employeeId] = { ...nextEntry };

  if (commit) {
    commitPlanChange();
  }

  return day[employeeId];
}

function setScheduleEntry(employeeId, isoDate, entry) {
  if (!employeeId || !isoDate || !entry) return;
  return updateEmployeeDay(employeeId, isoDate, () => ({ ...entry }));
}

function clearScheduleEntry(employeeId, isoDate) {
  if (!employeeId || !isoDate) return;
  return updateEmployeeDay(employeeId, isoDate, () => null);
}

function setShift(employeeId, isoDate, entry) {
  if (!entry || entry.type !== "shift") return;
  setScheduleEntry(employeeId, isoDate, entry);
}

function setExternalHelp(employeeId, isoDate, branch, minutes) {
  setScheduleEntry(employeeId, isoDate, {
    type: "external-help",
    label: "AH",
    branch,
    minutes
  });
}

function setAbsence(employeeId, from, to, type, note = "") {
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

  commitPlanChange();

  return absence;
}

function removeAbsence(absenceId) {
  state.absences = state.absences.filter((a) => a.id !== absenceId);

  commitPlanChange();
}
function clearDay(employeeId, isoDate, options = {}) {
  if (!employeeId || !isoDate) return;

  const { commit = true } = options;

  const emp = state.employees.find((e) => e.id === employeeId);
  if (emp?.shifts) {
    delete emp.shifts[isoDate];
  }

  if (state.schedule?.[isoDate]?.[employeeId]) {
    delete state.schedule[isoDate][employeeId];
    cleanupScheduleDay(isoDate);
  }

  removeAbsenceCoverageForEmployee(employeeId, isoDate, isoDate);

  if (commit) {
    commitPlanChange();
  }
}
function commitPlanChange() {
  savePlanData();
  renderAllViews();
}
/* ========= DOM ========= */
const teamListEl = document.getElementById("teamList");
const dayTabsEl = document.getElementById("dayTabs");
const plannerListEl = document.getElementById("plannerList");
const metaDayNameEl = document.getElementById("metaDayName");
const lateCountInfoEl = document.getElementById("lateCountInfo");
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
const dayHoursActualEl = document.getElementById("dayHoursActual");
const dayHoursSubEl = document.getElementById("dayHoursSub");

const dayViewEl = document.getElementById("dayView");
const weekViewEl = document.getElementById("weekView");
const monthViewEl = document.getElementById("monthView");
const formViewEl = document.getElementById("formView");

const btnViewDayEl = document.getElementById("btnViewDay");
const btnViewWeekEl = document.getElementById("btnViewWeek");
const btnViewMonthEl = document.getElementById("btnViewMonth");
const btnViewFormEl = document.getElementById("btnViewForm");

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

/* ========= STORAGE ========= */
function loadJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultUiState() {
  return {
    teamCollapsed: false,
    currentView: "week"
  };
}

function loadUiState() {
  const raw = localStorage.getItem(UI_KEY);
  if (!raw) return defaultUiState();

  try {
    return { ...defaultUiState(), ...JSON.parse(raw) };
  } catch {
    return defaultUiState();
  }
}

function saveUiState() {
  saveJson(UI_KEY, uiState);
}

/* ========= DEFAULT DATA ========= */
function createDefaultEmployees() {
  return [
    { id: "emp_1", name: "Stephan M", roleKey: "TL", target: "30:00", shifts: {} },
    { id: "emp_2", name: "Mitarbeiter 2", roleKey: "TZ30", target: "30:00", shifts: {} },
    { id: "emp_3", name: "Mitarbeiter 3", roleKey: "TZ20", target: "20:00", shifts: {} },
    { id: "emp_4", name: "Mitarbeiter 4", roleKey: "TZ15", target: "15:00", shifts: {} },
    { id: "emp_5", name: "Mitarbeiter 5", roleKey: "TZ20", target: "20:00", shifts: {} },
    { id: "emp_6", name: "", roleKey: "", target: "", shifts: {} },
    { id: "emp_7", name: "", roleKey: "", target: "", shifts: {} },
    { id: "emp_8", name: "", roleKey: "", target: "", shifts: {} },
    { id: "emp_9", name: "", roleKey: "", target: "", shifts: {} },
    { id: "emp_10", name: "", roleKey: "", target: "", shifts: {} },
    { id: "emp_11", name: "", roleKey: "", target: "", shifts: {} },
    { id: "emp_12", name: "", roleKey: "", target: "", shifts: {} },
    { id: "emp_13", name: "", roleKey: "", target: "", shifts: {} }
  ];
}

function defaultMasterState() {
  return {
    employees: createDefaultEmployees().map((emp) => ({
      id: emp.id,
      name: emp.name,
      roleKey: emp.roleKey,
      target: emp.target
    }))
  };
}

function defaultPlanState() {
  return {
    weekFrom: "",
    weekTo: "",
    schedule: {},
    absences: [],
    shiftsByEmployee: {}
  };
}

function buildInitialState() {
  const master = loadJson(MASTER_KEY, defaultMasterState());
  const plan = loadJson(PLAN_KEY, defaultPlanState());

  const baseEmployees = Array.isArray(master.employees)
    ? master.employees
    : defaultMasterState().employees;

  const employees = baseEmployees.map((emp, index) => {
    const legacyShifts = { ...(plan.shiftsByEmployee?.[emp.id] || {}) };

    return {
      id: emp.id || `emp_${index + 1}`,
      name: emp.name || "",
      roleKey: emp.roleKey || "",
      target: emp.target || roleToTarget(emp.roleKey || ""),
      shifts: legacyShifts
    };
  });

  const schedule = plan.schedule && typeof plan.schedule === "object"
    ? { ...plan.schedule }
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
function rebuildScheduleFromLegacyShifts() {
  const nextSchedule = {};

  // Neue schedule-Einträge behalten
  Object.entries(state.schedule || {}).forEach(([isoDate, dayEntries]) => {
    Object.entries(dayEntries || {}).forEach(([employeeId, entry]) => {
      if (!entry) return;

      if (entry.type === "shift" || entry.type === "external-help") {
        if (!nextSchedule[isoDate]) nextSchedule[isoDate] = {};
        nextSchedule[isoDate][employeeId] = { ...entry };
      }
    });
  });

  // Legacy-Schichten aus emp.shifts ergänzen/aktualisieren
  state.employees.forEach((emp) => {
    const shifts = emp.shifts || {};

    Object.entries(shifts).forEach(([isoDate, shiftKey]) => {
      if (!shiftKey || shiftKey === "-") {
        return;
      }

      let entry = null;

      if (shiftKey === "F3" || shiftKey === "F4" || shiftKey === "F5" || shiftKey === "F6") {
        entry = buildEarlyShiftEntry(shiftKey);
      } else if (["L1", "L2", "L3", "L4"].includes(shiftKey)) {
        const startMap = {
          L1: "13:00",
          L2: "14:00",
          L3: "15:00",
          L4: "16:00"
        };
        entry = buildLateShiftEntry(startMap[shiftKey], true);
      } else if (["L1E", "L2E", "L3E", "L4E"].includes(shiftKey)) {
        const startMap = {
          L1E: "13:00",
          L2E: "14:00",
          L3E: "15:00",
          L4E: "16:00"
        };
        entry = buildLateShiftEntry(startMap[shiftKey], false);
      } else if (shiftKey === "G1") {
        entry = buildFullShiftEntry(true);
      }

      if (!entry) return;

      if (!nextSchedule[isoDate]) nextSchedule[isoDate] = {};
      nextSchedule[isoDate][emp.id] = entry;
    });
  });

  state.schedule = nextSchedule;
}

function saveMasterData() {
  saveJson(MASTER_KEY, {
    employees: state.employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      roleKey: emp.roleKey,
      target: emp.target
    }))
  });
}

function savePlanData() {
  const shiftsByEmployee = {};
  state.employees.forEach((emp) => {
    shiftsByEmployee[emp.id] = { ...emp.shifts };
  });

  rebuildScheduleFromLegacyShifts();

  saveJson(PLAN_KEY, {
    weekFrom: state.weekFrom,
    weekTo: state.weekTo,
    schedule: state.schedule || {},
    absences: state.absences || [],
    shiftsByEmployee
  });
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

/* ========= SHIFT HELPERS ========= */
function getShiftByKey(key) {
  return SHIFTS.find((s) => s.key === key) || SHIFTS[0];
}

function getShiftClassByKey(key) {
  return getShiftByKey(key).type || "free";
}

function getShiftForEmployeeOnIso(emp, iso) {
  return emp.shifts?.[iso] || "-";
}

function setShiftForEmployeeOnIso(emp, iso, shiftKey) {
  if (!emp.shifts) emp.shifts = {};
  emp.shifts[iso] = shiftKey;
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

function isClosingShift(shiftKey) {
  return ["G1", "L1", "L2", "L3", "L4"].includes(shiftKey);
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

  if (closers.length === 0) {
    warnings.push(`⚠ ${day.weekdayLabel}: keine Schicht bis 19:10.`);
  }

  if (closers.length > 2) {
    warnings.push(`⚠ ${day.weekdayLabel}: ${closers.length} Personen bis 19:10. Maximal 2 erlaubt.`);
  }

  if (index < 5 && closers.length > 0) {
    const nextDay = week[index + 1];
    const hasAnchor = closers.some((emp) => getShiftForEmployeeOnIso(emp, nextDay.iso) !== "-");

    if (!hasAnchor) {
      warnings.push(`⚠ ${nextDay.weekdayLabel}: niemand vom ${day.weekdayLabel}-Abschluss eingeplant.`);
    }
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

function renderView() {
  const view = uiState.currentView || "week";

  dayViewEl.classList.toggle("hidden", view !== "day");
  weekViewEl.classList.toggle("hidden", view !== "week");
  monthViewEl.classList.toggle("hidden", view !== "month");
  formViewEl.classList.toggle("hidden", view !== "form");

  btnViewDayEl.classList.toggle("active", view === "day");
  btnViewWeekEl.classList.toggle("active", view === "week");
  btnViewMonthEl.classList.toggle("active", view === "month");
  btnViewFormEl.classList.toggle("active", view === "form");
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
      saveMasterData();
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
      saveMasterData();
      renderAllViews();
    });

    const targetInput = document.createElement("input");
    targetInput.type = "text";
    targetInput.placeholder = "Soll";
    targetInput.value = emp.target || "";
    targetInput.addEventListener("change", () => {
      emp.target = targetInput.value;
      saveMasterData();
      renderAllViews();
    });

    row.appendChild(nameInput);
    row.appendChild(roleSel);
    row.appendChild(targetInput);

    teamListEl.appendChild(row);
  });
}

function renderSummary() {
  const totalWeek = totalMinutesForWeek();
  const rest = MAX_WEEKLY_MINUTES - totalWeek;
  const dayObj = getCurrentDayObject();
  const dayMinutes = dayObj ? totalMinutesForDayIso(dayObj.iso) : 0;
  const closers = dayObj ? getClosingWorkersForIso(dayObj.iso).length : 0;

  weeklyHoursActualEl.textContent = minutesToHM(totalWeek);
  weeklyHoursRemainingEl.textContent = minutesToHM(Math.abs(rest));
  weeklyHoursStatusEl.textContent = rest >= 0 ? "Noch frei" : "Überplant";

  dayHoursActualEl.textContent = minutesToHM(dayMinutes);
  dayHoursSubEl.textContent = dayObj ? dayObj.weekdayLabel : "—";
  lateCountInfoEl.textContent = `${closers} / 2`;

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
}

function renderAll() {
  syncMonthPlanToState();
  syncWeekRangeFromActiveWeek();
  renderTeamSectionVisibility();
  renderView();
  renderTeamSetup();
  renderAllViews();
}

/* ========= EVENTS ========= */
if (weekFromEl) {
  weekFromEl.addEventListener("change", () => {
    state.weekFrom = weekFromEl.value;
    syncMonthPlanToState();
    syncWeekRangeFromActiveWeek();
    savePlanData();
    renderAllViews();
  });
}

if (weekToEl) {
  weekToEl.addEventListener("change", () => {
    state.weekTo = weekToEl.value;
    savePlanData();
    renderAllViews();
  });
}

if (btnToggleTeamEl) {
  btnToggleTeamEl.addEventListener("click", () => {
    uiState.teamCollapsed = !uiState.teamCollapsed;
    saveUiState();
    renderTeamSectionVisibility();
  });
}

if (btnViewDayEl) {
  btnViewDayEl.addEventListener("click", () => {
    uiState.currentView = "day";
    saveUiState();
    renderView();
    renderAllViews();
  });
}

if (btnViewMonthEl) {
  btnViewMonthEl.addEventListener("click", () => {
    uiState.currentView = "month";
    saveUiState();
    renderView();
    renderAllViews();
  });
}

if (btnViewWeekEl) {
  btnViewWeekEl.addEventListener("click", () => {
    uiState.currentView = "week";
    saveUiState();
    renderView();
    renderAllViews();
  });
}

if (btnViewFormEl) {
  btnViewFormEl.addEventListener("click", () => {
    uiState.currentView = "form";
    saveUiState();
    renderView();
    renderAllViews();
  });
}

document.getElementById("btnSaveMaster")?.addEventListener("click", () => {
  saveMasterData();
  alert("Stammdaten gespeichert.");
});
document.getElementById("btnResetWeek")?.addEventListener("click", () => {
  if (!confirm("Wochen-/Monatsplan leeren? Stammdaten bleiben erhalten.")) return;

  state.employees.forEach((emp) => {
    emp.shifts = {};
  });

  state.schedule = {};
  state.absences = [];

  savePlanData();
  renderAll();
});
document.getElementById("btnPrint")?.addEventListener("click", () => {
  window.print();
});



/* ========= DARK MODE ========= */

const btnDarkMode = document.getElementById("btnDarkMode");

function updateDarkModeButton() {
  if (!btnDarkMode) return;
  btnDarkMode.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

btnDarkMode?.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "wochenplan_dark",
    document.body.classList.contains("dark")
  );

  updateDarkModeButton();
});

/* ========= INIT ========= */
window.addEventListener("load", () => {
  if (!state.weekFrom) {
    const today = new Date();
    state.weekFrom = toIsoDate(today);
  }

  if (!state.activeMonth) {
    state.activeMonth = (state.weekFrom || toIsoDate(new Date())).slice(0, 7);
  }

  const savedTheme = localStorage.getItem("wochenplan_dark");

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
  syncMonthPlanToState();
  syncWeekRangeFromActiveWeek();
  renderAll();
});
