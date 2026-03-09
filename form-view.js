function buildMepDayBlock(shiftKey) {
  const data = getFormDataForShift(shiftKey);

  const start = data.start || "";
  const pause = data.pause || "";
  const end = data.end || "";
  const sum = data.sum || "";

  return `
    <table class="mepInnerTable">
      <tr>
        <td class="mepInnerLabel">Beginn</td>
        <td class="mepInnerValue">${start}</td>
      </tr>
      <tr>
        <td class="mepInnerLabel">Pause</td>
        <td class="mepInnerValue">${pause}</td>
      </tr>
      <tr>
        <td class="mepInnerLabel">Ende</td>
        <td class="mepInnerValue">${end}</td>
      </tr>
      <tr>
        <td class="mepInnerLabel">Summe</td>
        <td class="mepInnerValue">${sum}</td>
      </tr>
    </table>
  `;
}

function renderMepTable() {
  if (!mepTableBodyEl) return;

  mepTableBodyEl.innerHTML = "";

  state.employees.forEach(emp => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.className = "mepNameCell";
    tdName.innerHTML = `${emp.name || "—"}`;
    tr.appendChild(tdName);

    const tdFunc = document.createElement("td");
    tdFunc.className = "mepFuncText";
    tdFunc.textContent = emp.roleKey || "-";
    tr.appendChild(tdFunc);

    const tdPlan = document.createElement("td");
    tdPlan.className = "mepPlanText";
    tdPlan.textContent = emp.target || "-";
    tr.appendChild(tdPlan);

    DAYS.forEach(d => {
      const td = document.createElement("td");
      td.className = "mepDayCell";
      td.innerHTML = buildMepDayBlock(emp.days[d.key]);
      tr.appendChild(td);
    });

    const tdWeek = document.createElement("td");
    tdWeek.className = "mepWeekText";
    tdWeek.textContent = minutesToHM(totalMinutesForEmployee(emp));
    tr.appendChild(tdWeek);

    mepTableBodyEl.appendChild(tr);
  });
}

function renderFormView() {
  renderMepTable();
}