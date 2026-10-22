function getMonthViewContentEl() {
  return document.getElementById("monthViewContent");
}

function getActiveMonthDays() {
  const monthPlan = state.monthPlan;
  if (!monthPlan?.weeks) return [];

  const days = [];
  monthPlan.weeks.forEach((week) => {
    week.forEach((day) => {
      if (day.inCurrentMonth) {
        days.push(day);
      }
    });
  });

  return days;
}

function buildMonthWeekSummaryRow(days, employees, options = {}) {
  const { includeSummaryColumns = true } = options;
  const weekSummaries = getMonthWeekSummaries(days, employees, {
    getActualMinutes: (employee, weekDays) => (
      getEmployeeBranchMinutesForWeek(employee, weekDays, state.activeMonth)
    ),
    getTargetMinutes: (employee, weekDays) => (
      getEmployeeTargetMinutesForWeek(employee, weekDays, state.activeMonth)
    )
  });

  let html = `
    <tr class="monthWeekSummaryRow">
      <th class="monthWeekSummaryLead" aria-label="Wochenübersicht">KW</th>
  `;

  weekSummaries.forEach((summary) => {
    const summaryLabel = [
      `KW ${summary.week}`,
      `Einsatz ${formatMinutesAsDecimalHours(summary.actualMinutes)} h`,
      `MA-Soll ${formatMinutesAsDecimalHours(summary.targetMinutes)} h`,
      `Filial-Soll ${formatMinutesAsDecimalHours(summary.branchTargetMinutes)} h`
    ].join(" · ");
    html += `
      <th class="monthWeekSummaryCell${summary.days.length <= 2 ? " monthWeekSummaryCellCompact" : ""}" colspan="${summary.days.length}" title="${summaryLabel}" aria-label="${summaryLabel}">
        <span class="monthWeekSummaryFull">${summaryLabel}</span>
        <span class="monthWeekSummaryCompact">KW ${summary.week} · ${formatMinutesAsDecimalHours(summary.actualMinutes)} h</span>
      </th>
    `;
  });

  if (includeSummaryColumns) {
    html += `
      <th class="monthWeekSummarySpacer" aria-hidden="true"></th>
      <th class="monthWeekSummarySpacer" aria-hidden="true"></th>
      <th class="monthWeekSummarySpacer" aria-hidden="true"></th>
    `;
  }

  return `${html}</tr>`;
}

function buildMonthHeaderRow(days, options = {}) {
  const { includeSummaryColumns = true } = options;
  let html = `
    <tr class="monthDateHeaderRow">
      <th>Name</th>
  `;

  days.forEach((day) => {
    const isSunday = day.weekdayIndex === 6;
    const className = isSunday ? ` class="monthHeadSunday"` : "";
    html += `<th${className}>${pad2(day.date.getDate())}<br>${day.weekdayLabel}</th>`;
  });

  if (includeSummaryColumns) {
    html += `
      <th>Monat Ist</th>
      <th>Δ Monat</th>
      <th>Gesamtminus</th>
    `;
  }

  html += `
    </tr>
  `;

  return html;
}

function buildMonthEmployeeRow(emp, days, options = {}) {
  const { includeSummaryColumns = true } = options;
  let html = `
    <tr>
      <td class="nameRoleCell">
        <div class="nameRoleName">${emp.name || "—"}</div>
        <div class="nameRoleSub">${emp.roleKey || "-"}</div>
      </td>
  `;

  let monthMinutes = 0;

  days.forEach((day) => {
    const resolved = getResolvedEntryForEmployeeOnIso(emp, day.iso);
    const selectValue = getWeekSelectValueForDay(emp, day.iso);
    const className = getMonthCellClass(resolved, day, selectValue);

    monthMinutes += resolved.minutesForMonth || 0;
    const cellText = getMonthCellText(resolved, {
      formatQuarterLabel: formatHMToQuarterLabel
    });

    html += `
  <td
    class="${className} monthCellClickable"
    data-emp-id="${emp.id}"
    data-iso="${day.iso}"
    title="Klicken zum Bearbeiten"
  >
    ${cellText}
  </td>
`;
  });

  if (includeSummaryColumns) {
    const monthIsManual = isMonthActualManual(emp, state.activeMonth);
    const manualMarker = monthIsManual
      ? '<span class="manualMonthMarker" aria-label="Monats-Ist manuell" title="Monats-Iststunden manuell hinterlegt.">•</span>'
      : "";
    const monthDisplayMinutes = getEffectiveMonthActualMinutes(emp, state.activeMonth, monthMinutes);
    const monthDifferenceMinutes = getEmployeeMonthDifferenceMinutes(emp);
    const totalMinusMinutes = getEmployeeTotalMinusMinutes(emp);
    const monthDeltaTitle = monthIsManual
      ? "Delta des Monats. Iststunden manuell hinterlegt."
      : "Delta des Monats.";
    const monthActualTitle = monthIsManual
      ? "Monats-Iststunden manuell hinterlegt."
      : "Monats-Iststunden planbasiert berechnet.";

    html += `
      <td class="weekHoursCell" title="${monthActualTitle}">${minutesToHM(monthDisplayMinutes)}${manualMarker}<button type="button" class="hourBreakdownButton no-print" data-hours-person="${emp.id}" aria-label="Stundenkonto aufschlüsseln">Details</button></td>
      <td class="weekDeltaCell" title="${monthDeltaTitle}">${formatSignedMinutes(monthDifferenceMinutes)}</td>
      <td class="weekDeltaCell">${totalMinusMinutes > 0 ? `-${minutesToHM(totalMinusMinutes)}` : "0:00"}</td>
    `;
  }

  html += `
    </tr>
  `;

  return html;
}
function bindMonthCellActions(scopeEl = document) {
  scopeEl.querySelectorAll?.("[data-hours-person]").forEach(button => {
    button.addEventListener("click", () => openEmployeeHourBreakdown(button.dataset.hoursPerson));
  });
  const tables = scopeEl?.querySelectorAll?.("table")?.length
    ? [...scopeEl.querySelectorAll("table")]
    : [document.getElementById("monthTable")].filter(Boolean);
  if (!tables.length) return;

  tables.forEach((table) => {
    table.querySelectorAll(".monthCellClickable").forEach((cell) => {
      cell.addEventListener("click", () => {
        const empId = cell.dataset.empId;
        const isoDate = cell.dataset.iso;

        const emp = state.employees.find((e) => e.id === empId);
        if (!emp || !isoDate) return;

        const currentValue = getWeekSelectValueForDay(emp, isoDate);
        if (monthMultiPlanShift) {
          applyMonthMultiPlanShift(emp, isoDate, cell);
          return;
        }
        if (currentValue === "H") return;

        const dialogType = getShiftCodeForSelectValue(currentValue);
        if (dialogType) {
          if (openShiftDialogForSelectValue(dialogType, { emp, isoDate, source: "month" })) return;
        }

        openMonthFallbackDialog(emp, isoDate, cell);
      });
    });
  });
}

function getShiftedYearMonth(yearMonth, offset) {
  const activeMonth = yearMonth || state.activeMonth || toIsoDate(new Date()).slice(0, 7);
  const [year, month] = activeMonth.split("-").map(Number);
  const nextDate = new Date(year, month - 1 + offset, 1);

  return `${nextDate.getFullYear()}-${pad2(nextDate.getMonth() + 1)}`;
}

function shiftActiveMonth(offset) {
  state.activeMonth = getShiftedYearMonth(state.activeMonth, offset);

  // state.weekFrom bleibt bewusst unverändert: Für die aktuelle MEP-Monatsansicht
  // ist state.activeMonth die maßgebliche Quelle, und getActiveWeekDays fällt bei
  // einem Monatssprung ohnehin auf die erste sichtbare Woche des neuen Monats zurück.
  syncMonthPlanToState();
  saveAppStateDebounced();
  renderAllViews();
}

function bindMonthNavigation() {
  document.getElementById("monthPrev")?.addEventListener("click", () => {
    shiftActiveMonth(-1);
  });

  document.getElementById("monthNext")?.addEventListener("click", () => {
    shiftActiveMonth(1);
  });

  document.getElementById("overviewMonthPrev")?.addEventListener("click", () => {
    shiftActiveMonth(-1);
  });

  document.getElementById("overviewMonthNext")?.addEventListener("click", () => {
    shiftActiveMonth(1);
  });
}

function updateMonthHeaderTitle(days) {
  const titleEl = document.getElementById("monthTitle");
  if (!titleEl) return;

  titleEl.textContent = getMonthTitleFromDays(days);
}

function buildMonthViewMarkup(days, options = {}) {
  const {
    tableId = "monthTable",
    tableClass = "",
    activeEmployees = state.employees.filter((emp) => isEmployeeActiveInMonth(emp, state.activeMonth)),
    includeSummaryColumns = true,
    withViewHeader = true
  } = options;
  const effectiveTableClass = [tableClass, monthMultiPlanShift ? "monthMultiPlanActive" : ""].filter(Boolean).join(" ");
  const tableClassAttr = effectiveTableClass ? ` class="${effectiveTableClass}"` : "";
  let html = `
  `;

  if (withViewHeader) {
    html += `
    <div class="monthViewHeader">
      <strong>${getMonthTitleFromDays(days)}</strong>
      <span class="small">${days.length} Tage im aktuellen Monat</span>
    </div>
    `;
  }

  if (monthMultiPlanShift) {
    html += `
      <div class="monthMultiPlanBar" role="status">
        <strong>Mehrfach: ${getMonthMultiPlanShiftLabel(monthMultiPlanShift)}</strong>
        <span class="monthMultiPlanFeedback" aria-live="polite">${monthMultiPlanFeedback}</span>
        <button type="button" class="monthMultiPlanStopBtn">Beenden</button>
      </div>
    `;
  }

  html += `
    <table id="${tableId}"${tableClassAttr}>
      <thead>
        ${buildMonthWeekSummaryRow(days, activeEmployees, { includeSummaryColumns })}
        ${buildMonthHeaderRow(days, { includeSummaryColumns })}
      </thead>
      <tbody>
  `;

  activeEmployees.forEach((emp) => {
    html += buildMonthEmployeeRow(emp, days, { includeSummaryColumns });
  });

  html += `
      </tbody>
    </table>
  `;

  return html;
}

function renderMonthTableInto(container, options = {}) {
  if (!container) return;
  const {
    withHeaderTitle = true,
    tableId = "monthTable",
    tableClass = "",
    days = null,
    activeEmployees = null,
    includeSummaryColumns = true,
    withViewHeader = true
  } = options;

  container.innerHTML = "";

  const tableDays = Array.isArray(days) ? days : getActiveMonthDays();
  if (!tableDays.length) {
    container.innerHTML = "<div class='small'>Kein Monat geladen.</div>";
    return;
  }

  if (withHeaderTitle) updateMonthHeaderTitle(tableDays);
  container.innerHTML = buildMonthViewMarkup(tableDays, {
    tableId,
    tableClass,
    activeEmployees: Array.isArray(activeEmployees) ? activeEmployees : undefined,
    includeSummaryColumns,
    withViewHeader
  });

  bindMonthCellActions(container);
  container.querySelector?.(".monthMultiPlanStopBtn")?.addEventListener("click", stopMonthMultiPlan);
}

function renderMonthView() {
  renderMonthTableInto(getMonthViewContentEl(), {
    withHeaderTitle: true,
    tableId: "monthTable"
  });
}
