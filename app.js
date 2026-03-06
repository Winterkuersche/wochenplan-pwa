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
  { key: "F3", label: "F3", start: "09:00", end: "12:00", desc: "09:00-12:00" },
  { key: "F4", label: "F4", start: "09:00", end: "13:00", desc: "09:00-13:00" },
  { key: "F5", label: "F5", start: "09:00", end: "14:00", desc: "09:00-14:00" },
  { key: "F6", label: "F6", start: "09:00", end: "15:00", desc: "09:00-15:00" },
  { key: "G1", label: "G1", start: "09:00", end: "19:10", desc: "09:00-19:10" },
  { key: "L1", label: "L1", start: "13:00", end: "19:10", desc: "13:00-19:10" },
  { key: "L2", label: "L2", start: "14:00", end: "19:10", desc: "14:00-19:10" },
  { key: "L3", label: "L3", start: "15:00", end: "19:10", desc: "15:00-19:10" },
  { key: "L4", label: "L4", start: "16:00", end: "19:10", desc: "16:00-19:10" },
  { key: "-", label: "-", start: "", end: "", desc: "frei" }
];

const LS_KEY = "wochenplan_v4";
let currentDay = "mo";

const teamListEl = document.getElementById("teamList");
const dayTabsEl = document.getElementById("dayTabs");
const plannerListEl = document.getElementById("plannerList");
const metaDayNameEl = document.getElementById("metaDayName");
const lateCountInfoEl = document.getElementById("lateCountInfo");
const dayWarningsEl = document.getElementById("dayWarnings");
const overviewBodyEl = document.getElementById("overviewBody");
const weekFromEl = document.getElementById("weekFrom");
const weekToEl = document.getElementById("weekTo");

function createDefaultEmployees() {
  return Array.from({ length: 13 }, (_, i) => ({
    id: `emp_${i + 1}`,
    name: "",
    roleKey: "",
    target: "",
    days: Object.fromEntries(DAYS.map(d => [d.key, "-"]))
  }));
}

function defaultState() {
  return {
    weekFrom: "",
    weekTo: "",
    employees: createDefaultEmployees()
  };
}

let state = loadState() || defaultState();
normalizeState();

function normalizeState() {
  if (!state || !Array.isArray(state.employees)) {
    state = defaultState();
  }

  if (state.employees.length < 13) {
    while (state.employees.length < 13) {
      const i = state.employees.length;
      state.employees.push({
        id: `emp_${i + 1}`,
        name: "",
        roleKey: "",
        target: "",
        days: Object.fromEntries(DAYS.map(d => [d.key, "-"]))
      });
    }
  }

  state.employees = state.employees.slice(0, 13).map((emp, index) => {
    const days = emp.days || {};
    const normalizedDays = {};
    for (const d of DAYS) {
      normalizedDays[d.key] = days[d.key] || "-";
    }

    const roleKey = emp.roleKey || "";
    let target = emp.target || roleToTarget(roleKey);

    return {
      id: emp.id || `emp_${index + 1}`,
      name: emp.name || "",
      roleKey,
      target,
      days: normalizedDays
    };
  });
}

function roleToTarget(roleKey) {
  const found = ROLE_OPTIONS.find(r => r.key === roleKey);
  return found && found.target ? found.target : "";
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

function formatDelta(min) {
  if (min === 0) return "0:00";
  return `${min > 0 ? "+" : "-"}${minutesToHM(Math.abs(min))}`;
}

function getShiftByKey(key) {
  return SHIFTS.find(s => s.key === key) || SHIFTS[SHIFTS.length - 1];
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
  const dur = shiftDurationMinutes(shiftKey);

  if (shift.end === "19:10") return 10;
  if (dur > 6 * 60) return 60;
  return 0;
}

function netMinutesForShift(shiftKey) {
  const dur = shiftDurationMinutes(shiftKey);
  if (!dur) return 0;
  return Math.max(0, dur - appliedPauseMinutes(shiftKey));
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

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
    nameInput.addEventListener("input", () => {
      emp.name = nameInput.value;
      renderAll();
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
      renderAll();
    });

    const targetBox = document.createElement("input");
    targetBox.type = "text";
    targetBox.value = emp.target || "";
    targetBox.placeholder = "Soll";
    targetBox.addEventListener("input", () => {
      emp.target = targetBox.value;
      renderAll();
    });

    const info = document.createElement("div");
    info.className = "small";
    info.textContent = `#${idx + 1}`;

    row.appendChild(nameInput);
    row.appendChild(roleSel);
    row.appendChild(targetBox);
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
    });
    dayTabsEl.appendChild(btn);
  });
}

function getDayWarnings(dayKey) {
  const warnings = [];
  const lateWorkers = state.employees.filter(emp => {
    const shift = getShiftByKey(emp.days[dayKey]);
    return shift.end === "19:10";
  });

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

function renderPlanner() {
  renderTabs();

  const dayObj = DAYS.find(d => d.key === currentDay);
  metaDayNameEl.textContent = dayObj ? dayObj.full : currentDay;

  const lateCount = state.employees.filter(emp => {
    const shift = getShiftByKey(emp.days[currentDay]);
    return shift.end === "19:10";
  }).length;

  lateCountInfoEl.textContent = `19:10 heute: ${lateCount} / 2`;

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

  state.employees.forEach((emp) => {
    const row = document.createElement("div");
    row.className = "planRow";

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

    const right = document.createElement("div");
    right.className = "planHours";
    right.innerHTML = `
      <div><strong>${minutesToHM(totalMinutesForEmployee(emp))}</strong> / ${emp.target || "—"}</div>
      <div class="small">Delta ${formatDelta(deltaMinutes(emp))}</div>
    `;

    head.appendChild(left);
    head.appendChild(right);

    const btnWrap = document.createElement("div");
    btnWrap.className = "shiftButtons";

    SHIFTS.forEach(shift => {
      const btn = document.createElement("button");
      btn.className = `shiftBtn${emp.days[currentDay] === shift.key ? " active" : ""}`;
      btn.textContent = shift.label;
      btn.title = shift.desc;
      btn.addEventListener("click", () => {
        emp.days[currentDay] = shift.key;
        renderAll();
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
      td.textContent = emp.days[d.key] || "-";
      tr.appendChild(td);
    });

    const tdActual = document.createElement("td");
    tdActual.textContent = minutesToHM(totalMinutesForEmployee(emp));

    const delta = deltaMinutes(emp);
    const tdDelta = document.createElement("td");
    tdDelta.textContent = formatDelta(delta);
    tdDelta.className = delta > 0 ? "deltaPos" : delta < 0 ? "deltaNeg" : "deltaZero";

    tr.appendChild(tdActual);
    tr.appendChild(tdDelta);

    overviewBodyEl.appendChild(tr);
  });
}

function renderAll() {
  weekFromEl.value = state.weekFrom || "";
  weekToEl.value = state.weekTo || "";

  renderTeamSetup();
  renderPlanner();
  renderOverview();
  saveState();
}

weekFromEl.addEventListener("change", () => {
  state.weekFrom = weekFromEl.value;
  saveState();
});

weekToEl.addEventListener("change", () => {
  state.weekTo = weekToEl.value;
  saveState();
});

document.getElementById("btnSave").addEventListener("click", () => {
  saveState();
  alert("Gespeichert.");
});

document.getElementById("btnClearWeek").addEventListener("click", () => {
  if (!confirm("Komplette Woche leeren?")) return;

  state.employees.forEach(emp => {
    for (const d of DAYS) {
      emp.days[d.key] = "-";
    }
  });

  renderAll();
});

document.getElementById("btnPrint").addEventListener("click", () => {
  window.print();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

renderAll();