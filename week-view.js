const shiftDialogOverlay = document.getElementById("shiftDialogOverlay");
const shiftDialogTitle = document.getElementById("shiftDialogTitle");

const shiftDialogLateFields = document.getElementById("shiftDialogLateFields");
const shiftDialogFullFields = document.getElementById("shiftDialogFullFields");
const shiftDialogFlexFields = document.getElementById("shiftDialogFlexFields");

const shiftDialogLateStart = document.getElementById("shiftDialogLateStart");
const shiftDialogLateCheckout = document.getElementById("shiftDialogLateCheckout");

const shiftDialogFullCheckout = document.getElementById("shiftDialogFullCheckout");

const shiftDialogFlexStart = document.getElementById("shiftDialogFlexStart");
const shiftDialogFlexEnd = document.getElementById("shiftDialogFlexEnd");

const shiftDialogCancel = document.getElementById("shiftDialogCancel");
const shiftDialogSave = document.getElementById("shiftDialogSave");
const shiftDialogDelete = document.getElementById("shiftDialogDelete");

const shiftDialogExternalHelpFields = document.getElementById("shiftDialogExternalHelpFields");
const shiftDialogExternalHelpBranch = document.getElementById("shiftDialogExternalHelpBranch");
const shiftDialogExternalHelpDuration = document.getElementById("shiftDialogExternalHelpDuration");

let shiftDialogContext = null;

function openShiftDialog(type, context) {
  shiftDialogContext = context;

    shiftDialogLateFields.classList.add("hidden");
  shiftDialogFullFields.classList.add("hidden");
  shiftDialogFlexFields.classList.add("hidden");
  shiftDialogAbsenceFields.classList.add("hidden");
  shiftDialogExternalHelpFields.classList.add("hidden");

    if (type === "AH") {
    shiftDialogTitle.textContent = "Aushilfe";
    shiftDialogExternalHelpFields.classList.remove("hidden");
    shiftDialogExternalHelpBranch.value = "";
    shiftDialogExternalHelpDuration.value = "05:00";
  }

    if (type === "U") {
    shiftDialogTitle.textContent = "Urlaub";
    shiftDialogAbsenceFields.classList.remove("hidden");
    shiftDialogAbsenceFrom.value = context.isoDate;
    shiftDialogAbsenceTo.value = context.isoDate;
  }

  if (type === "K") {
    shiftDialogTitle.textContent = "Krank";
    shiftDialogAbsenceFields.classList.remove("hidden");
    shiftDialogAbsenceFrom.value = context.isoDate;
    shiftDialogAbsenceTo.value = context.isoDate;
  }

  if (type === "L") {
    shiftDialogTitle.textContent = "Spätschicht";
    shiftDialogLateFields.classList.remove("hidden");
  }

  if (type === "G") {
    shiftDialogTitle.textContent = "Ganztag";
    shiftDialogFullFields.classList.remove("hidden");
  }

  
  if (type === "FLEX") {
  shiftDialogTitle.textContent = "Flexible Schicht";
  shiftDialogFlexFields.classList.remove("hidden");
}

if (shiftDialogDelete) {
  shiftDialogDelete.classList.toggle(
    "hidden",
    !["L", "G", "FLEX", "AH", "U", "K"].includes(type)
  );
}

fillShiftDialogFromExisting(type, context);
shiftDialogOverlay.classList.remove("hidden");
}

function closeShiftDialog() {
  shiftDialogOverlay.classList.add("hidden");
  if (shiftDialogDelete) {
    shiftDialogDelete.classList.add("hidden");
  }
  shiftDialogContext = null;
}
shiftDialogCancel.addEventListener("click", () => {
  closeShiftDialog();
});
shiftDialogDelete?.addEventListener("click", () => {
  if (!shiftDialogContext) return;

  const { emp, isoDate, type } = shiftDialogContext;

  if (type === "L" || type === "G" || type === "FLEX" || type === "AH") {
    clearDay(emp.id, isoDate);
    closeShiftDialog();
    return;
  }

  if (type === "U") {

  const choice = confirm(
    "OK = gesamten Urlaub löschen\nAbbrechen = Urlaub ab diesem Tag kürzen"
  );

  if (choice) {
    removeAbsenceEntryForEmployeeOnIso(emp.id, isoDate, "vacation");
  } else {
    trimAbsenceEntryFromIso(emp.id, isoDate, "vacation");
  }

  closeShiftDialog();
  return;
}

 if (type === "K") {

  const choice = confirm(
    "OK = gesamte Krankmeldung löschen\nAbbrechen = Krankmeldung ab diesem Tag kürzen"
  );

  if (choice) {
    removeAbsenceEntryForEmployeeOnIso(emp.id, isoDate, "sick");
  } else {
    trimAbsenceEntryFromIso(emp.id, isoDate, "sick");
  }

  closeShiftDialog();
  return;
}
});
shiftDialogSave.addEventListener("click", () => {
  if (!shiftDialogContext) return;

  const { emp, isoDate, type } = shiftDialogContext;

  if (type === "L") {
    const start = shiftDialogLateStart.value;
    const checkout = shiftDialogLateCheckout.value === "yes";

    const entry = buildLateShiftEntry(start, checkout);
    if (!entry) {
      alert("Ungültige Spätschicht.");
      return;
    }

    clearDay(emp.id, isoDate, { commit: false });
    setPlanEntry(emp.id, isoDate, entry);
    closeShiftDialog();
    return;
  }

  if (type === "G") {
    const checkout = shiftDialogFullCheckout.value === "yes";
    const entry = buildFullShiftEntry(checkout);

    clearDay(emp.id, isoDate, { commit: false });
    setPlanEntry(emp.id, isoDate, entry);
    closeShiftDialog();
    return;
  }

  if (type === "FLEX") {
    const start = shiftDialogFlexStart.value;
    const end = shiftDialogFlexEnd.value;

    if (!start || !end) {
      alert("Start und Ende wählen.");
      return;
    }

    const entry = buildFlexibleShiftEntry(start, end);

    if (!entry) {
      alert("Ungültige flexible Schicht. Bitte Zeiten prüfen.");
      return;
    }

    clearDay(emp.id, isoDate, { commit: false });
    setPlanEntry(emp.id, isoDate, entry);
    closeShiftDialog();
    return;
  }

  if (type === "U") {
    const fromIso = shiftDialogAbsenceFrom.value;
    const toIso = shiftDialogAbsenceTo.value;

    if (!fromIso || !toIso || !fromIsoDate(fromIso) || !fromIsoDate(toIso) || toIso < fromIso) {
      alert("Ungültiger Urlaubszeitraum.");
      return;
    }

    clearDayRange(emp.id, fromIso, toIso, { commit: false });
    addOrReplaceAbsenceForEmployee(emp.id, "vacation", fromIso, toIso);
    closeShiftDialog();
    return;
  }

  if (type === "K") {
    const fromIso = shiftDialogAbsenceFrom.value;
    const toIso = shiftDialogAbsenceTo.value;

    if (!fromIso || !toIso || !fromIsoDate(fromIso) || !fromIsoDate(toIso) || toIso < fromIso) {
      alert("Ungültiger Krankzeitraum.");
      return;
    }

    clearDayRange(emp.id, fromIso, toIso, { commit: false });
    addOrReplaceAbsenceForEmployee(emp.id, "sick", fromIso, toIso);
    closeShiftDialog();
    return;
  }

  if (type === "AH") {
    const branch = (shiftDialogExternalHelpBranch.value || "").trim();
    const hhmm = shiftDialogExternalHelpDuration.value;

    if (!hhmm || !isValidHHMM(hhmm) || hhmmToMinutes(hhmm) <= 0) {
      alert("Ungültige Dauer für Aushilfe.");
      return;
    }

    clearDay(emp.id, isoDate, { commit: false });

    const ok = setExternalHelpForEmployeeOnDate(emp.id, isoDate, branch, hhmm);
    if (!ok) {
      alert("Aushilfe konnte nicht gespeichert werden.");
      return;
    }

    closeShiftDialog();
    return;
  }

  savePlanData();
  renderAllViews();
  closeShiftDialog();
});

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

function shiftIsoDateByDays(isoDate, dayOffset) {
  const date = fromIsoDate(isoDate);
  if (!date) return isoDate;

  date.setDate(date.getDate() + dayOffset);
  return toIsoDate(date);
}
function clearDayRange(employeeId, fromIso, toIso, options = {}) {
  let current = fromIso;

  while (current <= toIso) {
    clearDay(employeeId, current, { commit: false });
    current = shiftIsoDateByDays(current, 1);
  }

  if (options.commit !== false) {
    commitPlanChange();
  }
}

function subtractRangeFromAbsenceEntry(entry, removeFromIso, removeToIso) {
  if (!entry) return [];

  const entryFrom = entry.from;
  const entryTo = entry.to;

  const hasOverlap = !(removeToIso < entryFrom || removeFromIso > entryTo);
  if (!hasOverlap) return [entry];

  if (removeFromIso <= entryFrom && removeToIso >= entryTo) {
    return [];
  }

  if (removeFromIso <= entryFrom && removeToIso < entryTo) {
    const nextFrom = shiftIsoDateByDays(removeToIso, 1);
    const trimmed = createAbsenceEntry({
      ...entry,
      id: null,
      from: nextFrom,
      to: entryTo
    });
    return trimmed ? [trimmed] : [];
  }

  if (removeFromIso > entryFrom && removeToIso >= entryTo) {
    const nextTo = shiftIsoDateByDays(removeFromIso, -1);
    const trimmed = createAbsenceEntry({
      ...entry,
      id: null,
      from: entryFrom,
      to: nextTo
    });
    return trimmed ? [trimmed] : [];
  }

  const leftTo = shiftIsoDateByDays(removeFromIso, -1);
  const rightFrom = shiftIsoDateByDays(removeToIso, 1);

  const leftPart = createAbsenceEntry({
    ...entry,
    id: null,
    from: entryFrom,
    to: leftTo
  });

  const rightPart = createAbsenceEntry({
    ...entry,
    id: null,
    from: rightFrom,
    to: entryTo
  });

  return [leftPart, rightPart].filter(Boolean);
}

function removeAbsenceCoverageForEmployee(employeeId, removeFromIso, removeToIso) {
  state.absences = (state.absences || []).flatMap((entry) => {
    if (!entry || entry.employeeId !== employeeId) return entry ? [entry] : [];
    return subtractRangeFromAbsenceEntry(entry, removeFromIso, removeToIso);
  });
}

function addOrReplaceAbsenceForEmployee(employeeId, type, fromIso, toIso) {
  removeAbsenceCoverageForEmployee(employeeId, fromIso, toIso);
  setAbsence(employeeId, fromIso, toIso, type, "");
}

function removeExternalHelpForEmployeeOnDate(employeeId, isoDate) {
  const entry = getPlanEntry(employeeId, isoDate);
  if (!entry) return;

  if (entry.type === "external-help") {
    clearPlanEntry(employeeId, isoDate);
  }
}

function removeScheduledShiftForEmployeeOnDate(employeeId, isoDate) {
  const entry = getPlanEntry(employeeId, isoDate);
  if (!entry) return;

  if (entry.type === "shift") {
    clearPlanEntry(employeeId, isoDate);
  }
}

function setExternalHelpForEmployeeOnDate(employeeId, isoDate, branch, hhmm) {
  const minutes = hhmmToMinutes(hhmm);
  if (minutes <= 0) return false;

  setExternalHelp(employeeId, isoDate, branch || "", minutes);
  return true;
}

function getWeekSelectValueForDay(emp, isoDate) {
  const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);

  if (resolved.type === "holiday") return "H";
  if (resolved.type === "sick") return "K";
  if (resolved.type === "vacation") return "U";
  if (resolved.type === "external-help") return "AH";

  if (resolved.type === "shift" && resolved.sourceEntry) {
    const entry = resolved.sourceEntry;

    if (entry.mode === "early") return entry.code || "-";
    if (entry.mode === "late") return "L";
    if (entry.mode === "full") return "G";
    if (entry.mode === "flex") return "FLEX";
  }

  return "-";
}

function buildWeekSelectClass(value) {
  return `weekSelect ${getShiftClassByKey(value === "U" || value === "K" || value === "AH" || value === "H" ? "-" : value)}`;
}

function isDialogBackedValue(value) {
  return ["L", "G", "FLEX", "AH", "U", "K"].includes(value);
}

function getAbsenceEntryForEmployeeOnIso(employeeId, isoDate, type) {
  return (state.absences || []).find((entry) => {
    if (!entry || entry.employeeId !== employeeId) return false;
    if (entry.type !== type) return false;
    return isoDate >= entry.from && isoDate <= entry.to;
  }) || null;
}

function minutesToHHMMInput(minutes) {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function removeAbsenceEntryForEmployeeOnIso(employeeId, isoDate, type) {
  const entry = getAbsenceEntryForEmployeeOnIso(employeeId, isoDate, type);
  if (!entry) return false;

  state.absences = (state.absences || []).filter((item) => item.id !== entry.id);
  commitPlanChange();
  return true;
}
function trimAbsenceEntryFromIso(employeeId, isoDate, type) {
  const entry = getAbsenceEntryForEmployeeOnIso(employeeId, isoDate, type);
  if (!entry) return false;

  // Wenn der Eintrag genau an diesem Tag beginnt → komplett löschen
  if (entry.from === isoDate) {
    state.absences = state.absences.filter((a) => a.id !== entry.id);
    commitPlanChange();
    return true;
  }

  // sonst bis zum Tag davor kürzen
  const prevDate = shiftIsoDateByDays(isoDate, -1);
  entry.to = prevDate;

  commitPlanChange();
  return true;
}

function fillShiftDialogFromExisting(type, context) {
  const { emp, isoDate } = context;
  const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);

  if (type === "L" && resolved.type === "shift" && resolved.sourceEntry?.mode === "late") {
    const entry = resolved.sourceEntry;
    shiftDialogLateStart.value = entry.start || "13:00";
    shiftDialogLateCheckout.value = entry.end === "19:10" ? "yes" : "no";
  }

  if (type === "G" && resolved.type === "shift" && resolved.sourceEntry?.mode === "full") {
    const entry = resolved.sourceEntry;
    shiftDialogFullCheckout.value = entry.end === "19:10" ? "yes" : "no";
  }

  if (type === "FLEX" && resolved.type === "shift" && resolved.sourceEntry?.mode === "flex") {
    const entry = resolved.sourceEntry;
    shiftDialogFlexStart.value = entry.start || "";
    shiftDialogFlexEnd.value = entry.end || "";
  }

  if (type === "AH" && resolved.type === "external-help" && resolved.sourceEntry) {
    const entry = resolved.sourceEntry;
    shiftDialogExternalHelpBranch.value = entry.branch || "";
    shiftDialogExternalHelpDuration.value = minutesToHHMMInput(entry.minutes);
  }

  if (type === "U") {
    const absence = getAbsenceEntryForEmployeeOnIso(emp.id, isoDate, "vacation");
    if (absence) {
      shiftDialogAbsenceFrom.value = absence.from;
      shiftDialogAbsenceTo.value = absence.to;
    }
  }

  if (type === "K") {
    const absence = getAbsenceEntryForEmployeeOnIso(emp.id, isoDate, "sick");
    if (absence) {
      shiftDialogAbsenceFrom.value = absence.from;
      shiftDialogAbsenceTo.value = absence.to;
    }
  }
}

function createWeekSelect(emp, isoDate) {
  const currentValue = getWeekSelectValueForDay(emp, isoDate);
  const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);
  const blockingType = getBlockingTypeForEmployeeOnIso(emp, isoDate);

  const wrap = document.createElement("div");
  wrap.className = "weekCellControl";

  const cellFlags = getWeekCellFlags(emp, isoDate);
  if (cellFlags.isLateToEarlyBridge) {
    wrap.classList.add("weekCellHandoverOk");
    wrap.title = "Vortag bis 19:10 und heute Frühstart";
  }
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "6px";

  const sel = document.createElement("select");
  sel.className = buildWeekSelectClass(currentValue);
  sel.style.flex = "1";

  

 if (blockingType === "holiday") {
  const opt = document.createElement("option");
  opt.value = "H";
  opt.textContent = "H";
  sel.appendChild(opt);
  sel.value = "H";
  sel.disabled = true;
  wrap.appendChild(sel);
  return wrap;
}
  const groupShifts = document.createElement("optgroup");
  groupShifts.label = "Schichten";

  [
    { value: "-", label: "-" },
    { value: "F3", label: "F3" },
    { value: "F4", label: "F4" },
    { value: "F5", label: "F5" },
    { value: "F6", label: "F6" },
    { value: "L", label: "L" },
    { value: "G", label: "G" },
    { value: "FLEX", label: "Flex" }
  ].forEach((shift) => {
    const opt = document.createElement("option");
    opt.value = shift.value;
    opt.textContent = shift.label;
    groupShifts.appendChild(opt);
  });

  const groupSpecial = document.createElement("optgroup");
  groupSpecial.label = "Abwesenheit / Sonstiges";

  [
    { value: "U", label: "U" },
    { value: "K", label: "K" },
    { value: "AH", label: "AH" }
  ].forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.value;
    opt.textContent = item.label;
    groupSpecial.appendChild(opt);
  });

  sel.appendChild(groupShifts);
  sel.appendChild(groupSpecial);
  sel.value = currentValue;

  sel.addEventListener("change", () => {
    const selectedValue = sel.value;
    const previousValue = currentValue;

        if (blockingType === "vacation" || blockingType === "sick") {
      if (selectedValue !== "U" && selectedValue !== "K" && selectedValue !== "-") {
        sel.value = previousValue;
        return;
      }
    }

    if (selectedValue === "U") {
      openShiftDialog("U", { emp, isoDate, type: "U" });
      sel.value = previousValue;
      return;
    }

    if (selectedValue === "K") {
      openShiftDialog("K", { emp, isoDate, type: "K" });
      sel.value = previousValue;
      return;
    }

    if (selectedValue === "AH") {
      openShiftDialog("AH", { emp, isoDate, type: "AH" });
      sel.value = previousValue;
      return;
    }

    if (selectedValue === "L") {
      openShiftDialog("L", { emp, isoDate, type: "L" });
      sel.value = previousValue;
      return;
    }

    if (selectedValue === "G") {
      openShiftDialog("G", { emp, isoDate, type: "G" });
      sel.value = previousValue;
      return;
    }

    if (selectedValue === "FLEX") {
      openShiftDialog("FLEX", { emp, isoDate, type: "FLEX" });
      sel.value = previousValue;
      return;
    }

    clearDay(emp.id, isoDate, { commit: false });

   if (selectedValue !== "-") {
  const entry = buildEarlyShiftEntry(selectedValue);

  if (!entry) {
    alert("Ungültige Frühschicht.");
    sel.value = previousValue;
    return;
  }

  setPlanEntry(emp.id, isoDate, entry);
  return;
}

commitPlanChange();
  });

  wrap.appendChild(sel);

  if (isDialogBackedValue(currentValue)) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "✎";
    editBtn.title = "Eintrag bearbeiten";
    editBtn.className = "miniEditBtn";
    editBtn.style.flex = "0 0 auto";
    editBtn.style.padding = "4px 8px";
    editBtn.style.borderRadius = "8px";
    editBtn.style.border = "1px solid #ccc";
    editBtn.style.background = "#fff";
    editBtn.style.cursor = "pointer";

    editBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openShiftDialog(currentValue, { emp, isoDate, type: currentValue });
    });

    wrap.appendChild(editBtn);
  }

  return wrap;
}
function isEarlyStartEntry(entry) {
  if (!entry || entry.type !== "shift") return false;

  if (entry.mode === "early" || entry.mode === "full") return true;

  if (!entry.start) return false;
  return hhmmToMinutes(entry.start) <= hhmmToMinutes("09:00");
}

function getWeekDayHeaderMeta(index, visibleDays) {
  const day = visibleDays[index];
  if (!day) return null;

  const closers = getClosingWorkersForIso(day.iso);
  const hasClosingCoverage = closers.length > 0;
  const hasTooManyClosers = closers.length > 2;

  let handoverState = "none";
  let handoverText = "Übergabe —";

  if (index > 0) {
    const prevDay = visibleDays[index - 1];
    const prevClosers = prevDay ? getClosingWorkersForIso(prevDay.iso) : [];

    if (prevClosers.length > 0) {
      const hasEarlyHandover = prevClosers.some((emp) => {
        const entry = getPlanEntry(emp.id, day.iso);
        return isEarlyStartEntry(entry);
      });

      handoverState = hasEarlyHandover ? "ok" : "missing";
      handoverText = hasEarlyHandover ? "Übergabe ✓" : "Übergabe ✗";
    }
  }

  return {
    closers,
    closersText: `19:10 ${closers.length}/2`,
    closersState: hasTooManyClosers ? "high" : hasClosingCoverage ? "ok" : "low",
    handoverState,
    handoverText
  };
}

function getWeekCellFlags(emp, isoDate) {
  const prevIso = shiftIsoDateByDays(isoDate, -1);
  const prevEntry = getPlanEntry(emp.id, prevIso);
  const currentEntry = getPlanEntry(emp.id, isoDate);

  return {
    isLateToEarlyBridge: isClosingResolvedEntry(prevEntry) && isEarlyStartEntry(currentEntry)
  };
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

  visibleDays.forEach((day, index) => {
    const minutes = totalMinutesForDayIso(day.iso);
    const hoursText = minutesToHM(minutes);
    const meta = getWeekDayHeaderMeta(index, visibleDays);
    const isToday = day.iso === toIsoDate(new Date());

    let hoursClass = "weekDayHours";

    if (minutes < 600) {
      hoursClass += " hoursLow";
    } else if (minutes > 1200) {
      hoursClass += " hoursHigh";
    } else {
      hoursClass += " hoursOk";
    }

    const classes = [];
    if (isToday) classes.push("todayCol");

    const classAttr = classes.length ? ` class="${classes.join(" ")}"` : "";
    const grayStyle = day.isOutsideMonth ? ` style="background:#eee;color:#666;"` : "";

    headerHtml += `
      <th${classAttr}${grayStyle}>
        ${day.weekdayLabel}<br>
        ${pad2(day.date.getDate())}.${pad2(day.date.getMonth() + 1)}<br>
        <span class="${hoursClass}">${hoursText}</span><br>
        <span class="weekDayMeta weekDayMeta--${meta.closersState}">${meta.closersText}</span>
        ${meta.handoverState !== "none" ? `<br><span class="weekDayMeta weekDayMeta--${meta.handoverState}">${meta.handoverText}</span>` : ""}
      </th>
    `;
  });

  headerHtml += `
      <th class="weekSummaryCol">Ist</th>
      <th class="weekSummaryCol">Δ</th>
      <th class="weekSummaryCol">Soll</th>
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

      if (day.iso === toIsoDate(new Date())) {
        td.classList.add("todayCol");
      }

      td.appendChild(createWeekSelect(emp, day.iso));
      tr.appendChild(td);
    });

    const tdActual = document.createElement("td");
    tdActual.className = "weekHoursCell weekSummaryCol";
    tdActual.textContent = minutesToHM(totalMinutesForEmployee(emp));
    tr.appendChild(tdActual);

    const delta = deltaMinutes(emp);
    const tdDelta = document.createElement("td");
    tdDelta.className = `weekDeltaCell weekSummaryCol ${
      delta < 0 ? "deltaNeg" : delta > 0 ? "deltaPos" : "deltaZero"
    }`;
    tdDelta.textContent = formatSignedMinutes(delta);
    tr.appendChild(tdDelta);

    const tdTarget = document.createElement("td");
    tdTarget.className = "weekTargetCell weekSummaryCol";
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
