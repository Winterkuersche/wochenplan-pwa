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

  if (day.weekdayIndex === 6) classes.push("monthCellSunday");
  if (resolved.type === "holiday") classes.push("monthCellHoliday");
  if (resolved.type === "vacation") classes.push("monthCellVacation");
  if (resolved.type === "sick") classes.push("monthCellSick");
  if (resolved.type === "external-help") classes.push("monthCellExternalHelp");
  if (resolved.type === "shift") classes.push("monthCellShift");

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
    html += `<th${className}>${day.day}<br>${day.weekdayLabel}</th>`;
  });

  html += `
      <th>Monat</th>
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

    html += `<td class="${className}">${resolved.label || ""}</td>`;
  });

  html += `
      <td class="weekHoursCell">${minutesToHM(monthMinutes)}</td>
    </tr>
  `;

  return html;
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

  const monthTitle = getMonthTitleFromDays(days);

  let html = `
    <div class="monthViewHeader">
      <strong>${monthTitle}</strong>
      <span class="small">${days.length} Tage im aktuellen Monat</span>
    </div>

    <table id="monthTable">
      <thead>
        ${buildMonthHeaderRow(days)}
      </thead>
      <tbody>
  `;

  state.employees.forEach((emp) => {
    html += buildMonthEmployeeRow(emp, days);
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}
