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
  { key: "", label: "-" },
  { key: "TL", label: "TL", target: "30:00" },
  { key: "TZ30", label: "TZ30", target: "30:00" },
  { key: "TZ20", label: "TZ20", target: "20:00" },
  { key: "TZ15", label: "TZ15", target: "15:00" },
  { key: "GFB", label: "GfB", target: "9:30" }
];

const SHIFTS = [
  { key: "-", label: "-", start: "", end: "", desc: "frei", type: "free" },
  { key: "F3", label: "F3", start: "09:00", end: "12:00", desc: "09:00-12:00", type: "early" },
  { key: "F4", label: "F4", start: "09:00", end: "13:00", desc: "09:00-13:00", type: "early" },
  { key: "F5", label: "F5", start: "09:00", end: "14:00", desc: "09:00-14:00", type: "early" },
  { key: "F6", label: "F6", start: "09:00", end: "15:00", desc: "09:00-15:00", type: "early" },
  { key: "G1", label: "G1", start: "09:00", end: "19:10", desc: "09:00-19:10", type: "full" },
  { key: "L1", label: "L1", start: "13:00", end: "19:10", desc: "13:00-19:10", type: "late" },
  { key: "L2", label: "L2", start: "14:00", end: "19:10", desc: "14:00-19:10", type: "late" },
  { key: "L3", label: "L3", start: "15:00", end: "19:10", desc: "15:00-19:10", type: "late" },
  { key: "L4", label: "L4", start: "16:00", end: "19:10", desc: "16:00-19:10", type: "late" },
  { key: "L1E", label: "L1E", start: "13:00", end: "19:00", desc: "13:00-19:00", type: "lateNo" },
  { key: "L2E", label: "L2E", start: "14:00", end: "19:00", desc: "14:00-19:00", type: "lateNo" },
  { key: "L3E", label: "L3E", start: "15:00", end: "19:00", desc: "15:00-19:00", type: "lateNo" },
  { key: "L4E", label: "L4E", start: "16:00", end: "19:00", desc: "16:00-19:00", type: "lateNo" }
];

const MASTER_KEY = "wochenplan_master_v2";
const PLAN_KEY = "wochenplan_monthplan_v1";
const UI_KEY = "wochenplan_ui_v8";
const MAX_WEEKLY_MINUTES = 159 * 60;

let currentDayIndex = 0;
let uiState = loadUiState();
let state = buildInitialState();

/* ========= DOM ========= */
const teamListEl = document.getElementById("teamList");
const dayTabsEl = document.getElementById("dayTabs");
const plannerListEl = document.getElementById("plannerList");
const metaDayNameEl = document.getElementById("metaDayName");
const lateCountInfoEl = document.getElementById("lateCountInfo");
const dayWarningsEl = document.getElementById("dayWarnings");
const dayHoursInfoEl = document.getElementById("dayHoursInfo");
const weekTableBodyEl = document.getElementById("weekTableBody");
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
const formViewEl = document.getElementById("formView");
const btnViewDayEl = document.getElementById("btnViewDay");
const btnViewWeekEl = document.getElementById("btnViewWeek");
const btnViewFormEl = document.getElementById("btnViewForm");
const weekWarningsEl = document.getElementById("weekWarnings");

/* ========= BASICS ========= */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function isoToDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function roleToTarget(roleKey) {
  const found = ROLE_OPTIONS.find((r) => r.key === roleKey);
  return found?.target || "";
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
  return d.toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" });
}

/* ========= STORAGE ========= */
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
  localStorage.setItem(UI_KEY, JSON.stringify(uiState));
}

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

/* ========= STATE ========= */
function createDefaultEmployees() {
  return Array.from({ length: 13 }, (_, i) => ({
    id: `emp_${i + 1}`,
    name: i === 0 ? "Stephan M" : `Mitarbeiter ${i + 1}`,
    roleKey: i === 0 ? "TL" : i === 1 ? "TZ30" : i === 2 ? "TZ20" : i === 3 ? "TZ15" : i === 4 ? "TZ20" : "",
    target: i === 0 ? "30:00" : i === 1 ? "30:00" : i === 2 ? "20:00" : i === 3 ? "15:00" : i === 4 ? "20:00" : ""
  }));
}

function defaultMasterState() {
  return {
    employees: createDefaultEmployees()
  };
}

function defaultPlanState() {
  return {
    weekFrom: "",
    weekTo: "",
    shiftsByEmployee: {}
  };
}

function buildInitialState() {
  const master = loadJson(MASTER_KEY, defaultMasterState());
  const plan = loadJson(PLAN_KEY, defaultPlanState());

  const employees = Array.isArray(master.employees) ? master.employees.slice(0, 13) : createDefaultEmployees();
  while (employees.length < 13) {
    const i = employees.length;
    employees.push({
      id: `emp_${i + 1}`,
      name: `Mitarbeiter ${i + 1}`,
      roleKey: "",
      target: ""
    });
  }

  return {
    weekFrom: plan.weekFrom || "",
    weekTo: plan.weekTo || "",
    monthPlan: null,
    employees: employees.map((emp, index) => ({
      id: emp.id || `emp_${index + 1}`,
      name: emp.name || "",
      roleKey: emp.roleKey || "",
      target: emp.target || roleToTarget(emp.roleKey || ""),
      shifts: plan.shiftsByEmployee?.[emp.id] || {}
    }))
  };
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

  saveJson(PLAN_KEY, {
    weekFrom: state.weekFrom,
    weekTo: state.weekTo,
    shiftsByEmployee
  });
}

/* ========= MONTH / WEEK ========= */
function getActiveMonthPlan() {
  const startStr = state.weekFrom || weekFromEl?.value || "";
  if (!startStr || typeof getMonthPlanFromDateString !== "function") return null;
  return getMonthPlanFromDateString(startStr);
}

function syncMonthPlanToState() {
  state.monthPlan = getActiveMonthPlan();
  return state.monthPlan;
}

function getCurrentMonthWeeks() {
  return state.monthPlan?.weeks || [];
}

function getActiveWeekDays() {
  const iso = state.weekFrom || weekFromEl?.value || "";
  if (!iso) return [];

  const weeks = getCurrentMonthWeeks();
  for (const week of weeks) {
    if (week.some((day) => day.iso === iso)) {
      return week;
    }
  }

  return weeks[0] || [];
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

/* ========= SHIFTS ========= */
function getShiftByKey(key) {
  return SHIFTS.find((s) => s.key === key) || SHIFTS[0];
}

function getShiftClassByKey(key) {
  return getShiftByKey(key).type || "free";
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

function getShiftForEmployeeOnIso(emp, iso) {
  return emp.shifts?.[iso] || "-";
}

function setShiftForEmployeeOnIso(emp, iso, shiftKey) {
  if (!emp.shifts) emp.shifts = {};
  emp.shifts[iso] = shiftKey;
}

/* ========= CALC ========= */
function totalMinutesForEmployeeInWeek(emp, weekDays) {
  return weekDays.reduce((sum, day) => sum + netMinutesForShift(getShiftForEmployeeOnIso(emp, day.iso)), 0);
}

function totalMinutesForEmployee(emp) {
  return totalMinutesForEmployeeInWeek(emp, getActiveWeekDays());
}

function deltaMinutes(emp) {
  return totalMinutesForEmployee(emp) - hmToMinutes(emp.target || "0:00");
}

function totalMinutesForDayIso(iso) {
  return state.employees.reduce((sum, emp) => sum + netMinutesForShift(getShiftForEmployeeOnIso(emp, iso)), 0);
}

function totalMinutesForDay(dayKeyOrIndex) {
  if (typeof dayKeyOrIndex === "number") {
    const day = getDayObjectByIndex(dayKeyOrIndex);
    return day ? totalMinutesForDayIso(day.iso) : 0;
  }

  const day = DAYS.findIndex((d) => d.key === dayKeyOrIndex);
  return totalMinutesForDay(day);
}

function totalMinutesForWeek() {
  const week = getActiveWeekDays();
  return state.employees.reduce((sum, emp) => sum + totalMinutesForEmployeeInWeek(emp, week), 0);
}

/* ========= WARNINGS ========= */
function getClosingWorkersForIso(iso) {
  return state.employees.filter((emp) => isClosingShift(getShiftForEmployeeOnIso(emp, iso)));
}

function getDayWarningsByIndex(index) {
  const week = getActiveWeekDays();
  const day = week[index];
  if (!day) return [];

  const warnings = [];
  const closers = getClosingWorkersForIso(day.iso);
  const dayLabel = day.weekdayLabel;

  if (closers.length === 0) {
    warnings.push(`⚠ ${dayLabel}: keine Schicht bis 19:10.`);
  }

  if (closers.length > 2) {
    warnings.push(`⚠ ${dayLabel}: ${closers.length} Personen bis 19:10. Maximal 2 erlaubt.`);
  }

  if (index < week.length - 1 && closers.length > 0) {
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

/* ========= FORM HELPERS ========= */
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

/* ========= RENDER ========= */
function renderTeamSectionVisibility() {
  teamSectionEl.classList.toggle("hidden", !!uiState.teamCollapsed);
  btnToggleTeamEl.textContent = uiState.teamCollapsed ? "Team einblenden" : "Team ausblenden";
}

function renderView() {
  const view = uiState.currentView || "week";

  dayViewEl.classList.toggle("hidden", view !== "day");
  weekViewEl.classList.toggle("hidden", view !== "week");
  formViewEl.classList.toggle("hidden", view !== "form");

  btnViewDayEl.classList.toggle("active", view === "day");
  btnViewWeekEl.classList.toggle("active", view === "week");
  btnViewFormEl.classList.toggle("active", view === "form");
}

function renderTeamSetup() {
  if (!teamListEl) return;
  teamListEl.innerHTML = "";

  state.employees.forEach((emp) => {
    const row = document.createElement("div");
    row.className = "teamRow";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
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
  const currentDay = getCurrentDayObject();
  const currentDayTotal = currentDay ? totalMinutesForDayIso(currentDay.iso) : 0;
  const currentClosers = currentDay ? getClosingWorkersForIso(currentDay.iso).length : 0;

  weeklyHoursActualEl.textContent = minutesToHM(totalWeek);
  weeklyHoursRemainingEl.textContent = minutesToHM(Math.abs(rest));
  weeklyHoursStatusEl.textContent = rest >= 0 ? "Noch frei" : "Überplant";

  dayHoursActualEl.textContent = minutesToHM(currentDayTotal);
  dayHoursSubEl.textContent = currentDay ? currentDay.weekdayLabel : "—";
  lateCountInfoEl.textContent = `${currentClosers} / 2`;
}

function renderAllViews() {
  renderSummary();

  if (typeof renderDayView === "function") renderDayView();
  if (typeof renderWeekView === "function") renderWeekView();
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
weekFromEl.addEventListener("change", () => {
  state.weekFrom = weekFromEl.value;
  syncMonthPlanToState();
  syncWeekRangeFromActiveWeek();
  savePlanData();
  renderAllViews();
});

weekToEl.addEventListener("change", () => {
  state.weekTo = weekToEl.value;
  savePlanData();
  renderAllViews();
});

btnToggleTeamEl.addEventListener("click", () => {
  uiState.teamCollapsed = !uiState.teamCollapsed;
  saveUiState();
  renderTeamSectionVisibility();
});

btnViewDayEl.addEventListener("click", () => {
  uiState.currentView = "day";
  saveUiState();
  renderView();
  renderAllViews();
});

btnViewWeekEl.addEventListener("click", () => {
  uiState.currentView = "week";
  saveUiState();
  renderView();
  renderAllViews();
});

btnViewFormEl.addEventListener("click", () => {
  uiState.currentView = "form";
  saveUiState();
  syncMonthPlanToState();
  renderView();
  renderAllViews();
});

document.getElementById("btnSaveMaster").addEventListener("click", () => {
  saveMasterData();
  alert("Stammdaten gespeichert.");
});

document.getElementById("btnResetWeek").addEventListener("click", () => {
  if (!confirm("Monatsplan leeren? Stammdaten bleiben erhalten.")) return;

  state.employees.forEach((emp) => {
    emp.shifts = {};
  });

  savePlanData();
  renderAll();
});

document.getElementById("btnPrint").addEventListener("click", () => {
  window.print();
});

window.addEventListener("load", () => {
  syncMonthPlanToState();
  renderAll();
});