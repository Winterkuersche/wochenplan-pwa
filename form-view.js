function pad2Form(n) {
  return String(n).padStart(2, "0");
}

function formatMonthYearFromDateForm(date) {
  return `${pad2Form(date.getMonth() + 1)}.${date.getFullYear()}`;
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
function getResolvedFormDayData(emp, isoDate) {
  const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);

  if (!resolved) {
    return { start: "", pause: "", end: "", sum: "" };
  }

  if (resolved.type === "holiday") {
    return {
      start: "H",
      pause: "",
      end: "",
      sum: minutesToHM(resolved.minutesForMonth)
    };
  }

  if (resolved.type === "sick") {
    return {
      start: "K",
      pause: "",
      end: "",
      sum: minutesToHM(resolved.minutesForMonth)
    };
  }

  if (resolved.type === "vacation") {
    return {
      start: "U",
      pause: "",
      end: "",
      sum: minutesToHM(resolved.minutesForMonth)
    };
  }

  if (resolved.type === "external-help") {
    return {
      start: "AH",
      pause: "",
      end: "",
      sum: minutesToHM(resolved.minutesForMonth)
    };
  }

  if (resolved.type === "shift" && resolved.sourceEntry) {
    const entry = resolved.sourceEntry;

    return {
      start: entry.start || "",
      pause: entry.breakMinutes ? minutesToHM(entry.breakMinutes) : "",
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

function buildEmployeeRowsForWeek(emp, weekDays) {
  const rows = [
    { label: "Beginn", key: "start" },
    { label: "Pause", key: "pause" },
    { label: "Ende", key: "end" },
    { label: "Summe", key: "sum" }
  ];

  let html = "";

 const weekMinutes = getWeekResolvedMinutesForEmployee(emp, weekDays);

 const monthMinutes = getMonthResolvedMinutesForEmployeeUntilWeek(emp, weekDays);

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

function buildWeekSheet(weekDays) {
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
    html += buildEmployeeRowsForWeek(emp, weekDays);
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
