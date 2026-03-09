function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatShortDate(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
}

function buildDayHeaderHTML(dayObj) {
  const gray = dayObj.isOutsideMonth ? "style='background:#eee'" : "";
  return `
    <th class="mepDayCol" ${gray}>
      ${dayObj.weekdayLabel}
    </th>
  `;
}

function buildDateHeaderHTML(dayObj) {
  const gray = dayObj.isOutsideMonth ? "style='background:#eee'" : "";
  return `
    <th class="mepSubHead" ${gray}>
      ${formatShortDate(dayObj.date)}
    </th>
  `;
}

function getDayData(emp, dayKey) {
  return getFormDataForShift(emp.days?.[dayKey] || "-");
}

function buildEmployeeRows(emp, weekDays) {
  const dayKeys = ["mo","di","mi","do","fr","sa","so"];

  const dayData = {
    mo: getDayData(emp,"mo"),
    di: getDayData(emp,"di"),
    mi: getDayData(emp,"mi"),
    do: getDayData(emp,"do"),
    fr: getDayData(emp,"fr"),
    sa: getDayData(emp,"sa"),
    so: {start:"",pause:"",end:"",sum:""}
  };

  const rows = [
    { label:"Beginn", key:"start"},
    { label:"Pause", key:"pause"},
    { label:"Ende", key:"end"},
    { label:"Summe", key:"sum"}
  ];

  let html = "";

  rows.forEach((rowDef,rowIndex)=>{

    html += "<tr>";

    if(rowIndex===0){

      html+=`
      <td class="mepNameCell" rowspan="4">${emp.name||"—"}</td>
      <td class="mepFuncText" rowspan="4">${emp.roleKey||"-"}</td>
      <td class="mepPlanText" rowspan="4">${emp.target||"-"}</td>
      `;
    }

    html+=`<td class="mepTypeCell">${rowDef.label}</td>`;

    weekDays.forEach((day,idx)=>{

      const dayKey = dayKeys[idx];
      const gray = day.isOutsideMonth ? "style='background:#eee'" : "";

      html+=`
      <td class="mepDayValueCell" ${gray}>
        ${dayData[dayKey][rowDef.key]||""}
      </td>
      `;
    });

    if(rowIndex===0){

      html+=`
      <td class="mepWeekText" rowspan="4">
        ${minutesToHM(totalMinutesForEmployee(emp))}
      </td>
      <td class="mepMonthText" rowspan="4"></td>
      `;
    }

    html+="</tr>";

  });

  return html;
}

function buildWeekSheet(weekDays) {

  let html = `
  <div class="printSheet">
  <div class="mepTableOuter">
  <table class="mepTable">
  <thead>
  <tr>

  <th class="mepNameCol" rowspan="2">Name / Vorname</th>
  <th class="mepFuncCol" rowspan="2">Funktion</th>
  <th class="mepPlanCol" rowspan="2">Plan / Woche</th>

  <th class="mepTypeCol" rowspan="2">
  Wochentag<br>Datum<br>Warentag
  </th>
  `;

  weekDays.forEach(day=>{
    html+=buildDayHeaderHTML(day);
  });

  html+=`
  <th class="mepWeekCol" rowspan="2">Summe / Woche</th>
  <th class="mepMonthCol" rowspan="2">Summe / Monat</th>
  </tr>

  <tr>
  `;

  weekDays.forEach(day=>{
    html+=buildDateHeaderHTML(day);
  });

  html+=`
  </tr>
  </thead>
  <tbody>
  `;

  state.employees.forEach(emp=>{
    html+=buildEmployeeRows(emp,weekDays);
  });

  html+=`
  </tbody>
  </table>
  </div>
  </div>
  `;

  return html;
}

function renderFormView() {

  if(!formViewEl) return;

  formViewEl.innerHTML="";

  const monthPlan = state.monthPlan;

  if(!monthPlan) return;

  monthPlan.weeks.forEach(week=>{
    formViewEl.innerHTML += buildWeekSheet(week);
  });

}