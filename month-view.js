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

function getMonthTitleFromDays(days) {
  if (!days.length) return "Monat";

  const firstDate = days[0].date;
  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  return `${monthNames[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
}

function getMonthCellClass(resolved, day) {
  const classes = ["monthCell"];
  const status = getResolvedStatus(resolved);

  if (day.weekdayIndex === 6) classes.push("monthCellSunday");
  if (resolved.type === "holiday") classes.push("monthCellHoliday");
  if (status === ENTRY_STATUS.VACATION) classes.push("monthCellVacation");
  if (status === ENTRY_STATUS.SICK) classes.push("monthCellSick");
  if (status === ENTRY_STATUS.EXTERNAL) classes.push("monthCellExternalHelp");
  if (status === ENTRY_STATUS.WORK) classes.push("monthCellShift");

  return classes.join(" ");
}

function buildMonthHeaderRow(days) {
  let html = `
    <tr>
      <th>Name</th>
  `;

  days.forEach((day) => {
    const isSunday = day.weekdayIndex === 6;
    const className = isSunday ? ` class="monthHeadSunday"` : "";
    html += `<th${className}>${pad2(day.date.getDate())}<br>${day.weekdayLabel}</th>`;
  });

  html += `
      <th>Monat Ist</th>
      <th>Δ Monat</th>
      <th>Gesamtminus</th>
    </tr>
  `;

  return html;
}

function buildMonthEmployeeRow(emp, days) {
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
    const className = getMonthCellClass(resolved, day);

    monthMinutes += resolved.minutesForMonth || 0;

    let cellText = resolved.label || "";
    const status = getResolvedStatus(resolved);

if (status === ENTRY_STATUS.WORK) {
  const entry = resolved.sourceEntry || resolved;

  if (entry.start && entry.end) {
    if (entry.mode === "flex") {
      cellText = `${formatHMToQuarterLabel(entry.start)}-${formatHMToQuarterLabel(entry.end)}`;
    } else {
      cellText = `${entry.start}-${entry.end}`;
    }
  } else if (entry.code) {
    cellText = entry.code;
  }
} else if (status === ENTRY_STATUS.VACATION || status === ENTRY_STATUS.SICK || status === ENTRY_STATUS.EXTERNAL) {
  cellText = getStatusShortLabel(status);
}
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

  const monthIsManual = isMonthActualManual(emp, state.activeMonth);
  const manualMonthActualMinutes = getManualMonthActualMinutes(emp, state.activeMonth);
  const monthDisplayMinutes = monthIsManual && manualMonthActualMinutes !== null
    ? manualMonthActualMinutes
    : monthMinutes;
  const monthDifferenceMinutes = getEmployeeMonthDifferenceMinutes(emp);
  const totalMinusMinutes = getEmployeeTotalMinusMinutes(emp);
  const monthDeltaTitle = monthIsManual
    ? "Delta des Monats. Iststunden manuell hinterlegt."
    : "Delta des Monats.";
  const monthActualTitle = monthIsManual
    ? "Monats-Iststunden manuell hinterlegt."
    : "Monats-Iststunden planbasiert berechnet.";

  html += `
      <td class="weekHoursCell" title="${monthActualTitle}">${minutesToHM(monthDisplayMinutes)}</td>
      <td class="weekDeltaCell ${monthDifferenceMinutes < 0 ? "deltaNeg" : monthDifferenceMinutes > 0 ? "deltaPos" : "deltaZero"}" title="${monthDeltaTitle}">${formatSignedMinutes(monthDifferenceMinutes)}</td>
      <td class="weekDeltaCell ${totalMinusMinutes > 0 ? "deltaNeg" : "deltaZero"}">${totalMinusMinutes > 0 ? `-${minutesToHM(totalMinusMinutes)}` : "0:00"}</td>
    </tr>
  `;

  return html;
}
function bindMonthCellActions() {
  const table = document.getElementById("monthTable");
  if (!table) return;

  table.querySelectorAll(".monthCellClickable").forEach((cell) => {
    cell.addEventListener("click", () => {
      const empId = cell.dataset.empId;
      const isoDate = cell.dataset.iso;

      const emp = state.employees.find((e) => e.id === empId);
      if (!emp || !isoDate) return;

      const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);

      if (resolved.type === "holiday") return;

      if (resolved.type === "vacation") {
        openShiftDialog("U", { emp, isoDate, type: "U" });
        return;
      }

      if (resolved.type === "sick") {
        openShiftDialog("K", { emp, isoDate, type: "K" });
        return;
      }

      if (resolved.type === "external-help") {
        openShiftDialog("AH", { emp, isoDate, type: "AH" });
        return;
      }

      if (resolved.type === "shift" && resolved.sourceEntry) {
        const entry = resolved.sourceEntry;

        if (entry.mode === "late") {
          openShiftDialog("L", { emp, isoDate, type: "L" });
          return;
        }

        if (entry.mode === "full") {
          openShiftDialog("G", { emp, isoDate, type: "G" });
          return;
        }

        if (entry.mode === "flex") {
          openShiftDialog("FLEX", { emp, isoDate, type: "FLEX" });
          return;
        }
      }

      openMonthFallbackDialog(emp, isoDate);
    });
  });
}

function openMonthFallbackDialog(emp, isoDate) {
  const fallbackOptions = [
    { code: "G", label: "Ganztag (G)" },
    { code: "U", label: "Urlaub (U)" },
    { code: "K", label: "Krank (K)" },
    { code: "AH", label: "Aushilfe (AH)" }
  ];

  const availableDialogOptions = typeof getShiftSelectOptions === "function"
    ? getShiftSelectOptions()
      .filter((option) => option?.isDialogShift)
      .map((option) => {
        const code = getShiftCodeForSelectValue(option.value);
        return { code, label: `${option.label} (${code})` };
      })
      .filter((option) => option.code)
    : [];

  const optionPool = availableDialogOptions.length ? availableDialogOptions : fallbackOptions;
  const uniqueOptions = optionPool.filter((option, index, arr) => (
    arr.findIndex((entry) => entry.code === option.code) === index
  ));
  const optionHint = uniqueOptions.map((option) => option.label).join(", ");
  const defaultCode = uniqueOptions[0]?.code || "G";

  const rawSelection = window.prompt(
    `Bitte Schicht/Typ wählen (${optionHint}).\nCode eingeben:`,
    defaultCode
  );

  if (!rawSelection) return;

  const selectedCode = getShiftCodeForSelectValue(rawSelection);
  const selectedOption = uniqueOptions.find((option) => option.code === selectedCode);
  if (!selectedOption) return;

  openShiftDialog(selectedOption.code, { emp, isoDate, type: selectedOption.code });
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
}

function updateMonthHeaderTitle(days) {
  const titleEl = document.getElementById("monthTitle");
  if (!titleEl) return;

  titleEl.textContent = getMonthTitleFromDays(days);
}

function renderMonthView() {
  const container = getMonthViewContentEl();
  if (!container) return;

  container.innerHTML = "";

  const days = getActiveMonthDays();
  if (!days.length) {
    container.innerHTML = "<div class='small'>Kein Monat geladen.</div>";
    return;
  }

  updateMonthHeaderTitle(days);

  let html = `
    <div class="monthViewHeader">
      <strong>${getMonthTitleFromDays(days)}</strong>
      <span class="small">${days.length} Tage im aktuellen Monat</span>
    </div>

    <table id="monthTable">
      <thead>
        ${buildMonthHeaderRow(days)}
      </thead>
      <tbody>
  `;

  const activeEmployees = state.employees.filter((emp) => isEmployeeActiveInMonth(emp, state.activeMonth));

  activeEmployees.forEach((emp) => {
    html += buildMonthEmployeeRow(emp, days);
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;

  bindMonthCellActions();
}
