function buildMepDayBlock(shiftKey) {
  const data = getFormDataForShift(shiftKey);

  return `
    <div class="mepDayBlock">
      <div class="mepDayLabel">Beginn</div>
      <div class="mepDayValue ${data.start ? "" : "mepEmpty"}">${data.start || ""}</div>

      <div class="mepDayLabel">Ende</div>
      <div class="mepDayValue ${data.end ? "" : "mepEmpty"}">${data.end || ""}</div>

      <div class="mepDayLabel">Pause</div>
      <div class="mepDayValue ${data.pause ? "" : "mepEmpty"}">${data.pause || ""}</div>

      <div class="mepDayLabel">Summe</div>
      <div class="mepDayValue ${data.sum ? "" : "mepEmpty"}">${data.sum || ""}</div>
    </div>
  `;
}

function renderMepTable() {
  if (!mepTableBodyEl) return;

  mepTableBodyEl.innerHTML = "";

  state.employees.forEach(emp => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.className = "mepNameCell";
    tdName.innerHTML = `<div class="mepNameMain">${emp.name || "—"}</div>`;
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
