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

function buildEmployeeRowsForWeek(emp, weekDays) {
  const rows = [
    { label: "Beginn", key: "start" },
    { label: "Pause", key: "pause" },
    { label: "Ende", key: "end" },
    { label: "Summe / Tag", key: "sum" }
  ];

  const isPlaceholder = !emp || emp._placeholder;
  let html = "";
  const weekMinutes = isPlaceholder ? 0 : getWeekResolvedMinutesForEmployee(emp, weekDays);
  const monthMinutes = isPlaceholder ? 0 : getMonthResolvedMinutesForEmployeeUntilWeek(emp, weekDays);

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

    if (rowIndex === 0) {
      html += `
        <td class="mepWeekText" rowspan="4">${isPlaceholder || weekMinutes <= 0 ? "" : renderHandText(minutesToHM(weekMinutes), `week-${emp.id}-${weekDays[0]?.iso || ''}`)}</td>
        <td class="mepMonthText" rowspan="4">${isPlaceholder || monthMinutes <= 0 ? "" : renderHandText(minutesToHM(monthMinutes), `month-${emp.id}-${weekDays[0]?.iso || ''}`)}</td>
      `;
    }

    html += '</tr>';
  });

  return html;
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
  state.formSheetIndex = Math.min(Math.max(0, nextIndex), Math.max(0, sheetModels.length - 1));
}

function buildWeekSheet(sheetModel) {
  const { weekDays, employees, weekIndex, pageIndex, pageCount } = sheetModel;
  const weekStart = weekDays[0]?.date;
  const weekEnd = weekDays[6]?.date;
  if (!weekStart || !weekEnd) return "";

  const filiale = state.branchName || state.storeName || state.branch || "";
  const monthYearText = formatMonthYearLongForm(weekStart);
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

  let html = `
    <div class="printSheet mepSheet">
      <div class="mepHeaderTop">
        <div class="mepTitleBox">Mitarbeiter-Einsatz-Planung (MEP)</div>
        <div class="mepBranchBox">Filiale: <span class="mepHandField">${renderHandText(filiale, `branch-${weekDays[0].iso}-${pageIndex}`)}</span></div>
      </div>

      <div class="mepHeaderMeta">
        <div class="mepMetaField mepMetaMonth">
          <span class="mepMetaLabel">Monat/ Jahr</span>
          <span class="mepMetaLine">${renderHandText(monthYearText, `month-year-${weekDays[0].iso}-${pageIndex}`)}</span>
        </div>
        <div class="mepMetaField mepMetaFrom">
          <span class="mepMetaLabel">Woche vom:</span>
          <span class="mepMetaLine">${renderHandText(formatShortDateForm(weekStart), `week-from-${weekDays[0].iso}-${pageIndex}`)}</span>
        </div>
        <div class="mepMetaField mepMetaTo">
          <span class="mepMetaLabel">bis:</span>
          <span class="mepMetaLine">${renderHandText(formatShortDateForm(weekEnd), `week-to-${weekDays[6].iso}-${pageIndex}`)}</span>
        </div>
        <div class="mepMetaStorage">Aufbewahrung in der Filiale: 2 Jahre</div>
      </div>

      <div class="mepTableOuter">
        <table class="mepTable">
          <thead>
            <tr>
              <th class="mepNameCol" rowspan="3">Name, Vorname</th>
              <th class="mepFuncCol" rowspan="3">Funktion</th>
              <th class="mepPlanCol" rowspan="3">Plan / Woche</th>
              <th class="mepTypeCol">Wochentag</th>
  `;

  weekDays.forEach((day) => {
    const grayClass = day.isOutsideMonth ? ' class="mepDayCol mepDayCol--out"' : ' class="mepDayCol"';
    html += `<th${grayClass}>${day.weekdayLabel}</th>`;
  });

  html += `
              <th class="mepWeekCol" rowspan="3">Summe /<br>Woche</th>
              <th class="mepMonthCol" rowspan="3">Summe /<br>Monat</th>
            </tr>
            <tr>
              <th class="mepTypeCol">Datum</th>
  `;

  weekDays.forEach((day) => {
    const grayClass = day.isOutsideMonth ? ' class="mepSubHead mepDayCol--out"' : ' class="mepSubHead"';
    html += `<th${grayClass}><span class="mepDayDate">${renderHandText(formatShortDateForm(day.date), `head-date-${day.iso}-${pageIndex}`)}</span></th>`;
  });

  html += `
            </tr>
            <tr>
              <th class="mepTypeCol">Warentag</th>
  `;

  weekDays.forEach((day) => {
    const grayClass = day.isOutsideMonth ? ' class="mepSubHead mepDayCol--out"' : ' class="mepSubHead"';
    html += `<th${grayClass}></th>`;
  });

  html += `
            </tr>
          </thead>
          <tbody>
  `;

  pageEmployees.forEach((emp) => {
    html += buildEmployeeRowsForWeek(emp, weekDays);
  });

  html += `
          </tbody>
        </table>
      </div>

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

  return html;
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

const MEP_EMPLOYEES_PER_PAGE = 9;

let formViewWeekIndex = 0;
let formViewPageIndex = 0;

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function padMepEmployees(employees, size = MEP_EMPLOYEES_PER_PAGE) {
  const list = employees.slice(0, size);
  while (list.length < size) {
    list.push(null);
  }
  return list;
}

function getAllWeekGroupsForForm() {
  const monthPlan = state.monthPlan;
  if (!monthPlan?.weeks) return [];

  return monthPlan.weeks
    .map((week) => week.filter(Boolean))
    .filter((week) => week.length > 0);
}

function getCurrentFormWeekDays() {
  const weeks = getAllWeekGroupsForForm();
  if (!weeks.length) return [];

  const safeWeekIndex = Math.max(0, Math.min(formViewWeekIndex, weeks.length - 1));
  formViewWeekIndex = safeWeekIndex;

  return weeks[safeWeekIndex];
}

function getEmployeesForFormPages() {
  return Array.isArray(state.employees) ? state.employees.slice() : [];
}

function getFormPagesForCurrentWeek() {
  const employees = getEmployeesForFormPages();
  const employeeChunks = chunkArray(employees, MEP_EMPLOYEES_PER_PAGE);

  if (employeeChunks.length === 0) {
    employeeChunks.push([]);
  }

  return employeeChunks.map((chunk) => padMepEmployees(chunk));
}

function buildHandClass(seed = 0) {
  const variants = ["handVar1", "handVar2", "handVar3", "handVar4"];
  return `mepHand ${variants[Math.abs(seed) % variants.length]}`;
}

function formatMonthYearForForm(days) {
  const first = days?.[0]?.date;
  if (!first) return "";

  const months = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  return `${months[first.getMonth()]} ${first.getFullYear()}`;
}

function formatWeekRangeForForm(days) {
  if (!days?.length) return { from: "", to: "" };

  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;

  const from = first ? `${pad2(first.getDate())}.${pad2(first.getMonth() + 1)}` : "";
  const to = last ? `${pad2(last.getDate())}.${pad2(last.getMonth() + 1)}` : "";

  return { from, to };
}

function buildFormDayHeaderCells(days) {
  const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return days.map((day, index) => {
    const weekday = dayNames[index] || day.weekdayLabel || "";
    const dateText = `${pad2(day.date.getDate())}.${pad2(day.date.getMonth() + 1)}`;

    return `
      <th class="mepDayCol ${day.isOutsideMonth ? "mepDayCol--out" : ""}">
        <div class="mepDayName">${weekday}</div>
        <div class="mepDayDate ${buildHandClass(index)}">${dateText}</div>
      </th>
    `;
  }).join("");
}

function getFormDayValuesForEmployee(emp, iso) {
  if (!emp) {
    return {
      start: "",
      pause: "",
      end: "",
      sum: ""
    };
  }

  const resolved = getResolvedEntryForEmployeeOnIso(emp, iso);
  if (!resolved) {
    return { start: "", pause: "", end: "", sum: "" };
  }

  if (resolved.type === "vacation") {
    return { start: "U", pause: "", end: "", sum: "" };
  }

  if (resolved.type === "sick") {
    return { start: "K", pause: "", end: "", sum: "" };
  }

  if (resolved.type === "external-help") {
    const minutes = resolved.minutesForMonth || resolved.sourceEntry?.minutes || 0;
    return {
      start: "AH",
      pause: minutes > 0 ? minutesToHM(minutes) : "",
      end: "",
      sum: minutes > 0 ? minutesToHM(minutes) : ""
    };
  }

  if (resolved.type === "shift" && resolved.sourceEntry) {
    const entry = resolved.sourceEntry;
    const start = entry.start || "";
    const end = entry.end || "";
    const pause = entry.pause ? entry.pause : "";
    const sum = resolved.minutesForMonth ? minutesToHM(resolved.minutesForMonth) : "";

    return { start, pause, end, sum };
  }

  return { start: "", pause: "", end: "", sum: "" };
}

function buildEmployeeRowsForForm(emp, days, seedBase = 0) {
  const roleText = emp?.roleKey || "";
  const targetText = emp?.target || "";

  const dayRows = [
    { label: "Beginn", key: "start" },
    { label: "Pause", key: "pause" },
    { label: "Ende", key: "end" },
    { label: "Summe / Tag", key: "sum" }
  ];

  const weekTotal = emp ? minutesToHM(totalMinutesForEmployee(emp)) : "";
  const monthTotal = emp ? minutesToHM(getMonthTotalForEmployee(emp)) : "";

  return dayRows.map((row, rowIndex) => {
    const showLeftCells = rowIndex === 0;

    return `
      <tr class="mepEmployeeBlock">
        ${showLeftCells ? `
          <td class="mepNameCell mepNameCol" rowspan="4">
            ${emp ? `<span class="${buildHandClass(seedBase)}">${emp.name || ""}</span>` : ""}
          </td>
          <td class="mepFuncText mepFuncCol" rowspan="4">
            ${emp ? `<span class="${buildHandClass(seedBase + 1)}">${roleText}</span>` : ""}
          </td>
          <td class="mepPlanText mepPlanCol" rowspan="4">
            ${emp ? `<span class="${buildHandClass(seedBase + 2)}">${targetText}</span>` : ""}</td>
        ` : ""}

        <td class="mepTypeCell mepTypeCol">${row.label}</td>

        ${days.map((day, i) => {
          const values = getFormDayValuesForEmployee(emp, day.iso);
          const text = values[row.key] || "";
          return `
            <td class="mepDayValueCell ${day.isOutsideMonth ? "mepDayValueCell--out" : ""}">
              ${text ? `<span class="${buildHandClass(seedBase + 10 + i + rowIndex)}">${text}</span>` : ""}
            </td>
          `;
        }).join("")}

        ${showLeftCells ? `
          <td class="mepWeekText mepWeekCol" rowspan="4">
            ${emp ? `<span class="${buildHandClass(seedBase + 30)}">${weekTotal}</span>` : ""}
          </td>
          <td class="mepMonthText mepMonthCol" rowspan="4">
            ${emp ? `<span class="${buildHandClass(seedBase + 31)}">${monthTotal}</span>` : ""}
          </td>
        ` : ""}
      </tr>
    `;
  }).join("");
}

function buildSingleMepPage(days, employeesOnPage, weekIndex, pageIndex, totalPages) {
  const monthYear = formatMonthYearForForm(days);
  const range = formatWeekRangeForForm(days);

  const rowsHtml = employeesOnPage
    .map((emp, index) => buildEmployeeRowsForForm(emp, days, index * 40))
    .join("");

  return `
    <section class="formPage mepPrintPage">
      <div class="mepSheet">
        <div class="mepHeaderTop">
          <div class="mepTitleBox">Mitarbeiter-Einsatz-Planung (MEP)</div>
          <div class="mepBranchBox">Filiale:</div>
        </div>

        <div class="mepHeaderMeta">
          <div class="mepMetaField">
            <span class="mepMetaLabel">Monat / Jahr</span>
            <span class="mepMetaLine"><span class="${buildHandClass(100)}">${monthYear}</span></span>
          </div>

          <div class="mepMetaField">
            <span class="mepMetaLabel">Woche vom:</span>
            <span class="mepMetaLine"><span class="${buildHandClass(101)}">${range.from}</span></span>
          </div>

          <div class="mepMetaField">
            <span class="mepMetaLabel">bis:</span>
            <span class="mepMetaLine"><span class="${buildHandClass(102)}">${range.to}</span></span>
          </div>

          <div class="mepMetaStorage">Aufbewahrung in der Filiale: 2 Jahre</div>
        </div>

        <div class="mepTableOuter">
          <table class="mepTable">
            <thead>
              <tr>
                <th class="mepNameCol" rowspan="3">Name, Vorname</th>
                <th class="mepFuncCol" rowspan="3">Funktion</th>
                <th class="mepPlanCol" rowspan="3">Plan / Woche</th>
                <th class="mepTypeCol">Wochentag</th>
                ${buildFormDayHeaderCells(days)}
                <th class="mepWeekCol" rowspan="3">Summe / Woche</th>
                <th class="mepMonthCol" rowspan="3">Summe / Monat</th>
              </tr>
              <tr>
                <th class="mepTypeCol">Datum</th>
                ${days.map((day, i) => `
                  <th class="mepSubHead ${day.isOutsideMonth ? "mepDayCol--out" : ""}">
                    <span class="${buildHandClass(200 + i)}">${pad2(day.date.getDate())}.${pad2(day.date.getMonth() + 1)}</span>
                  </th>
                `).join("")}
              </tr>
              <tr>
                <th class="mepTypeCol">Warentag</th>
                ${days.map(() => `<th class="mepSubHead"></th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div class="mepFooterGrid mepFooter">
          <div class="mepFooterLeft">
            <strong>Pausenzeiten:</strong><br>
            bis 6 Stunden: keine Pause<br>
            mehr als 6 Stunden: 60 Minuten
          </div>

          <div class="mepFooterCenter">
            <strong>Abwesenheiten:</strong>
            <span>Feiertag</span>
            <span>Freizeit</span>
            <span>Krankheit (AU-Bescheinigung)</span>
            <span>Schule (Führungsnachwuchskraft)</span>
            <span>Urlaub</span>
          </div>
        </div>

        <div class="mepFooterHint">
          <strong>Anwesenheiten:</strong>
          Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.
          Am Ende der Woche: wöchentliche und monatliche Summe eintragen.
        </div>

        <div class="mepFooterStand">Stand: Oktober 2014</div>
      </div>
    </section>
  `;
}

function renderFormView() {
  const container = document.getElementById("formView");
  if (!container) return;

  const weekDays = getCurrentFormWeekDays();
  if (!weekDays.length) {
    container.innerHTML = "<div class='small'>Keine Formularwoche vorhanden.</div>";
    return;
  }

  const pages = getFormPagesForCurrentWeek();
  const safePageIndex = Math.max(0, Math.min(formViewPageIndex, pages.length - 1));
  formViewPageIndex = safePageIndex;

  const currentPageHtml = buildSingleMepPage(
    weekDays,
    pages[safePageIndex],
    formViewWeekIndex,
    safePageIndex,
    pages.length
  );

  const allPrintPagesHtml = pages
    .map((pageEmployees, index) =>
      buildSingleMepPage(weekDays, pageEmployees, formViewWeekIndex, index, pages.length)
    )
    .join("");

  container.innerHTML = `
    <div class="mepPager">
      <button type="button" id="mepPagePrev">◀</button>
      <div class="mepPagerInfo">
        <strong>Originalformular</strong>
        <span>Woche ${formViewWeekIndex + 1} · Seite ${safePageIndex + 1} / ${pages.length}</span>
      </div>
      <button type="button" id="mepPageNext">▶</button>
    </div>

    <div class="mepScreenStage">
      ${currentPageHtml}
    </div>

    <div class="mepPrintAll">
      ${allPrintPagesHtml}
    </div>
  `;

  document.getElementById("mepPagePrev")?.addEventListener("click", () => {
    if (formViewPageIndex > 0) {
      formViewPageIndex -= 1;
      renderFormView();
    }
  });

  document.getElementById("mepPageNext")?.addEventListener("click", () => {
    if (formViewPageIndex < pages.length - 1) {
      formViewPageIndex += 1;
      renderFormView();
    }
  });
}
