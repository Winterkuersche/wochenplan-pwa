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
    html += `<th${className}>${pad2(day.date.getDate())}<br>${day.weekdayLabel}</th>`;
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

    let cellText = resolved.label || "";

if (resolved.type === "shift") {
  const entry = resolved.sourceEntry || resolved;

  if (entry.start && entry.end) {
    cellText = `${entry.start}-${entry.end}`;
  } else if (entry.code) {
    cellText = entry.code;
  }
} else if (resolved.type === "vacation") {
  cellText = "U";
} else if (resolved.type === "sick") {
  cellText = "K";
} else if (resolved.type === "external-help") {
  cellText = "AH";
}
   html += `
  <td
    class="${className} monthCellClickable"
    data-emp-id="${emp.id}"
    data-iso="${day.iso}"
    title="Klicken zum Urlaub planen"
  >
    ${cellText}
  </td>
`;
  });

  html += `
      <td class="weekHoursCell">${minutesToHM(monthMinutes)}</td>
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

      if (resolved.type === "vacation") {
        openShiftDialog("U", { emp, isoDate, type: "U" });
        return;
      }

      if (resolved.type === "sick") {
        openShiftDialog("K", { emp, isoDate, type: "K" });
        return;
      }

      if (resolved.type === "holiday") {
        return;
      }

      openShiftDialog("U", { emp, isoDate, type: "U" });
    });
  });
}

function changeMonth(offset) {
  const activeMonth = state.activeMonth || toIsoDate(new Date()).slice(0, 7);
  const [year, month] = activeMonth.split("-").map(Number);
  const nextDate = new Date(year, month - 1 + offset, 1);

  state.activeMonth = `${nextDate.getFullYear()}-${pad2(nextDate.getMonth() + 1)}`;

  syncMonthPlanToState();
  renderAllViews();
}

function bindMonthNavigation() {
  document.getElementById("monthPrev")?.addEventListener("click", () => {
    changeMonth(-1);
  });

  document.getElementById("monthNext")?.addEventListener("click", () => {
    changeMonth(1);
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

  state.employees.forEach((emp) => {
    html += buildMonthEmployeeRow(emp, days);
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;

  bindMonthCellActions();
}
