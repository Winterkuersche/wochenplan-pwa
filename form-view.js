
function formatIsoDateForm(date) {
  return `${date.getFullYear()}-${pad2Form(date.getMonth() + 1)}-${pad2Form(date.getDate())}`;
}

function formatMonthYearFromDateForm(date) {
  return `${pad2Form(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function getFormDayData(emp, isoDate) {
  const shiftKey = getShiftForEmployeeOnIso(emp, isoDate);
  return getFormDataForShift(shiftKey);
}

function totalMinutesForEmployeeInMonth(emp, monthPlan) {
  if (!monthPlan?.weeks) return 0;

  let total = 0;

  monthPlan.weeks.forEach((week) => {
    week.forEach((day) => {
      if (!day.inCurrentMonth) return;
      total += netMinutesForShift(getShiftForEmployeeOnIso(emp, day.iso));
    });
  });

  return total;
}

function buildEmployeeRowsForWeek(emp, weekDays, monthPlan) {
  const rows = [
    { label: "Beginn", key: "start" },
    { label: "Pause", key: "pause" },
    { label: "Ende", key: "end" },
    { label: "Summe", key: "sum" }
  ];

  let html = "";

  const weekMinutes = weekDays.reduce((sum, day) => {
    if (day.isOutsideMonth) return sum;
    return sum + netMinutesForShift(getShiftForEmployeeOnIso(emp, day.iso));
  }, 0);

  const monthMinutes = totalMinutesForEmployeeInMonth(emp, monthPlan);

  rows.forEach((rowDef, rowIndex) => {
    html += "<tr>";

    if (rowIndex === 0) {
      html += `
        <td class="mepNameCell" rowspan="4">${emp.name || "—"}</td>
        <td class="mepFuncText" rowspan="4">${emp.roleKey || "-"}</td>
        <td class="mepPlanText" rowspan="4">${emp.target || "-"}</td>
      `;
    }

    html += `<td class="mepTypeCell">${rowDef.label}</td>`;

    weekDays.forEach((day) => {
      const dayData = getFormDayData(emp, day.iso);
      const grayStyle = day.isOutsideMonth ? "background:#eee;" : "";

      html += `
        <td class="mepDayValueCell" style="${grayStyle}">
          ${dayData[rowDef.key] || ""}
        </td>
      `;
    });

    if (rowIndex === 0) {
      html += `
        <td class="mepWeekText" rowspan="4">${minutesToHM(weekMinutes)}</td>
        <td class="mepMonthText" rowspan="4">${minutesToHM(monthMinutes)}</td>
      `;
    }

    html += "</tr>";
  });

  return html;
}

function buildWeekSheet(weekDays, monthPlan) {
  const weekStart = weekDays[0]?.date;
  const weekEnd = weekDays[6]?.date;

  if (!weekStart || !weekEnd) return "";

  let html = `
    <div class="printSheet">
      <h2>Mitarbeiter-Einsatz-Planung (MEP)</h2>

      <div class="mepMeta">
        <div><strong>Filiale:</strong> __________</div>
        <div><strong>Monat/Jahr</strong> ${formatMonthYearFromDateForm(weekStart)}</div>
        <div><strong>Woche vom</strong> ${formatIsoDateForm(weekStart)}</div>
        <div><strong>bis</strong> ${formatIsoDateForm(weekEnd)}</div>
      </div>

      <div class="mepTableOuter">
        <table class="mepTable">
          <thead>
            <tr>
              <th class="mepNameCol" rowspan="3">Name / Vorname</th>
              <th class="mepFuncCol" rowspan="3">Funktion</th>
              <th class="mepPlanCol" rowspan="3">Plan / Woche</th>

              <th class="mepTypeCol">Wochentag</th>
  `;

  weekDays.forEach((day) => {
    const grayStyle = day.isOutsideMonth ? ` style="background:#eee;color:#666;"` : "";
    html += `<th class="mepDayCol"${grayStyle}>${day.weekdayLabel}</th>`;
  });

  html += `
              <th class="mepWeekCol" rowspan="3">Summe / Woche</th>
              <th class="mepMonthCol" rowspan="3">Summe / Monat</th>
            </tr>

            <tr>
              <th class="mepTypeCol">Datum</th>
  `;

  weekDays.forEach((day) => {
    const grayStyle = day.isOutsideMonth ? ` style="background:#eee;color:#666;"` : "";
    html += `<th class="mepSubHead"${grayStyle}>${formatShortDateForm(day.date)}</th>`;
  });

  html += `
            </tr>

            <tr>
              <th class="mepTypeCol">Warentag</th>
  `;

  weekDays.forEach((day) => {
    const grayStyle = day.isOutsideMonth ? ` style="background:#eee;"` : "";
    html += `<th class="mepSubHead"${grayStyle}></th>`;
  });

  html += `
            </tr>
          </thead>
          <tbody>
  `;

  state.employees.forEach((emp) => {
    html += buildEmployeeRowsForWeek(emp, weekDays, monthPlan);
  });

  html += `
          </tbody>
        </table>
      </div>

      <div class="mepFooterHint">
        Pausenzeiten: bis 6 Stunden keine Pause, über 6 Stunden 60 Minuten,
        Spätschichten mit Abrechnung 10 Minuten, Ganztag 70 Minuten.
      </div>
    </div>
  `;

  return html;
}

function renderFormView() {
  if (!formViewEl) return;

  formViewEl.innerHTML = "";

  const monthPlan = state.monthPlan;
  if (!monthPlan || !Array.isArray(monthPlan.weeks)) return;

  monthPlan.weeks.forEach((weekDays) => {
    formViewEl.innerHTML += buildWeekSheet(weekDays, monthPlan);
  });
}
