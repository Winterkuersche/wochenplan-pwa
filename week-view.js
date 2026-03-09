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
    isoDate,
    schedule: state.schedule,
    absences: state.absences,
    stateKey: APP_META.stateKey
  });

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
  if (!value) return "";
  return `shift-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function createWeekSelect(emp, isoDate) {
  const sel = document.createElement("select");
  const currentValue = getWeekSelectValueForDay(emp, isoDate);

  sel.className = `weekSelect ${getWeekSelectClassByValue(currentValue)}`;

  const resolved = getResolvedDayEntry({
    employee: emp,
    isoDate,
    schedule: state.schedule,
    absences: state.absences,
    stateKey: APP_META.stateKey
  });

  const allOptions = [
    { value: "", label: "—" },
    ...SHIFT_CONFIG.statusOptions
      .filter((opt) => opt.value && opt.value !== "H")
      .map((opt) => ({ value: opt.value, label: opt.label }))
  ];

  if (resolved.type === "holiday") {
    const holidayOption = document.createElement("option");
    holidayOption.value = "H";
    holidayOption.textContent = "H";
    sel.appendChild(holidayOption);
    sel.value = "H";
    sel.disabled = true;
    sel.className = `weekSelect ${getWeekSelectClassByValue("H")}`;
    return sel;
  }

  allOptions.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    sel.appendChild(opt);
  });

  sel.value = currentValue;

  sel.addEventListener("change", () => {
    const selectedValue = sel.value;

    console.log("Neue Auswahl im Wochenplan:", {
      employeeId: emp.id,
      isoDate,
      selectedValue
    });

    sel.className = `weekSelect ${getWeekSelectClassByValue(selectedValue)}`;

    // Speichern folgt im nächsten Schritt
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

  const visibleDays = weekDays.slice(0, 6); // Wochenplan nur Mo-Sa

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
