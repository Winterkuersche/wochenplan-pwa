function renderWeekWarnings() {
  if (!weekWarningsEl) return;

  const warnings = getWeekWarnings();
  weekWarningsEl.innerHTML = "";

  if (warnings.length === 0) {
    const div = document.createElement("div");
    div.className = "warnLine";
    div.textContent = "Keine Warnungen.";
    weekWarningsEl.appendChild(div);
    return;
  }

  warnings.forEach(w => {
    const div = document.createElement("div");
    div.className = "warnLine";
    div.textContent = w;
    weekWarningsEl.appendChild(div);
  });
}

function createWeekSelect(emp, dayKey) {
  const sel = document.createElement("select");
  sel.className = `weekSelect ${getShiftClassByKey(emp.days[dayKey])}`;

  SHIFTS.forEach(shift => {
    const opt = document.createElement("option");
    opt.value = shift.key;
    opt.textContent = shift.key;
    sel.appendChild(opt);
  });

  sel.value = emp.days[dayKey];
  sel.addEventListener("change", () => {
    emp.days[dayKey] = sel.value;
    saveWeekData();
    renderAllViews();
  });

  return sel;
}

function renderWeekTable() {
  console.log("weekTableBodyEl:", weekTableBodyEl);
  console.log("state.employees:", state.employees);

  if (!weekTableBodyEl) return;

  weekTableBodyEl.innerHTML = "";

  state.employees.forEach(emp => {
    const tr = document.createElement("tr");

    const tdNameRole = document.createElement("td");
    tdNameRole.className = "nameRoleCell";
    tdNameRole.innerHTML = `
      <div class="nameRoleName">${emp.name || "—"}</div>
      <div class="nameRoleSub">${emp.roleKey || "-"}</div>
    `;
    tr.appendChild(tdNameRole);

    DAYS.forEach(d => {
      const td = document.createElement("td");
      td.appendChild(createWeekSelect(emp, d.key));
      tr.appendChild(td);
    });

    weekTableBodyEl.appendChild(tr);
  });
}

function renderWeekView() {
  renderWeekWarnings();
  renderWeekTable();
}
