const DAYS = ["mo","di","mi","do","fr","sa","so"];
const DAY_LABEL = { mo:"Mo", di:"Di", mi:"Mi", do:"Do", fr:"Fr", sa:"Sa", so:"So" };
const LS_KEY = "wochenplan_v3";

// Schichten (Preset) + Custom + Frei
const SHIFTS = [
  { key:"", label:"Frei", start:"", end:"" },

  // Früh
  { key:"9-12",  label:"09:00–12:00", start:"09:00", end:"12:00" },
  { key:"9-13",  label:"09:00–13:00", start:"09:00", end:"13:00" },
  { key:"9-14",  label:"09:00–14:00", start:"09:00", end:"14:00" },
  { key:"9-15",  label:"09:00–15:00", start:"09:00", end:"15:00" },
  { key:"9-19",  label:"09:00–19:00", start:"09:00", end:"19:00" },

  // Spät
  { key:"13-1910", label:"13:00–19:10", start:"13:00", end:"19:10" },
  { key:"14-1910", label:"14:00–19:10", start:"14:00", end:"19:10" },
  { key:"15-1910", label:"15:00–19:10", start:"15:00", end:"19:10" },
  { key:"16-1910", label:"16:00–19:10", start:"16:00", end:"19:10" },

  // Custom (lässt Zeiten unberührt)
  { key:"custom", label:"Custom (Zeiten frei)", start:null, end:null }
];

// Funktion (Dropdown) + Auto-Sollstunden
const ROLES = [
  { key:"",      label:"—",     target:""      },
  { key:"TL",    label:"TL",    target:"30:00" },
  { key:"TZ30",  label:"TZ 30", target:"30:00" },
  { key:"TZ20",  label:"TZ 20", target:"20:00" },
  { key:"TZ15",  label:"TZ 15", target:"15:00" },
  { key:"GFB",   label:"GfB",   target:"9:30"  }
];

const tbody = document.getElementById("tbody");
const sumAllEl = document.getElementById("sumAll");
const warningsEl = document.getElementById("warnings");

// --- Time helpers ---
function hmToMinutes(hm) {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h*60 + m;
}
function minutesToHM(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min/60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2,"0")}`;
}
function formatDelta(min) {
  if (min === 0) return "0:00";
  const sign = min > 0 ? "+" : "-";
  return sign + minutesToHM(Math.abs(min));
}

function shiftDurationMinutes(start, end) {
  const s = hmToMinutes(start);
  const e = hmToMinutes(end);
  if (!s || !e) return 0;
  return (e >= s) ? (e - s) : (24*60 - s + e);
}

// --- Pause rules (deine Regeln) ---
function appliedPauseMinutes(start, end) {
  const dur = shiftDurationMinutes(start, end);
  if (!dur) return 0;

  // Immer 10 Minuten Pause wenn Ende 19:10
  if (end === "19:10") return 10;

  // Sonst: über 6h Arbeit = 60 Minuten Pause
  if (dur > 6*60) return 60;

  return 0;
}
function netMinutes(start, end) {
  const dur = shiftDurationMinutes(start, end);
  if (!dur) return 0;
  return Math.max(0, dur - appliedPauseMinutes(start, end));
}

// --- UI builders ---
function makeSelect(options, value="") {
  const s = document.createElement("select");
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.key;
    opt.textContent = o.label;
    s.appendChild(opt);
  }
  s.value = value;
  return s;
}

function makeTimeInput(value="") {
  const i = document.createElement("input");
  i.type = "time";
  i.className = "time";
  i.value = value;
  return i;
}

function roleToTarget(roleKey) {
  const r = ROLES.find(x => x.key === roleKey);
  return r ? r.target : "";
}

function minutesFromTargetString(t) {
  // akzeptiert "9:30" oder "30:00"
  return t ? hmToMinutes(t) : 0;
}

function makeDayCell(data={}) {
  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "1fr";
  wrap.style.gap = "6px";

  const sel = makeSelect(SHIFTS, data.shiftKey ?? "");

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "6px";
  row.style.alignItems = "center";

  const start = makeTimeInput(data.start || "");
  const end = makeTimeInput(data.end || "");

  const pausePill = document.createElement("span");
  pausePill.className = "pausepill";
  pausePill.textContent = "Pause: 0";

  row.append("S", start, "E", end, pausePill);
  wrap.append(sel, row);

  sel.addEventListener("change", () => {
    const sh = SHIFTS.find(x => x.key === sel.value);
    if (!sh) return;

    if (sh.key === "") {
      start.value = "";
      end.value = "";
    } else if (sh.key === "custom") {
      // Zeiten bleiben
    } else {
      start.value = sh.start;
      end.value = sh.end;
    }
    recalc();
  });

  start.addEventListener("change", () => {
    if (start.value || end.value) sel.value = "custom";
    recalc();
  });
  end.addEventListener("change", () => {
    if (start.value || end.value) sel.value = "custom";
    recalc();
  });

  return { wrap, sel, start, end, pausePill };
}

function buildRow(idx, rowData={}) {
  const tr = document.createElement("tr");

  // Name
  const nameTd = document.createElement("td");
  const name = document.createElement("input");
  name.placeholder = `Mitarbeiter ${idx+1}`;
  name.value = rowData.name || "";
  name.addEventListener("input", recalc);
  nameTd.appendChild(name);

  // Funktion (Dropdown)
  const roleTd = document.createElement("td");
  const roleSel = makeSelect(ROLES, rowData.roleKey || "");
  roleTd.appendChild(roleSel);

  // Soll/Woche (Dropdown - kann man auch manuell übersteuern)
  const targetTd = document.createElement("td");
  const targetSel = document.createElement("select");
  const TARGETS = [
    { key:"",      label:"—" },
    { key:"30:00", label:"30:00" },
    { key:"20:00", label:"20:00" },
    { key:"15:00", label:"15:00" },
    { key:"9:30",  label:"9:30"  }
  ];
  for (const t of TARGETS) {
    const opt = document.createElement("option");
    opt.value = t.key;
    opt.textContent = t.label;
    targetSel.appendChild(opt);
  }
  targetSel.value = rowData.target || "";
  targetTd.appendChild(targetSel);

  // Delta
  const deltaTd = document.createElement("td");
  deltaTd.className = "sum deltaZero";
  deltaTd.textContent = "0:00";

  tr.appendChild(nameTd);
  tr.appendChild(roleTd);
  tr.appendChild(targetTd);
  tr.appendChild(deltaTd);

  // Tage
  const dayInputs = {};
  for (const d of DAYS) {
    const td = document.createElement("td");
    const cell = makeDayCell((rowData.days && rowData.days[d]) || {});
    td.appendChild(cell.wrap);
    tr.appendChild(td);
    dayInputs[d] = cell;
  }

  // Wochen-Summe
  const sumTd = document.createElement("td");
  sumTd.className = "sum";
  sumTd.textContent = "0:00";
  tr.appendChild(sumTd);

  tr._data = { name, roleSel, targetSel, deltaTd, dayInputs, sumTd };

  // Auto-Soll nach Funktion (sofort beim Ändern)
  roleSel.addEventListener("change", () => {
    const autoT = roleToTarget(roleSel.value);
    if (autoT) tr._data.targetSel.value = autoT;
    recalc();
  });

  // Wenn Soll manuell geändert wird, einfach neu rechnen
  targetSel.addEventListener("change", recalc);

  // Wenn ein gespeicherter roleKey existiert, aber target leer ist, setze auto
  if (!targetSel.value && roleSel.value) {
    const autoT = roleToTarget(roleSel.value);
    if (autoT) targetSel.value = autoT;
  }

  return tr;
}

// --- State ---
function getState() {
  const rows = [...tbody.querySelectorAll("tr")].map(tr => {
    const d = tr._data;
    const days = {};
    for (const k of DAYS) {
      const c = d.dayInputs[k];
      days[k] = {
        shiftKey: c.sel.value,
        start: c.start.value,
        end: c.end.value
      };
    }
    return {
      name: d.name.value,
      roleKey: d.roleSel.value,
      target: d.targetSel.value,
      days
    };
  });

  return {
    weekFrom: document.getElementById("weekFrom").value,
    weekTo: document.getElementById("weekTo").value,
    rows
  };
}

function setState(state) {
  document.getElementById("weekFrom").value = state.weekFrom || "";
  document.getElementById("weekTo").value = state.weekTo || "";
  tbody.innerHTML = "";

  const rows = (state.rows && state.rows.length) ? state.rows : [];
  const count = 13;

  for (let i=0; i<count; i++) {
    tbody.appendChild(buildRow(i, rows[i] || {}));
  }
  recalc();
}

function renderWarnings(messages) {
  warningsEl.innerHTML = "";
  for (const msg of messages) {
    const div = document.createElement("div");
    div.className = "warn";
    div.textContent = msg;
    warningsEl.appendChild(div);
  }
}

// --- Recalc + validations ---
function recalc() {
  let all = 0;
  const rows = [...tbody.querySelectorAll("tr")];

  // Warn helpers
  const end1910Count = Object.fromEntries(DAYS.map(d => [d, 0]));
  const warnings = [];

  for (const tr of rows) {
    let rowSum = 0;

    for (const d of DAYS) {
      const c = tr._data.dayInputs[d];
      const pause = appliedPauseMinutes(c.start.value, c.end.value);
      c.pausePill.textContent = `Pause: ${pause}`;

      if (c.end.value === "19:10") end1910Count[d]++;

      rowSum += netMinutes(c.start.value, c.end.value);
    }

    tr._data.sumTd.textContent = minutesToHM(rowSum);
    all += rowSum;

    // Delta pro Mitarbeiter
    const targetMin = minutesFromTargetString(tr._data.targetSel.value);
    const delta = rowSum - targetMin;

    tr._data.deltaTd.textContent = formatDelta(delta);
    tr._data.deltaTd.classList.remove("deltaPos","deltaNeg","deltaZero");
    tr._data.deltaTd.classList.add(delta > 0 ? "deltaPos" : delta < 0 ? "deltaNeg" : "deltaZero");
  }

  sumAllEl.textContent = minutesToHM(all);

  // Max 2 bis 19:10 pro Tag (Abrechnung)
  for (const d of DAYS) {
    if (end1910Count[d] > 2) {
      warnings.push(`⚠ ${DAY_LABEL[d]}: ${end1910Count[d]} Personen bis 19:10 (max. 2 für Abrechnung).`);
    }
  }

  // Abend-Anker: Wenn Mo..Sa 19:10 besetzt ist, muss mind. eine dieser Personen am Folgetag arbeiten
  for (let i=0; i<DAYS.length-1; i++) {
    const d = DAYS[i];
    const next = DAYS[i+1];

    const lateIdx = rows
      .map((tr, idx) => ({ tr, idx }))
      .filter(x => x.tr._data.dayInputs[d].end.value === "19:10")
      .map(x => x.idx);

    if (lateIdx.length === 0) continue;

    const hasAnchor = lateIdx.some(idx => {
      const nextCell = rows[idx]._data.dayInputs[next];
      return !!(nextCell.start.value && nextCell.end.value);
    });

    if (!hasAnchor) {
      warnings.push(`⚠ Abend-Anker: ${DAY_LABEL[d]} hat 19:10-Schicht(en), aber keine dieser Personen ist ${DAY_LABEL[next]} eingeplant.`);
    }
  }

  renderWarnings(warnings);
}

// --- Persistence ---
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(getState()));
}
function load() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// --- Buttons ---
document.getElementById("btnSave").addEventListener("click", () => {
  save();
  alert("Gespeichert.");
});

document.getElementById("btnClear").addEventListener("click", () => {
  if (confirm("Alles leeren?")) {
    localStorage.removeItem(LS_KEY);
    setState({ rows: [] });
  }
});

document.getElementById("btnPrint").addEventListener("click", () => window.print());

document.getElementById("btnAutoTarget").addEventListener("click", () => {
  for (const tr of [...tbody.querySelectorAll("tr")]) {
    const roleKey = tr._data.roleSel.value;
    const autoT = roleToTarget(roleKey);
    if (autoT) tr._data.targetSel.value = autoT;
  }
  recalc();
  alert("Sollstunden nach Funktion gesetzt.");
});

// --- Service Worker ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

// --- Start ---
const st = load();
setState(st || { rows: [] });
