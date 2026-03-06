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
  { key: "TZ30", label: "TZ 30", target: "30:00" },
  { key: "TZ20", label: "TZ 20", target: "20:00" },
  { key: "TZ15", label: "TZ 15", target: "15:00" },
  { key: "GFB", label: "GfB", target: "9:30" }
];

const SHIFTS = [
  { key: "F3", label: "F3", start: "09:00", end: "12:00", desc: "09:00-12:00", type: "early" },
  { key: "F4", label: "F4", start: "09:00", end: "13:00", desc: "09:00-13:00", type: "early" },
  { key: "F5", label: "F5", start: "09:00", end: "14:00", desc: "09:00-14:00", type: "early" },
  { key: "F6", label: "F6", start: "09:00", end: "15:00", desc: "09:00-15:00", type: "early" },
  { key: "G1", label: "G1", start: "09:00", end: "19:10", desc: "09:00-19:10", type: "full" },
  { key: "L1", label: "L1", start: "13:00", end: "19:10", desc: "13:00-19:10", type: "late" },
  { key: "L2", label: "L2", start: "14:00", end: "19:10", desc: "14:00-19:10", type: "late" },
  { key: "L3", label: "L3", start: "15:00", end: "19:10", desc: "15:00-19:10", type: "late" },
  { key: "L4", label: "L4", start: "16:00", end: "19:10", desc: "16:00-19:10", type: "late" },
  { key: "-", label: "-", start: "", end: "", desc: "frei", type: "free" }
];

const MASTER_KEY = "wochenplan_master_v1";
const WEEK_KEY = "wochenplan_week_v1";
const UI_KEY = "wochenplan_ui_v1";
const MAX_WEEKLY_MINUTES = 159 * 60;

let currentDay = "mo";
let uiState = loadUiState();

const teamListEl = document.getElementById("teamList");
const dayTabsEl = document.getElementById("dayTabs");
const plannerListEl = document.getElementById("plannerList");
const metaDayNameEl = document.getElementById("metaDayName");
const lateCountInfoEl = document.getElementById("lateCountInfo");
const dayWarningsEl = document.getElementById("dayWarnings");
const dayHoursInfoEl = document.getElementById("dayHoursInfo");
const overviewBodyEl = document.getElementById("overviewBody");
const weekFromEl = document.getElementById("weekFrom");
const weekToEl = document.getElementById("weekTo");
const teamSectionEl = document.getElementById("teamSection");
const btnToggleTeamEl = document.getElementById("btnToggleTeam");

const weeklyHoursActualEl = document.getElementById("weeklyHoursActual");
const weeklyHoursTargetEl = document.getElementById("weeklyHoursTarget");
const weeklyHoursRemainingEl = document.getElementById("weeklyHoursRemaining");
const weeklyHoursStatusEl = document.getElementById("weeklyHoursStatus");
const dayHoursActualEl = document.getElementById("dayHoursActual");
const dayHoursSubEl = document.getElementById("dayHoursSub");

let state = buildInitialState();

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
  return {
    employees: createDefaultEmployees()
  };
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
    teamCollapsed: false
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
  return found && found.target ? found.target : "";
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

  const employees = masterEmployees.map((emp, index) => {
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
  });

  return {
    weekFrom: week.weekFrom || "",
    weekTo: week.weekTo || "",
    employees
  };
}

function saveMasterData() {
  const payload = {
    employees: state.employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      roleKey: emp.roleKey,
      target: emp.target
    }))
  };
  saveJson(MASTER_KEY, payload);
}

function saveWeekData() {
  const payload = {
    weekFrom: state.weekFrom,
    weekTo: state.weekTo,
    employees: state.employees.map(emp => ({
      id: emp.id,
      days: { ...emp.days }
    }))
  };
  saveJson(WEEK_KEY, payload);
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

function getShiftByKey(key) {
  return SHIFTS.find(s => s.key === key) || SHIFTS[SHIFTS.length - 1];
}

function getShiftClassByKey(key) {
  const shift = getShiftByKey(key);
  if (shift.type === "early") return "early";
  if (shift.type === "full") return "full";
  if (shift.type === "late") return "late";
  return "free";
}

function shiftDurationMinutes(shiftKey) {
  const shift = getShiftByKey(shiftKey);
  if (!shift.start || !shift.end) return 0;

  const start = hmToMinutes(shift.start);
  const end = hmToMinutes(shift.end);
  return end - start;
}

function appliedPauseMinutes(shiftKey) {
  const shift = getShiftByKey(shiftKey);
  if (!shift.start || !shift.end) return 0;

  const duration = shiftDurationMinutes(shiftKey);

  if (shift.end === "19:10") return 10;
  if (duration > 6 * 60) return 60;
  return 0;
}

function netMinutesForShift(shiftKey) {
  const duration = shiftDurationMinutes(shiftKey);
  if (!duration) return 0;
  return Math.max(0, duration - appliedPauseMinutes(shiftKey));
}

function totalMinutesForEmployee(emp) {
  return DAYS.reduce((sum, d) => sum + netMinutesForShift(emp.days[d.key]), 0);
}

function targetMinutes(emp) {
  return hmToMinutes(emp.target || "0:00");
}

function deltaMinutes(emp) {
  return totalMinutesForEmployee(emp) - targetMinutes(emp);
}

function totalMinutesForDay(dayKey) {
  return state.employees.reduce((sum, emp) => sum + netMinutesForShift(emp.days[dayKey]), 0);
}

function totalMinutesForWeek() {
  return state.employees.reduce((sum, emp) => sum + totalMinutesForEmployee(emp), 0);
}

function getPreviousDayKey(dayKey) {
  const idx = DAYS.findIndex(d => d.key === dayKey);
  if (idx <= 0) return null;
  return DAYS[idx - 1].key;
}

function hadLateShiftPreviousDay(emp, dayKey) {
  const prevDayKey = getPreviousDayKey(dayKey);
  if (!prevDayKey) return false;
  const prevShift = getShiftByKey(emp.days[prevDayKey]);
  return prevShift.end === "19:10";
}

function getLateWorkersForDay(dayKey) {
  return state.employees.filter(emp => {
    const shift = getShiftByKey(emp.days[dayKey]);
    return shift.end === "19:10";
  });
}

function getDayWarnings(dayKey) {
  const warnings = [];
  const lateWorkers = getLateWorkersForDay(dayKey);

  if (lateWorkers.length > 2) {
    warnings.push(`⚠ ${lateWorkers.length} Personen bis 19:10 eingeplant. Maximal 2 erlaubt.`);
  }

  const dayIndex = DAYS.findIndex(d => d.key === dayKey);
  if (dayIndex >= 0 && dayIndex < DAYS.length - 1 && lateWorkers.length > 0) {
    const nextDayKey = DAYS[dayIndex + 1].key;
    const hasAnchor = lateWorkers.some(emp => emp.days[nextDayKey] !== "-");

    if (!hasAnchor) {
      warnings.push(`⚠ Keine 19:10-Person von ${DAYS[dayIndex].label} ist am ${DAYS[dayIndex + 1].label} eingeplant.`);
    }
  }

  return warnings;
}

function renderTeamSectionVisibility() {
  const collapsed = !!uiState.teamCollapsed;
  teamSectionEl.classList.toggle("hidden", collapsed);
  btnToggleTeamEl.textContent = collapsed ? "Team einblenden" : "Team ausblenden";
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
      renderPlanner();
      renderOverview();
    });

    const roleSel = document.createElement("select");
    for (const role of ROLE_OPTIONS) {
      const opt = document.createElement("option");
      opt.value = role.key;
      opt.textContent = role.label;
      roleSel.appendChild(opt);
    }
    roleSel.value = emp.roleKey;
    roleSel.addEventListener("change", () => {
      emp.roleKey = roleSel.value;
      emp.target = roleToTarget(emp.roleKey);
      saveMasterData();
      renderTeamSetup();
      renderPlanner();
      renderOverview();
      renderSummary();
    });

    const targetInput = document.createElement("input");
    targetInput.type = "text";
    targetInput.placeholder = "Soll";
    targetInput.value = emp.target || "";
    targetInput.addEventListener("change", () => {
      emp.target = targetInput.value;
      saveMasterData();
      renderPlanner();
      renderOverview();
      renderSummary();
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

function renderTabs() {
  dayTabsEl.innerHTML = "";

  DAYS.forEach(d => {
    const btn = document.createElement("button");
    btn.className = `tabBtn${currentDay === d.key ? " active" : ""}`;
    btn.textContent = d.label;
    btn.addEventListener("click", () => {
      currentDay = d.key;
      renderPlanner();
      renderSummary();
    });
    dayTabsEl.appendChild(btn);
  });
}

function renderSummary() {
  const totalWeek = totalMinutesForWeek();
  const rest = MAX_WEEKLY_MINUTES - totalWeek;
  const dayTotal = totalMinutesForDay(currentDay);
  const lateCount = getLateWorkersForDay(currentDay).length;

  weeklyHoursActualEl.textContent = minutesToHM(totalWeek);
  weeklyHoursTargetEl.textContent = `von ${minutesToHM(MAX_WEEKLY_MINUTES)}`;

  weeklyHoursRemainingEl.textContent = minutesToHM(Math.abs(rest));
  weeklyHoursStatusEl.textContent = rest >= 0 ? "Noch frei" : "Überplant";

  dayHoursActualEl.textContent = minutesToHM(dayTotal);
  const dayObj = DAYS.find(d => d.key === currentDay);
  dayHoursSubEl.textContent = dayObj ? dayObj.full : "Aktueller Tag";

  lateCountInfoEl.textContent = `${lateCount} / 2`;
}

function renderPlanner() {
  renderTabs();

  const dayObj = DAYS.find(d => d.key === currentDay);
  metaDayNameEl.textContent = dayObj ? dayObj.full : currentDay;

  const dayHours = totalMinutesForDay(currentDay);
  dayHoursInfoEl.textContent = `Geplante Arbeitsstunden: ${minutesToHM(dayHours)}`;

  const warnings = getDayWarnings(currentDay);
  dayWarningsEl.innerHTML = "";

  if (warnings.length === 0) {
    dayWarningsEl.textContent = "Keine Warnungen.";
  } else {
    warnings.forEach(w => {
      const div = document.createElement("div");
      div.className = "warnLine";
      div.textContent = w;
      dayWarningsEl.appendChild(div);
    });
  }

  plannerListEl.innerHTML = "";

  state.employees.forEach(emp => {
    const wasLateYesterday = hadLateShiftPreviousDay(emp, currentDay);

    const row = document.createElement("div");
    row.className = `planRow${wasLateYesterday ? " prevLate" : ""}`;

    const head = document.createElement("div");
    head.className = "planHead";

    const left = document.createElement("div");

    const name = document.createElement("div");
    name.className = "planName";
    name.textContent = emp.name || "—";

    const sub = document.createElement("div");
    sub.className = "planSub";
    const currentShift = getShiftByKey(emp.days[currentDay]);
    sub.textContent = `${emp.roleKey || "-"} · ${currentShift.desc}`;

    left.appendChild(name);
    left.appendChild(sub);

    if (wasLateYesterday) {
      const badge = document.createElement("div");
      badge.className = "prevLateBadge";
      badge.textContent = "Gestern 19:10";
      left.appendChild(badge);
    }

    const right = document.createElement("div");
    right.className = "planHours";
    right.innerHTML = `
      <div><strong>${minutesToHM(totalMinutesForEmployee(emp))}</strong> / ${emp.target || "—"}</div>
      <div class="small">Delta ${formatSignedMinutes(deltaMinutes(emp))}</div>
    `;

    head.appendChild(left);
    head.appendChild(right);

    const btnWrap = document.createElement("div");
    btnWrap.className = "shiftButtons";

    SHIFTS.forEach(shift => {
      const btn = document.createElement("button");
      const shiftClass = getShiftClassByKey(shift.key);
      btn.className = `shiftBtn shift-${shiftClass}${emp.days[currentDay] === shift.key ? " active" : ""}`;
      btn.textContent = shift.label;
      btn.title = shift.desc;
      btn.addEventListener("click", () => {
        emp.days[currentDay] = shift.key;
        saveWeekData();
        renderPlanner();
        renderOverview();
        renderSummary();
      });
      btnWrap.appendChild(btn);
    });

    const legend = document.createElement("div");
    legend.className = "shiftLegend";
    legend.textContent = "F3 09-12 · F4 09-13 · F5 09-14 · F6 09-15 · G1 09-19:10 · L1 13-19:10 · L2 14-19:10 · L3 15-19:10 · L4 16-19:10 · - frei";

    row.appendChild(head);
    row.appendChild(btnWrap);
    row.appendChild(legend);

    plannerListEl.appendChild(row);
  });
}

function renderOverview() {
  overviewBodyEl.innerHTML = "";

  state.employees.forEach(emp => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = emp.name || "—";

    const tdRole = document.createElement("td");
    tdRole.textContent = emp.roleKey || "-";

    const tdTarget = document.createElement("td");
    tdTarget.textContent = emp.target || "-";

    tr.appendChild(tdName);
    tr.appendChild(tdRole);
    tr.appendChild(tdTarget);

    DAYS.forEach(d => {
      const td = document.createElement("td");
      const chip = document.createElement("span");
      chip.className = `overviewChip ${getShiftClassByKey(emp.days[d.key])}`;
      chip.textContent = emp.days[d.key] || "-";
      td.appendChild(chip);
      tr.appendChild(td);
    });

    const tdActual = document.createElement("td");
    tdActual.textContent = minutesToHM(totalMinutesForEmployee(emp));

    const delta = deltaMinutes(emp);
    const tdDelta = document.createElement("td");
    tdDelta.textContent = formatSignedMinutes(delta);
    tdDelta.className = delta > 0 ? "deltaPos" : delta < 0 ? "deltaNeg" : "deltaZero";

    tr.appendChild(tdActual);
    tr.appendChild(tdDelta);

    overviewBodyEl.appendChild(tr);
  });
}

function renderAll() {
  weekFromEl.value = state.weekFrom || "";
  weekToEl.value = state.weekTo || "";

  renderTeamSectionVisibility();
  renderTeamSetup();
  renderPlanner();
  renderOverview();
  renderSummary();
}

weekFromEl.addEventListener("change", () => {
  state.weekFrom = weekFromEl.value;
  saveWeekData();
});

weekToEl.addEventListener("change", () => {
  state.weekTo = weekToEl.value;
  saveWeekData();
});

btnToggleTeamEl.addEventListener("click", () => {
  uiState.teamCollapsed = !uiState.teamCollapsed;
  saveUiState();
  renderTeamSectionVisibility();
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