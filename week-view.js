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

function getWeekSelectValueForDay(emp, isoDate) {
  const resolved = getResolvedDayEntry({
    employee: emp,
    isoDate: isoDate,
    schedule: state.schedule,
    absences: state.absences,
    stateKey: APP_META.stateKey
  });

  if (!resolved) return "";
  if (resolved.type === "holiday") return "H";
  if (resolved.type === "sick") return "K";
  if (resolved.type === "vacation") return "U";
  if (resolved.type === "external-help") return "AH";

  if (resolved.type === "shift" && resolved.sourceEntry) {
    return resolved.sourceEntry.code || "";
  }

  return "";
}

function getWeekSelectClassByValue(value) {
  if (!value) return "free";
  return String(value).toLowerCase();
}

function ensureScheduleDay(isoDate) {
  if (!state.schedule) state.schedule = {};
  if (!state.schedule[isoDate]) state.schedule[isoDate] = {};
  return state.schedule[isoDate];
}

function removeScheduleEntryForEmployeeOnDate(employeeId, isoDate) {
  if (!state.schedule || !state.schedule[isoDate]) return;
  delete state.schedule[isoDate][employeeId];

  if (Object.keys(state.schedule[isoDate]).length === 0) {
    delete state.schedule[isoDate];
  }
}

function removeAbsenceForEmployeeOnDate(employeeId, isoDate) {
  if (!Array.isArray(state.absences)) {
    state.absences = [];
    return;
  }

  state.absences = state.absences.filter((entry) => {
    if (!entry || entry.employeeId !== employeeId) return true;
    return !isIsoDateInRange(isoDate, entry.from, entry.to);
  });
}

function applyWeekSelection(emp, isoDate, value) {
  if (!state.schedule) state.schedule = {};
  if (!Array.isArray(state.absences)) state.absences = [];

  const employeeId = emp.id;

  removeScheduleEntryForEmployeeOnDate(employeeId, isoDate);
  removeAbsenceForEmployeeOnDate(employeeId, isoDate);

  if (!value) return;

  if (value === "U") {
    const entry = createAbsenceEntry({
      employeeId: employeeId,
      type: "vacation",
      from: isoDate,
      to: isoDate,
      note: ""
    });

    if (entry) {
      state.absences.push(entry);
    }
    return;
  }

  if (value === "K") {
    const entry = createAbsenceEntry({
      employeeId: employeeId,
      type: "sick",
      from: isoDate,
      to: isoDate,
      note: ""
    });

    if (entry) {
      state.absences.push(entry);
    }
    return;
  }

  if (value === "AH") {
    const daySchedule = ensureScheduleDay(isoDate);
    daySchedule[employeeId] = {
      type: "external-help",
      label: "AH",
      minutes: 0,
      branch: ""
    };
    return;
  }

  if (value === "F3" || value === "F4" || value === "F5" || value === "F6") {
    const entry = buildEarlyShiftEntry(value);
    if (entry) {
      const daySchedule = ensureScheduleDay(isoDate);
      daySchedule[employeeId] = entry;
    }
    return;
  }

  if (value === "L" || value === "G" || value === "FLEX") {
    alert("Diese Auswahl bauen wir als Nächstes mit Zusatzabfrage ein.");
    return;
  }
}

function createWeekSelect(emp, isoDate) {
  const sel = document.createElement("select");
  const currentValue = getWeekSelectValueForDay(emp, isoDate);

  const resolved = getResolvedDayEntry({
    employee: emp,
    isoDate: isoDate,
    schedule: state.schedule,
    absences: state.absences,
    stateKey: APP_META.stateKey
  });

  sel.className = "weekSelect " + getWeekSelectClassByValue(currentValue);

  if (resolved && resolved.type === "holiday") {
    const holidayOption = document.createElement("option");
    holidayOption.value = "H";
    holidayOption.textContent = "H";
    sel.appendChild(holidayOption);
    sel.value = "H";
    sel.disabled = true;
    return sel;
  }

  const options = [
    { value: "", label: "—" },
    { value: "F3", label: "F3" },
    { value: "F4", label: "F4" },
    { value: "F5", label: "F5" },
    { value: "F6", label: "F6" },
    { value: "L", label: "L" },
    { value: "G", label: "G" },
    { value: "FLEX", label: "Flex" },
    { value: "U", label: "U" },
    { value: "K", label: "K" },
    { value: "AH", label: "AH" }
  ];

  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    sel.appendChild(opt);
  });

  sel.value = currentValue;

  sel.addEventListener("change", () => {
    const selectedValue = sel.value;

    applyWeekSelection(emp, isoDate, selectedValue);

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

  const visibleDays = weekDays.slice(0, 6);

  let headerHtml = `
    <tr>
      <th>Name</th>
  `;

  visibleDays.forEach((day) => {
    const grayStyle = day.isOutsideMonth ? ` style="background:#eee;color:#666;"` : "";
    headerHtml += `<th${grayStyle}>${day.weekdayLabel}<br>${pad2(day.date.getDate())}.${pad2(day.date.getMonth() + 1)}</th>`;
  });

  headerHtml += `
      <th>Ist</th>
      <th>Δ</th>
      <th>Soll</th>
    </tr>
  `;

  thead.innerHTML = headerHtml;
}

function renderWeekTable() {
  if (!weekTableBodyEl) return;

  weekTableBodyEl.innerHTML = "";

  const weekDays = getActiveWeekDays();
  if (!weekDays.length) return;

  const visibleDays = weekDays.slice(0, 6);

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