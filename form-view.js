function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatShortDate(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
}

function formatIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatMonthYearFromDate(date) {
  return `${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function getDayData(emp, dayKey) {
  return getFormDataForShift(emp.days?.[dayKey] || "-");
}

function buildEmployeeRows(emp, weekDays) {
  const dayKeys = ["mo", "di", "mi", "do", "fr", "sa", "so"];

  const dayData = {
    mo: getDayData(emp, "mo"),
    di: getDayData(emp, "di"),
    mi: getDayData(emp, "mi"),
    do: getDayData(emp, "do"),
    fr: getDayData(emp, "fr"),
    sa: getDayData(emp, "sa"),
    so: { start: "", pause: "", end: "", sum: "" }
  };

  const rows = [
    { label: "Beginn", key: "start" },
    { label: "Pause", key: "pause" },
    { label: "Ende", key: "end" },
    { label: "Summe", key: "sum" }
  ];

  let html = "";

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

    weekDays.forEach((day, idx) => {
      const dayKey = dayKeys[idx];
      const grayStyle = day.isOutsideMonth ? "background:#eee;" : "";

      html += `
        <td class="mepDayValueCell" style="${grayStyle}">
          ${dayData[dayKey][rowDef.key] || ""}
        </td>
      `;
    });

    if (rowIndex === 0) {
      html += `
        <td class="mepWeekText" rowspan="4">${minutesToHM(totalMinutesForEmployee(emp))}</td>
        <td class="mepMonthText" rowspan="4"></td>
      `;
    }

    html += "</tr>";
  });

  return html;
}

function buildWeekSheet(weekDays) {
  const weekStart = weekDays[0]?.date;
  const weekEnd = weekDays[6]?.date;

  if (!weekStart || !weekEnd) return "";

  let html = `
    <div class="printSheet">
      <h2>Mitarbeiter-Einsatz-Planung (MEP)</h2>

      <div class="mepMeta">
        <div><strong>Filiale:</strong> __________</div>
        <div><strong>Monat/Jahr</strong> ${formatMonthYearFromDate(weekStart)}</div>
        <div><strong>Woche vom</strong> ${formatIsoDate(weekStart)}</div>
        <div><strong>bis</strong> ${formatIsoDate(weekEnd)}</div>
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
    const grayStyle = day.isOutsideMonth ? "background:#eee;" : "";
    html += `<th class="mepDayCol" style="${grayStyle}">${day.weekdayLabel}</th>`;
  });

  html += `
              <th class="mepWeekCol" rowspan="3">Summe / Woche</th>
              <th class="mepMonthCol" rowspan="3">Summe / Monat</th>
            </tr>

            <tr>
              <th class="mepTypeCol">Datum</th>
  `;

  weekDays.forEach((day) => {
    const grayStyle = day.isOutsideMonth ? "background:#eee;" : "";
    html += `<th class="mepSubHead" style="${grayStyle}">${formatShortDate(day.date)}</th>`;
  });

  html += `
            </tr>

            <tr>
              <th class="mepTypeCol">Warentag</th>
  `;

  weekDays.forEach((day) => {
    const grayStyle = day.isOutsideMonth ? "background:#eee;" : "";
    html += `<th class="mepSubHead" style="${grayStyle}"></th>`;
  });

  html += `
            </tr>
          </thead>
          <tbody>
  `;

  state.employees.forEach((emp) => {
    html += buildEmployeeRows(emp, weekDays);
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
    formViewEl.innerHTML += buildWeekSheet(weekDays);
  });
}