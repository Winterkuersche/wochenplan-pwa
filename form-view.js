function pad2Form(n) {
  return String(n).padStart(2, "0");
}

function formatMonthYearFromDateForm(date) {
  return `${pad2Form(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatMonthYearLongForm(date) {
  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function formatShortDateForm(date) {
  return `${pad2Form(date.getDate())}.${pad2Form(date.getMonth() + 1)}`;
}

function formatIsoDateForm(date) {
  return `${date.getFullYear()}-${pad2Form(date.getMonth() + 1)}-${pad2Form(date.getDate())}`;
}
function formatMinutesAsHourText(minutes) {
  if (!minutes || minutes <= 0) return "";

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${h}:${String(m).padStart(2, "0")}`;
}
function getMonthTotalForEmployeeUntilWeek(emp, currentWeekDays) {
  const monthPlan = state.monthPlan;
  if (!monthPlan?.weeks || !currentWeekDays?.length) return 0;

  const currentWeekStartIso = currentWeekDays[0].iso;
  let total = 0;

  monthPlan.weeks.forEach((week) => {
    if (!week.length) return;

    const weekStartIso = week[0].iso;

    if (weekStartIso > currentWeekStartIso) {
      return;
    }

    week.forEach((day) => {
      if (!day.inCurrentMonth) return;
      total += netMinutesForShift(getShiftForEmployeeOnIso(emp, day.iso));
    });
  });

  return total;
}

function getBreakTextForResolvedShift(entry) {
  if (!entry || entry.type !== "shift") return "";
  return getPauseRangeForMep(entry);
}

function getResolvedFormDayData(emp, isoDate) {
  const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);
  const status = getResolvedStatus(resolved);

  if (!resolved) return { start: "", pause: "", end: "", sum: "" };

  if (resolved.type === "holiday") {
    return { start: "Feiertag", pause: "", end: "", sum: minutesToHM(resolved.minutesForMonth) };
  }

  if (status === ENTRY_STATUS.SICK || status === ENTRY_STATUS.VACATION) {
    return {
      start: getStatusShortLabel(status),
      pause: "",
      end: "",
      sum: minutesToHM(resolved.minutesForMonth)
    };
  }

  if (status === ENTRY_STATUS.EXTERNAL) {
    const branch = resolved.sourceEntry?.branch || "";
    return {
      start: getStatusShortLabel(status),
      pause: branch,
      end: "",
      sum: minutesToHM(resolved.minutesForMonth)
    };
  }

  if (status === ENTRY_STATUS.WORK && resolved.sourceEntry) {
    const entry = resolved.sourceEntry;
    return {
      start: entry.start || "",
      pause: getBreakTextForResolvedShift(entry),
      end: entry.end || "",
      sum: minutesToHM(resolved.minutesForMonth)
    };
  }

  return { start: "", pause: "", end: "", sum: "" };
}

function getWeekResolvedMinutesForEmployee(emp, weekDays) {
  return weekDays.reduce((sum, day) => {
    if (day.isOutsideMonth) return sum;
    return sum + getResolvedEntryForEmployeeOnIso(emp, day.iso).minutesForMonth;
  }, 0);
}

function getMonthResolvedMinutesForEmployeeUntilWeek(emp, currentWeekDays) {
  const monthPlan = state.monthPlan;
  if (!monthPlan?.weeks || !currentWeekDays?.length) return 0;

  const currentWeekStartIso = currentWeekDays[0].iso;
  let total = 0;

  monthPlan.weeks.forEach((week) => {
    if (!week.length) return;

    const weekStartIso = week[0].iso;
    if (weekStartIso > currentWeekStartIso) return;

    week.forEach((day) => {
      if (!day.inCurrentMonth) return;
      total += getResolvedEntryForEmployeeOnIso(emp, day.iso).minutesForMonth;
    });
  });

  return total;
}

function getFormDayData(emp, isoDate) {
  return getResolvedFormDayData(emp, isoDate);
}

function getHandwriteClass(seedText = "") {
  let sum = 0;
  for (let i = 0; i < seedText.length; i += 1) sum += seedText.charCodeAt(i);
  return `handVar${(sum % 4) + 1}`;
}

function renderHandText(text, seedText = "") {
  const safeText = text || "";
  const handClass = getHandwriteClass(seedText || safeText);
  return `<span class="mepHand ${handClass}">${safeText}</span>`;
}

const MEP_MEASURE_FIELDS = [
  { cssVar: "--mep-main-left", label: "main-left" },
  { cssVar: "--mep-main-top", label: "main-top" },
  { cssVar: "--mep-main-right", label: "main-right" },
  { cssVar: "--mep-sum-left", label: "sum-left" },
  { cssVar: "--mep-sum-right", label: "sum-right" },
  { cssVar: "--mep-sum-top", label: "sum-top" },
  { cssVar: "--mep-header-top", label: "header-top" },
  { cssVar: "--mep-header-title-offset-y", label: "header-title-offset-y" },
  { cssVar: "--mep-header-meta-offset-y", label: "header-meta-offset-y" },
  { cssVar: "--mep-header-right-box-w", label: "header-right-box-w" },
  { cssVar: "--mep-ref-left", label: "ref-left" },
  { cssVar: "--mep-ref-top", label: "ref-top" },
  { cssVar: "--mep-ref-width", label: "ref-width" },
  { cssVar: "--mep-row-h", label: "row-h" },
  { cssVar: "--mep-footer-offset-y", label: "footer-offset-y" },
  { cssVar: "--mep-body-height", label: "body-height" },
  { cssVar: "--mep-gap-main-sum", label: "gap-main-sum" }
];

const MEP_CALIBRATION_STORAGE_KEY = "mep-calibration";
const MEP_CALIBRATION_DEFAULTS = {
  "--mep-main-left": 22.4,
  "--mep-main-top": 30,
  "--mep-main-right": 232.5,
  "--mep-sum-left": 233.7,
  "--mep-sum-right": 276,
  "--mep-sum-top": 30,
  "--mep-header-top": 2.2,
  "--mep-header-title-offset-y": 3.6,
  "--mep-header-meta-offset-y": 6.5,
  "--mep-header-right-box-w": 34.1,
  "--mep-ref-left": 0,
  "--mep-ref-top": 0,
  "--mep-ref-width": 297,
  "--mep-row-h": 3.85,
  "--mep-footer-offset-y": 4.55,
  "--mep-body-height": 137.2,
  "--mep-gap-main-sum": 1.2
};

let mepCalibrationBootstrapped = false;

let mepMeasureModeEnabled = false;

function getMepCssVarValue(cssVar) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function formatMepMm(value) {
  return `${Number(value).toFixed(2)}mm`;
}

function getMepCalibrationRange(cssVar) {
  const pageWidth = 297;
  const pageHeight = 210;
  const ranges = {
    "--mep-main-left": [0, pageWidth],
    "--mep-main-right": [0, pageWidth],
    "--mep-sum-left": [0, pageWidth],
    "--mep-sum-right": [0, pageWidth],
    "--mep-main-top": [0, pageHeight],
    "--mep-sum-top": [0, pageHeight],
    "--mep-header-top": [0, pageHeight],
    "--mep-header-title-offset-y": [-20, 20],
    "--mep-header-meta-offset-y": [-20, 20],
    "--mep-header-right-box-w": [1, pageWidth],
    "--mep-ref-left": [0, pageWidth],
    "--mep-ref-top": [0, pageHeight],
    "--mep-ref-width": [1, pageWidth],
    "--mep-row-h": [0.5, 10],
    "--mep-footer-offset-y": [-20, 20],
    "--mep-body-height": [10, pageHeight],
    "--mep-gap-main-sum": [-50, 50]
  };

  return ranges[cssVar] || [-1000, 1000];
}

function isFiniteMepCalibrationValue(cssVar, value) {
  if (!Number.isFinite(value)) return false;
  const [min, max] = getMepCalibrationRange(cssVar);
  return value >= min && value <= max;
}

function syncMepGapMainSumVar() {
  const gap = getMepCssVarValue("--mep-sum-left") - getMepCssVarValue("--mep-main-right");
  document.documentElement.style.setProperty("--mep-gap-main-sum", formatMepMm(gap));
}

function applyMepMeasureVar(cssVar, value) {
  if (!isFiniteMepCalibrationValue(cssVar, Number(value))) {
    return;
  }

  document.documentElement.style.setProperty(cssVar, formatMepMm(Number(value)));

  if (cssVar === "--mep-main-right" || cssVar === "--mep-sum-left") {
    syncMepGapMainSumVar();
  }
}

function getMepMeasureDisplayValue(cssVar) {
  if (cssVar === "--mep-gap-main-sum") {
    return getMepCssVarValue("--mep-sum-left") - getMepCssVarValue("--mep-main-right");
  }

  return getMepCssVarValue(cssVar);
}

function collectMepCalibrationSnapshot() {
  return MEP_MEASURE_FIELDS.reduce((acc, { cssVar }) => {
    acc[cssVar] = getMepMeasureDisplayValue(cssVar);
    return acc;
  }, {});
}

function saveMepCalibration(values = collectMepCalibrationSnapshot()) {
  try {
    localStorage.setItem(MEP_CALIBRATION_STORAGE_KEY, JSON.stringify(values));
  } catch (_error) {
    // ignore localStorage write errors
  }
}

function loadStoredMepCalibration() {
  try {
    const raw = localStorage.getItem(MEP_CALIBRATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function initMepCalibration() {
  if (mepCalibrationBootstrapped) return;

  const cssSnapshot = collectMepCalibrationSnapshot();
  const stored = loadStoredMepCalibration();

  MEP_MEASURE_FIELDS.forEach(({ cssVar }) => {
    const storedValue = stored ? Number(stored[cssVar]) : NaN;
    const cssValue = Number(cssSnapshot[cssVar]);
    const fallback = Number(MEP_CALIBRATION_DEFAULTS[cssVar]);
    const nextValue = isFiniteMepCalibrationValue(cssVar, storedValue)
      ? storedValue
      : (isFiniteMepCalibrationValue(cssVar, cssValue) ? cssValue : fallback);

    if (isFiniteMepCalibrationValue(cssVar, nextValue)) {
      applyMepMeasureVar(cssVar, nextValue);
    }
  });

  syncMepGapMainSumVar();
  saveMepCalibration();
  mepCalibrationBootstrapped = true;
}

function resetMepCalibration() {
  try {
    localStorage.removeItem(MEP_CALIBRATION_STORAGE_KEY);
  } catch (_error) {
    // ignore localStorage write errors
  }

  Object.entries(MEP_CALIBRATION_DEFAULTS).forEach(([cssVar, value]) => {
    applyMepMeasureVar(cssVar, Number(value));
  });

  syncMepGapMainSumVar();
  saveMepCalibration();
  refreshMepMeasureUI();
  updateMepMeasureDynamicGuides();
}

function updateMepMeasureDynamicGuides() {
  const frame = document.querySelector(".mepMeasureMode .mepContentFrame");
  if (!frame) return;

  const frameRect = frame.getBoundingClientRect();
  const guideMap = [
    { line: "main-bottom", selector: ".mepMainTableWrap .mepTableOuter", mode: "bottom" },
    { line: "sum-bottom", selector: ".mepSumWrap", mode: "sum-bottom" },
    { line: "footer-top", selector: ".mepFooter", mode: "top" },
    { line: "stand-bottom", selector: ".mepFooterStand", mode: "bottom" }
  ];

  guideMap.forEach(({ line, selector, mode }) => {
    const target = frame.querySelector(selector);
    const guide = frame.querySelector(`.mepMeasureGuideLine[data-guide="${line}"]`);
    if (!target || !guide) return;

    const rect = target.getBoundingClientRect();
    let anchor = rect.bottom;
    if (mode === "top") anchor = rect.top;
    if (mode === "sum-bottom") anchor = frameRect.top + getMepCssVarValue("--mep-sum-bottom");
    const top = anchor - frameRect.top;
    guide.style.top = `${Math.max(0, top)}px`;
  });
}

function buildMepMeasurementOverlay() {
  const labels = MEP_MEASURE_FIELDS.map(({ cssVar, label }) => {
    const value = getMepMeasureDisplayValue(cssVar);
    return `<span class="mepMeasureLabel" data-mep-var="${cssVar}">${label}: ${formatMepMm(value)}</span>`;
  }).join("");

  return `
    <div class="mepMeasureOverlay no-print" aria-hidden="true">
      <div class="mepMeasureGrid"></div>
      <div class="mepMeasureGuides">${labels}</div>
      <div class="mepMeasureGuideLine mepMeasureGuideLine--main" data-guide="main-bottom"></div>
      <div class="mepMeasureGuideLine mepMeasureGuideLine--sum" data-guide="sum-bottom"></div>
      <div class="mepMeasureGuideLine mepMeasureGuideLine--footer" data-guide="footer-top"></div>
      <div class="mepMeasureGuideLine mepMeasureGuideLine--stand" data-guide="stand-bottom"></div>
    </div>
  `;
}

function renderMepMeasureControls() {
  const rows = MEP_MEASURE_FIELDS.map(({ cssVar, label }) => {
    const value = getMepMeasureDisplayValue(cssVar);
    return `
      <label class="mepMeasureControlRow">
        <span>${label}</span>
        <div class="mepMeasureControlInputWrap">
          <button type="button" data-step="-0.1" data-mep-var="${cssVar}">−</button>
          <input type="number" step="0.1" value="${value.toFixed(2)}" data-mep-var="${cssVar}">
          <span>mm</span>
          <button type="button" data-step="0.1" data-mep-var="${cssVar}">+</button>
        </div>
      </label>
    `;
  }).join("");

  return `
    <div id="mepMeasurePanel" class="mepMeasurePanel no-print" ${mepMeasureModeEnabled ? "" : "hidden"}>
      <strong>MEP Messwerte</strong>
      ${rows}
      <button type="button" id="mepMeasureResetBtn">MEP Messwerte zurücksetzen</button>
    </div>
  `;
}

function refreshMepMeasureUI() {
  MEP_MEASURE_FIELDS.forEach(({ cssVar, label }) => {
    const value = getMepMeasureDisplayValue(cssVar);
    const formatted = formatMepMm(value);

    document.querySelectorAll(`.mepMeasureLabel[data-mep-var="${cssVar}"]`).forEach((el) => {
      el.textContent = `${label}: ${formatted}`;
    });

    document.querySelectorAll(`.mepMeasureControlInputWrap input[data-mep-var="${cssVar}"]`).forEach((el) => {
      el.value = value.toFixed(2);
    });
  });
}


function buildEmployeeMainRowsForWeek(emp, weekDays) {
  const rows = [
    { label: "Beginn", key: "start" },
    { label: "Pause", key: "pause" },
    { label: "Ende", key: "end" },
    { label: "Summe / Tag", key: "sum" }
  ];

  const isPlaceholder = !emp || emp._placeholder;
  let html = "";

  rows.forEach((rowDef, rowIndex) => {
    html += '<tr>';

    if (rowIndex === 0) {
      html += `
        <td class="mepNameCell" rowspan="4">${isPlaceholder ? "" : renderHandText(emp.name || "", `name-${emp.id}`)}</td>
        <td class="mepFuncText" rowspan="4">${isPlaceholder ? "" : renderHandText(emp.roleKey || "", `role-${emp.id}`)}</td>
        <td class="mepPlanText" rowspan="4">${isPlaceholder ? "" : renderHandText(emp.target || "", `target-${emp.id}`)}</td>
      `;
    }

    html += `<td class="mepTypeCell">${rowDef.label}</td>`;

    weekDays.forEach((day) => {
      const dayData = isPlaceholder ? { start: "", pause: "", end: "", sum: "" } : getFormDayData(emp, day.iso);
      const value = dayData[rowDef.key] || "";
      const grayClass = day.isOutsideMonth ? ' mepDayValueCell--out' : '';

      html += `
        <td class="mepDayValueCell${grayClass}">
          ${value ? renderHandText(value, `${emp.id}-${day.iso}-${rowDef.key}`) : ""}
        </td>
      `;
    });

    html += '</tr>';
  });

  return html;
}

function buildMepHeader(sheetModel) {
  const { weekDays, pageIndex } = sheetModel;
  const weekStart = weekDays[0]?.date;
  const weekEnd = weekDays[6]?.date;
  if (!weekStart || !weekEnd) return "";

  const filiale = state.branchName || state.storeName || state.branch || "";
  const monthYearText = formatMonthYearLongForm(weekStart);

  return `
    <div class="mepHeader">
      <div class="mepHeaderTop">
        <div class="mepTitleBox">Mitarbeiter-Einsatz-Planung (MEP)</div>
        <div class="mepBranchBox">
          Filiale:
          <span class="mepHandField">
            ${renderHandText(filiale, `branch-${weekDays[0].iso}-${pageIndex}`)}
          </span>
        </div>
      </div>

      <div class="mepHeaderMeta">
        <div class="mepMetaDateRow">
          <div class="mepMetaField mepMetaMonth">
            <span class="mepMetaLabel">Monat/ Jahr</span>
            <span class="mepMetaLine">
              ${renderHandText(monthYearText, `month-year-${weekDays[0].iso}-${pageIndex}`)}
            </span>
          </div>

          <div class="mepMetaField mepMetaFrom">
            <span class="mepMetaLabel">Woche vom:</span>
            <span class="mepMetaLine">
              ${renderHandText(formatShortDateForm(weekStart), `week-from-${weekDays[0].iso}-${pageIndex}`)}
            </span>
          </div>

          <div class="mepMetaField mepMetaTo">
            <span class="mepMetaLabel">bis:</span>
            <span class="mepMetaLine">
              ${renderHandText(formatShortDateForm(weekEnd), `week-to-${weekDays[6].iso}-${pageIndex}`)}
            </span>
          </div>
        </div>

        <div class="mepMetaStorage">Aufbewahrung in der Filiale: 2 Jahre</div>
      </div>
    </div>
  `;
}

function buildMepMainTable(sheetModel) {
  const { weekDays, employees, pageIndex } = sheetModel;

  let html = `
    <div class="mepMainTableWrap">
      <div class="mepTableOuter">
        <table class="mepTable">
          <colgroup>
            <col style="width:31mm">
            <col style="width:10.5mm">
            <col style="width:11.5mm">
            <col style="width:15mm">
            <col style="width:16.2mm">
            <col style="width:16.2mm">
            <col style="width:16.2mm">
            <col style="width:16.2mm">
            <col style="width:16.2mm">
            <col style="width:16.2mm">
            <col style="width:16.2mm">
          </colgroup>
          <thead>
            <tr>
              <th class="mepNameCol" rowspan="3">Name, Vorname</th>
              <th class="mepFuncCol" rowspan="3">Funktion</th>
              <th class="mepPlanCol" rowspan="3">Plan / Woche</th>
              <th class="mepTypeCol">Wochentag</th>
  `;

   weekDays.forEach((day) => {
    const grayClass = day.isOutsideMonth
      ? ' class="mepDayCol mepDayCol--out"'
      : ' class="mepDayCol"';
    html += `<th${grayClass}>${day.weekdayLabel}</th>`;
  });

  html += `
            </tr>
            <tr>
              <th class="mepTypeCol">Datum</th>
  `;

  weekDays.forEach((day) => {
    const grayClass = day.isOutsideMonth
      ? ' class="mepSubHead mepDayCol--out"'
      : ' class="mepSubHead"';
    html += `<th${grayClass}><span class="mepDayDate">${renderHandText(formatShortDateForm(day.date), `head-date-${day.iso}-${pageIndex}`)}</span></th>`;
  });

  html += `
            </tr>
            <tr>
              <th class="mepTypeCol">Warentag</th>
  `;

  weekDays.forEach((day) => {
    const grayClass = day.isOutsideMonth
      ? ' class="mepSubHead mepDayCol--out"'
      : ' class="mepSubHead"';
    html += `<th${grayClass}></th>`;
  });

  html += `
            </tr>
          </thead>
          <tbody>
  `;

  employees.forEach((emp) => {
    html += buildEmployeeMainRowsForWeek(emp, weekDays);
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  return html;
}

function buildMepSumBlock(sheetModel) {
  const { employees, weekDays } = sheetModel;
  const pageEmployees = employees.slice();

  while (pageEmployees.length < getFormEmployeesPerPage()) {
    pageEmployees.push({
      id: `sum-empty-${pageEmployees.length + 1}`,
      _placeholder: true,
      name: "",
      roleKey: "",
      target: ""
    });
  }

  let html = `
    <div class="mepSumWrap">
      <div class="mepSumHeader">
        <div class="mepSumHeaderCell">Summe /<br>Woche</div>
        <div class="mepSumHeaderCell">Summe /<br>Monat</div>
      </div>
  `;

  pageEmployees.forEach((emp) => {
    const weekText = emp._placeholder
      ? ""
      : renderHandText(
          formatMinutesAsHourText(getWeekResolvedMinutesForEmployee(emp, weekDays)),
          `sum-week-${emp.id}`
        );

    const monthText = emp._placeholder
      ? ""
      : renderHandText(
          formatMinutesAsHourText(getMonthResolvedMinutesForEmployeeUntilWeek(emp, weekDays)),
          `sum-month-${emp.id}`
        );

    html += `
      <div class="mepSumRow">
        <div class="mepSumCell mepSumWeekCell">${weekText}</div>
        <div class="mepSumCell mepSumMonthCell">${monthText}</div>
      </div>
    `;
  });

  html += `</div>`;

  return html;
}
function buildMepFooter() {
  return `
    <div class="mepFooter">
      <div class="mepFooterGrid">
        <div class="mepFooterLeft">
          <div class="mepFooterHeading">Pausenzeiten:</div>
          <div>bis 6 Stunden: keine Pause</div>
          <div>mehr als 6 Stunden: 60 Minuten (+10 Min. bei Abrechnung)</div>
        </div>

        <div class="mepFooterCenter">
          <div class="mepFooterHeading">Abwesenheiten:</div>
          <div>Krankheit (AU-Bescheinigung)</div>
          <div>Schule (Führungsnachwuchskraft)</div>
        </div>

        <div class="mepFooterRight">
          <div>Feiertag</div>
          <div>Freizeit</div>
          <div>Urlaub</div>
        </div>
      </div>

      <div class="mepFooterHint">
        <strong>Anwesenheiten:</strong>
        Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.
        Am Ende der Woche: wöchentliche und monatliche Summe eintragen.
      </div>

      <div class="mepFooterStand">Stand: Oktober 2014</div>
    </div>
  `;
}


function getFormEmployeesPerPage() {
  return 9;
}

function chunkEmployeesForForm(employees, size = getFormEmployeesPerPage()) {
  const chunks = [];
  for (let i = 0; i < employees.length; i += size) {
    chunks.push(employees.slice(i, i + size));
  }
  return chunks.length ? chunks : [[]];
}

function getFormSheetModels() {
  const monthPlan = state.monthPlan;
  if (!monthPlan || !Array.isArray(monthPlan.weeks)) return [];

  const employeeChunks = chunkEmployeesForForm(state.employees || []);
  const models = [];

  monthPlan.weeks.forEach((weekDays, weekIndex) => {
    employeeChunks.forEach((employees, pageIndex) => {
      models.push({
        id: `week-${weekIndex + 1}-page-${pageIndex + 1}`,
        weekIndex,
        pageIndex,
        weekDays,
        employees,
        pageCount: employeeChunks.length
      });
    });
  });

  return models;
}

function getCurrentFormSheetIndex(sheetModels) {
  const maxIndex = Math.max(0, sheetModels.length - 1);
  const saved = Number(state.formSheetIndex || 0);
  if (!Number.isFinite(saved)) return 0;
  return Math.min(Math.max(0, saved), maxIndex);
}

function setCurrentFormSheetIndex(nextIndex, sheetModels) {
  state.formSheetIndex = Math.min(
    Math.max(0, nextIndex),
    Math.max(0, sheetModels.length - 1)
  );
}

function buildWeekSheet(sheetModel, { useTemplate = false } = {}) {
  const { weekDays, employees, weekIndex, pageIndex } = sheetModel;
  const weekStart = weekDays[0]?.date;
  const weekEnd = weekDays[6]?.date;
  if (!weekStart || !weekEnd) return "";

  const pageEmployees = employees.slice();

  while (pageEmployees.length < getFormEmployeesPerPage()) {
    pageEmployees.push({
      id: `empty-${weekIndex + 1}-${pageIndex + 1}-${pageEmployees.length + 1}`,
      _placeholder: true,
      name: "",
      roleKey: "",
      target: ""
    });
  }

  const filledSheetModel = { ...sheetModel, employees: pageEmployees };

  return `
    <section class="mepPrintPage">
      <div class="printSheet mepSheet ${useTemplate ? "mepUseTemplate" : ""}">
        ${useTemplate ? '<img class="mepReferenceImage" src="assets/mep-template-reference.jpg" alt="MEP Referenzformular" aria-hidden="true">' : ""}
        <div class="mepContentFrame">
          ${mepMeasureModeEnabled ? buildMepMeasurementOverlay() : ""}
          ${buildMepHeader(filledSheetModel)}

          <div class="mepBody">
            ${buildMepMainTable(filledSheetModel)}
            ${buildMepSumBlock(filledSheetModel)}
          </div>

          ${buildMepFooter()}
        </div>
      </div>
    </section>
  `;
}
function bindFormPager(sheetModels) {
  const prevBtn = document.getElementById("mepPrevPage");
  const nextBtn = document.getElementById("mepNextPage");
  const measureModeToggle = document.getElementById("mepMeasureModeToggle");

  if (prevBtn && nextBtn) {
    prevBtn.disabled = getCurrentFormSheetIndex(sheetModels) <= 0;
    nextBtn.disabled = getCurrentFormSheetIndex(sheetModels) >= sheetModels.length - 1;

    prevBtn.addEventListener("click", () => {
      setCurrentFormSheetIndex(getCurrentFormSheetIndex(sheetModels) - 1, sheetModels);
      renderFormView();
    });

    nextBtn.addEventListener("click", () => {
      setCurrentFormSheetIndex(getCurrentFormSheetIndex(sheetModels) + 1, sheetModels);
      renderFormView();
    });
  }

  if (measureModeToggle) {
    measureModeToggle.checked = mepMeasureModeEnabled;
    measureModeToggle.addEventListener("change", (event) => {
      mepMeasureModeEnabled = Boolean(event.target.checked);
      renderFormView();
    });
  }

  const measurePanel = document.getElementById("mepMeasurePanel");
  if (measurePanel) {
    measurePanel.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-mep-var]");
      if (!btn) return;

      const cssVar = btn.dataset.mepVar;
      const step = Number(btn.dataset.step || 0);
      if (!cssVar || !Number.isFinite(step)) return;

      const nextValue = getMepCssVarValue(cssVar) + step;
      applyMepMeasureVar(cssVar, nextValue);
      saveMepCalibration();
      refreshMepMeasureUI();
      updateMepMeasureDynamicGuides();
    });

    measurePanel.addEventListener("input", (event) => {
      const input = event.target.closest("input[data-mep-var]");
      if (!input) return;

      const cssVar = input.dataset.mepVar;
      const value = Number(input.value);
      if (!cssVar || !Number.isFinite(value)) return;

      applyMepMeasureVar(cssVar, value);
      saveMepCalibration();
      refreshMepMeasureUI();
      updateMepMeasureDynamicGuides();
    });
  }

  const resetBtn = document.getElementById("mepMeasureResetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetMepCalibration();
    });
  }
}
function renderFormPager(sheetModels, currentIndex) {
  const current = sheetModels[currentIndex];
  if (!current) return "";

  return `
    <div class="mepPager no-print">
      <button type="button" id="mepPrevPage">◀</button>
      <div class="mepPagerInfo">
        <strong>Originalformular</strong>
        <span>Woche ${current.weekIndex + 1} · Seite ${current.pageIndex + 1} / ${current.pageCount}</span>
      </div>
      <label class="mepMeasureToggle">
        <input type="checkbox" id="mepMeasureModeToggle" ${mepMeasureModeEnabled ? "checked" : ""}>
        MEP Messmodus
      </label>
      <button type="button" id="mepNextPage">▶</button>
    </div>
    ${renderMepMeasureControls()}
  `;
}
function renderFormView() {
  initMepCalibration();

  const container = document.getElementById("formView");
  if (!container) return;

  const sheetModels = getFormSheetModels();

  if (!sheetModels.length) {
    container.innerHTML = "<div class='small'>Kein Formular verfügbar.</div>";
    return;
  }

  const currentIndex = getCurrentFormSheetIndex(sheetModels);
  const currentSheet = sheetModels[currentIndex];

  const currentWeekSheets = sheetModels.filter(
    (sheet) => sheet.weekIndex === currentSheet.weekIndex
  );

  const screenHtml = buildWeekSheet(currentSheet, { useTemplate: true });
  const printHtml = currentWeekSheets.map((sheet) => buildWeekSheet(sheet)).join("");

  container.innerHTML = `
    ${renderFormPager(sheetModels, currentIndex)}

    <div class="mepScreenStage ${mepMeasureModeEnabled ? "mepMeasureMode" : ""}">
      ${screenHtml}
    </div>

    <div class="mepPrintAll">
      ${printHtml}
    </div>
  `;

  bindFormPager(sheetModels);
  updateMepMeasureDynamicGuides();
}
