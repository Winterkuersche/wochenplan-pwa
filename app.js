const DAYS = [
  { key: "mo", label: "Mo", full: "Montag" },
  { key: "di", label: "Di", full: "Dienstag" },
  { key: "mi", label: "Mi", full: "Mittwoch" },
  { key: "do", label: "Do", full: "Donnerstag" },
  { key: "fr", label: "Fr", full: "Freitag" },
  { key: "sa", label: "Sa", full: "Samstag" }
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
  { key: "-",   label: "-",   start: "",      end: "",      desc: "frei",        type: "free" },

  { key: "F3",  label: "F3",  start: "09:00", end: "12:00", desc: "09:00-12:00", type: "early" },
  { key: "F4",  label: "F4",  start: "09:00", end: "13:00", desc: "09:00-13:00", type: "early" },
  { key: "F5",  label: "F5",  start: "09:00", end: "14:00", desc: "09:00-14:00", type: "early" },
  { key: "F6",  label: "F6",  start: "09:00", end: "15:00", desc: "09:00-15:00", type: "early" },

  { key: "G1",  label: "G1",  start: "09:00", end: "19:10", desc: "09:00-19:10", type: "full" },

  { key: "L1",  label: "L1",  start: "13:00", end: "19:10", desc: "13:00-19:10", type: "late" },
  { key: "L2",  label: "L2",  start: "14:00", end: "19:10", desc: "14:00-19:10", type: "late" },
  { key: "L3",  label: "L3",  start: "15:00", end: "19:10", desc: "15:00-19:10", type: "late" },
  { key: "L4",  label: "L4",  start: "16:00", end: "19:10", desc: "16:00-19:10", type: "late" },

  { key: "L1E", label: "L1E", start: "13:00", end: "19:00", desc: "13:00-19:00", type: "lateNo" },
  { key: "L2E", label: "L2E", start: "14:00", end: "19:00", desc: "14:00-19:00", type: "lateNo" },
  { key: "L3E", label: "L3E", start: "15:00", end: "19:00", desc: "15:00-19:00", type: "lateNo" },
  { key: "L4E", label: "L4E", start: "16:00", end: "19:00", desc: "16:00-19:00", type: "lateNo" }

  // Später leicht erweiterbar:
  // { key: "U", label: "U", start: "", end: "", desc: "Urlaub", type: "absence" }
];

const MASTER_KEY = "wochenplan_master_v1";
const WEEK_KEY = "wochenplan_week_v3";
const UI_KEY = "wochenplan_ui_v7";
const MAX_WEEKLY_MINUTES = 159 * 60;

let currentDay = "mo";
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
const mepTableBodyEl = document.getElementById("mepTableBody");

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
const mepWeekFromEl = document.getElementById("mepWeekFrom");
const mepWeekToEl = document.getElementById("mepWeekTo");
const mepMonthYearEl = document.getElementById("mepMonthYear");

/* ========= STATE HELPERS ========= */

function createDefaultEmployees() {
  return Array.from({ length: 13 }, (_, i) => ({
    id: `emp_${i + 1}`,
    name: "",
    roleKey: "",
    target: ""
  }));
}

function createEmptyWeekDays() {
  return Object.fromEntries(DAYS.map(d => [d.key, "-"]));
}

function createDefaultWeekShifts() {
  return Array.from({ length: 13 }, (_, i) => ({
    id: `emp_${i + 1}`,
    days: createEmptyWeekDays()
  }));
}

function defaultMasterState() {
  return { employees: createDefaultEmployees() };
}

function defaultWeekState() {
  return {
    weekFrom: "",
    weekTo: "",
    employees: createDefaultWeekShifts()
  };
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

function roleToTarget(roleKey) {
  const found = ROLE_OPTIONS.find(r => r.key === roleKey);
  return found?.target || "";
}

function buildInitialState() {
  const master = loadJson(MASTER_KEY, defaultMasterState());
  const week = loadJson(WEEK_KEY, defaultWeekState());

  const masterEmployees = Array.isArray(master.employees) ? master.employees.slice(0, 13) : [];
  while (masterEmployees.length < 13) {
    const i = masterEmployees.length;
    masterEmployees.push({
      id: `emp_${i + 1}`,
      name: "",
      roleKey: "",
      target: ""
    });
  }

  const weekEmployees = Array.isArray(week.employees) ? week.employees.slice(0, 13) : [];
  while (weekEmployees.length < 13) {
    const i = weekEmployees.length;
    weekEmployees.push({
      id: `emp_${i + 1}`,
      days: createEmptyWeekDays()
    });
  }

  return {
    weekFrom: week.weekFrom || "",
    weekTo: week.weekTo || "",
    employees: masterEmployees.map((emp, index) => {
      const weekEmp = weekEmployees[index] || { id: emp.id, days: createEmptyWeekDays() };
      const normalizedDays = createEmptyWeekDays();

      for (const d of DAYS) {
        normalizedDays[d.key] = weekEmp.days?.[d.key] || "-";
      }

      return {
        id: emp.id || `emp_${index + 1}`,
        name: emp.name || "",
        roleKey: emp.roleKey || "",
        target: emp.target || roleToTarget(emp.roleKey || ""),
        days: normalizedDays
      };
    })
  };
}

function saveMasterData() {
  saveJson(MASTER_KEY, {
    employees: state.employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      roleKey: emp.roleKey,
      target: emp.target
    }))
  });
}

function saveWeekData() {
  saveJson(WEEK_KEY, {
    weekFrom: state.weekFrom,
    weekTo: state.weekTo,
    employees: state.employees.map(emp => ({
      id: emp.id,
      days: { ...emp.days }
    }))
  });
}

/* ========= TIME HELPERS ========= */

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

/* ========= SHIFT HELPERS ========= */

function getShiftByKey(key) {
  return SHIFTS.find(s => s.key === key) || SHIFTS[0];
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

/* ========= CALCULATIONS ========= */

function totalMinutesForEmployee(emp) {
  return DAYS.reduce((sum, d) => sum + netMinutesForShift(emp.days[d.key]), 0);
}

function deltaMinutes(emp) {
  return totalMinutesForEmployee(emp) - hmToMinutes(emp.target || "0:00");
}

function totalMinutesForDay(dayKey) {
  return state.employees.reduce((sum, emp) => sum + netMinutesForShift(emp.days[dayKey]), 0);
}

function totalMinutesForWeek() {
  return state.employees.reduce((sum, emp) => sum + totalMinutesForEmployee(emp), 0);
}

function getPreviousDayKey(dayKey) {
  const idx = DAYS.findIndex(d => d.key === dayKey);
  return idx <= 0 ? null : DAYS[idx - 1].key;
}

function hadLateShiftPreviousDay(emp, dayKey) {
  const prev = getPreviousDayKey(dayKey);
  return prev ? isClosingShift(emp.days[prev]) : false;
}

function getClosingWorkersForDay(dayKey) {
  return state.employees.filter(emp => isClosingShift(emp.days[dayKey]));
}

/* ========= WARNINGS ========= */

function getDayWarnings(dayKey) {
  const warnings = [];
  const closers = getClosingWorkersForDay(dayKey);
  const dayLabel = DAYS.find(d => d.key === dayKey)?.label || dayKey;

  if (closers.length === 0) {
    warnings.push(`⚠ ${dayLabel}: keine Schicht bis 19:10.`);
  }

  if (closers.length > 2) {
    warnings.push(`⚠ ${dayLabel}: ${closers.length} Personen bis 19:10. Maximal 2 erlaubt.`);
  }

  const idx = DAYS.findIndex(d => d.key === dayKey);
  if (idx >= 0 && idx < DAYS.length - 1 && closers.length > 0) {
    const next = DAYS[idx + 1].key;
    const hasAnchor = closers.some(emp => emp.days[next] !== "-");
    if (!hasAnchor) {
      warnings.push(`⚠ ${DAYS[idx + 1].label}: niemand vom ${DAYS[idx].label}-Abschluss eingeplant.`);
    }
  }

  return warnings;
}

function getWeekWarnings() {
  return DAYS.flatMap(d => getDayWarnings(d.key));
}

/* ========= FORM / MEP HELPERS ========= */

function getFormPauseText(shiftKey) {
  switch (shiftKey) {
    case "G1": return "14:00-15:10";
    case "L1": return "16:00-16:10";
    case "L2": return "16:00-16:10";
    case "L3": return "17:00-17:10";
    case "L4": return "17:00-17:10";
    default: return "";
  }
}

function getFormDataForShift(shiftKey) {
  const shift = getShiftByKey(shiftKey);
  if (!shift.start || !shift.end) {
    return { start: "", end: "", pause: "", sum: "" };
  }

  return {
    start: shift.start,
    end: shift.end,
    pause: getFormPauseText(shiftKey),
    sum: minutesToHM(netMinutesForShift(shiftKey))
  };
}

/* ========= COMMON RENDER ========= */

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
  teamListEl.innerHTML = "";

  state.employees.forEach((emp, idx) => {
    const row = document.createElement("div");
    row.className = "teamrow";

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
    ROLE_OPTIONS.forEach(role => {
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

    const info = document.createElement("div");
    info.className = "small";
    info.textContent = `#${idx + 1}`;

    row.appendChild(nameInput);
    row.appendChild(roleSel);
    row.appendChild(targetInput);
    row.appendChild(info);

    teamListEl.appendChild(row);
  });
}

function renderSummary() {
  const totalWeek = totalMinutesForWeek();
  const rest = MAX_WEEKLY_MINUTES - totalWeek;
  const dayTotal = totalMinutesForDay(currentDay);
  const lateCount = getClosingWorkersForDay(currentDay).length;

  weeklyHoursActualEl.textContent = minutesToHM(totalWeek);
  weeklyHoursRemainingEl.textContent = minutesToHM(Math.abs(rest));
  weeklyHoursStatusEl.textContent = rest >= 0 ? "Noch frei" : "Überplant";

  dayHoursActualEl.textContent = minutesToHM(dayTotal);
  dayHoursSubEl.textContent = DAYS.find(d => d.key === currentDay)?.full || "Aktueller Tag";
  lateCountInfoEl.textContent = `${lateCount} / 2`;

  if (mepWeekFromEl) mepWeekFromEl.textContent = state.weekFrom || "____________";
  if (mepWeekToEl) mepWeekToEl.textContent = state.weekTo || "____________";
  if (mepMonthYearEl) mepMonthYearEl.textContent = formatMonthYear(state.weekFrom);
}

function renderAllViews() {
  renderSummary();

  if (typeof renderDayView === "function") renderDayView();
  if (typeof renderWeekView === "function") renderWeekView();
  if (typeof renderFormView === "function") renderFormView();
}

function renderAll() {
  weekFromEl.value = state.weekFrom || "";
  weekToEl.value = state.weekTo || "";

  renderTeamSectionVisibility();
  renderView();
  renderTeamSetup();
  renderAllViews();
}

/* ========= EVENTS ========= */

weekFromEl.addEventListener("change", () => {
  state.weekFrom = weekFromEl.value;
  saveWeekData();
  renderSummary();
});

weekToEl.addEventListener("change", () => {
  state.weekTo = weekToEl.value;
  saveWeekData();
  renderSummary();
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
});

btnViewWeekEl.addEventListener("click", () => {
  uiState.currentView = "week";
  saveUiState();
  renderView();
});

btnViewFormEl.addEventListener("click", () => {
  uiState.currentView = "form";
  saveUiState();
  renderView();
});

document.getElementById("btnSaveMaster").addEventListener("click", () => {
  saveMasterData();
  alert("Stammdaten gespeichert.");
});

document.getElementById("btnResetWeek").addEventListener("click", () => {
  if (!confirm("Neue Woche starten und nur den Wochenplan leeren? Stammdaten bleiben erhalten.")) return;

  state.weekFrom = "";
  state.weekTo = "";
  state.employees.forEach(emp => {
    for (const d of DAYS) {
      emp.days[d.key] = "-";
    }
  });

  saveWeekData();
  renderAll();
});

document.getElementById("btnPrint").addEventListener("click", () => {
  window.print();
});

renderAll();
