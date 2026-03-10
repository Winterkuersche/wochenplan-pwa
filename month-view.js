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

function buildMonthHeaderRow(days) {
  let html = `
    <tr>
      <th>Name</th>
  `;

  days.forEach((day) => {
    const isSunday = day.weekdayIndex === 6;
    const style = isSunday ? ` style="background:#eee;color:#666;"` : "";
    html += `<th${style}>${day.day}<br>${day.weekdayLabel}</th>`;
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
    const isSunday = day.weekdayIndex === 6;
    const grayStyle = isSunday ? ` style="background:#eee;color:#666;"` : "";

    monthMinutes += resolved.minutesForMonth || 0;

    html += `<td${grayStyle}>${resolved.label || ""}</td>`;
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

  let html = `
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
