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

  const start = entry.start || "";
  const end = entry.end || "";
  const breakMinutes = Number(entry.breakMinutes || 0);

  if (!start || !end || breakMinutes <= 0) return "";
  if (entry.mode === "early") return "";

  if (entry.mode === "late") {
    const startMinutes = hhmmToMinutes(start);
    return startMinutes <= hhmmToMinutes("14:00") ? "16:00-16:10" : "17:00-17:10";
  }

  if (entry.mode === "full") {
    if (breakMinutes === 70) return "14:00-15:10";
    if (breakMinutes === 60) return "14:00-15:00";
  }

  if (entry.mode === "flex") {
    const startMinutes = hhmmToMinutes(start);
    const endMinutes = hhmmToMinutes(end);
    const span = endMinutes - startMinutes;
    if (span <= 0) return "";

    const mid = startMinutes + Math.floor(span / 2);
    const breakStart = mid - Math.floor(breakMinutes / 2);
    const breakEnd = breakStart + breakMinutes;

    return `${minutesToHHMM(breakStart)}-${minutesToHHMM(breakEnd)}`;
  }

  return "";
}

function getResolvedFormDayData(emp, isoDate) {
  const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);

  if (!resolved) return { start: "", pause: "", end: "", sum: "" };

  if (resolved.type === "holiday") {
    return { start: "Feiertag", pause: "", end: "", sum: minutesToHM(resolved.minutesForMonth) };
  }

  if (resolved.type === "sick") {
    return { start: "K", pause: "", end: "", sum: minutesToHM(resolved.minutesForMonth) };
  }

  if (resolved.type === "vacation") {
    return { start: "U", pause: "", end: "", sum: minutesToHM(resolved.minutesForMonth) };
  }

  if (resolved.type === "external-help") {
    const branch = resolved.sourceEntry?.branch || "";
    return { start: "AH", pause: branch, end: "", sum: minutesToHM(resolved.minutesForMonth) };
  }

  if (resolved.type === "shift" && resolved.sourceEntry) {
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
  <col style="width:29mm">
  <col style="width:10mm">
  <col style="width:11mm">
  <col style="width:14mm">
  <col style="width:15.4mm">
  <col style="width:15.4mm">
  <col style="width:15.4mm">
  <col style="width:15.4mm">
  <col style="width:15.4mm">
  <col style="width:15.4mm">
  <col style="width:15.4mm">
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

  html += `
    </div>
  `;

  return html;
}
function buildMepFooter() {
  return `
    <div class="mepFooter">
      <div class="mepFooterGrid">
        <div class="mepFooterLeft">
          <div><strong>Pausenzeiten:</strong></div>
          <div>bis 6 Stunden: keine Pause</div>
          <div>mehr als 6 Stunden: 60 Minuten</div>
        </div>

        <div class="mepFooterCenter">
          <div><strong>Abwesenheiten:</strong></div>
          <div>Feiertag</div>
          <div>Freizeit</div>
          <div>Krankheit (AU-Bescheinigung)</div>
          <div>Schule (Führungsnachwuchskraft)</div>
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

function buildWeekSheet(sheetModel) {
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

  return `
    <section class="mepPrintPage">
      <div class="printSheet mepSheet mepUseTemplate">
        <div class="mepContentFrame">
          ${buildMepHeader({ ...sheetModel, employees: pageEmployees })}

         <div class="mepBody">
  ${buildMepMainTable({ ...sheetModel, employees: pageEmployees })}
  ${buildMepSumBlock({ ...sheetModel, employees: pageEmployees })}
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
  if (!prevBtn || !nextBtn) return;

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
      <button type="button" id="mepNextPage">▶</button>
    </div>
  `;
}
function renderFormView() {
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

  const screenHtml = buildWeekSheet(currentSheet);
  const printHtml = currentWeekSheets.map((sheet) => buildWeekSheet(sheet)).join("");

  container.innerHTML = `
    ${renderFormPager(sheetModels, currentIndex)}

    <div class="mepScreenStage">
      ${screenHtml}
    </div>

    <div class="mepPrintAll">
      ${printHtml}
    </div>
  `;

  bindFormPager(sheetModels);
}

