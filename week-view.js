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

  warnings.forEach((text) => {
    const div = document.createElement("div");
    div.className = "warnLine";
    div.textContent = text;
    weekWarningsEl.appendChild(div);
  });
}

function createWeekSelect(emp, isoDate) {
  const sel = document.createElement("select");
  const currentShift = getShiftForEmployeeOnIso(emp, isoDate);

  sel.className = `weekSelect ${getShiftClassByKey(currentShift)}`;

  SHIFTS.forEach((shift) => {
    const opt = document.createElement("option");
    opt.value = shift.key;
    opt.textContent = shift.key;
    sel.appendChild(opt);
  });

  sel.value = currentShift;

  sel.addEventListener("change", () => {
    setShiftForEmployeeOnIso(emp, isoDate, sel.value);
    sel.className = `weekSelect ${getShiftClassByKey(sel.value)}`;

    savePlanData();
    renderAllViews();
  });

  return sel;
}

function renderWeekHeader() {
  const table = document.getElementById("weekTable");
  if (!table) return;

  const thead = table.querySelector("thead");
  if (!thead) return;

  const weekDays = getActiveWeekDays();
  if (!weekDays.length) return;

  thead.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Mo</th>
      <th>Di</th>
      <th>Mi</th>
      <th>Do</th>
      <th>Fr</th>
      <th>Sa</th>
      <th>Ist</th>
      <th>Δ</th>
      <th>Soll</th>
    </tr>
  `;
}

function renderWeekTable() {
  if (!weekTableBodyEl) return;

  const weekDays = getActiveWeekDays();
  weekTableBodyEl.innerHTML = "";

  if (!weekDays.length) return;

  const visibleDays = weekDays.slice(0, 6); // Mo-Sa in Wochenansicht

  state.employees.forEach((emp) => {
    const tr = document.createElement("tr");

    const tdNameRole = document.createElement("td");
    tdNameRole.className = "nameRoleCell";
    tdNameRole.innerHTML = `
      <div class="nameRoleName">${emp.name || "—"}</div>
      <div class="nameRoleSub">${emp.roleKey || "-"}</div>
    `;
    tr.appendChild(tdNameRole);

    visibleDays.forEach((day) => {
      const td = document.createElement("td");

      if (day.isOutsideMonth) {
        td.style.background = "#eee";
      }

      td.appendChild(createWeekSelect(emp, day.iso));
      tr.appendChild(td);
    });

    const tdActual = document.createElement("td");
    tdActual.className = "weekHoursCell";
    tdActual.textContent = minutesToHM(totalMinutesForEmployee(emp));
    tr.appendChild(tdActual);

    const delta = deltaMinutes(emp);
    const tdDelta = document.createElement("td");
    tdDelta.className = `weekDeltaCell ${
      delta < 0 ? "deltaNeg" : delta > 0 ? "deltaPos" : "deltaZero"
    }`;
    tdDelta.textContent = formatSignedMinutes(delta);
    tr.appendChild(tdDelta);

    const tdTarget = document.createElement("td");
    tdTarget.className = "weekTargetCell";
    tdTarget.textContent = emp.target || "0:00";
    tr.appendChild(tdTarget);

    weekTableBodyEl.appendChild(tr);
  });
}

function renderWeekView() {
  renderWeekHeader();
  renderWeekWarnings();
  renderWeekTable();
}