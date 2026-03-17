const shiftDialogOverlay = document.getElementById("shiftDialogOverlay");
const shiftDialogTitle = document.getElementById("shiftDialogTitle");

const shiftDialogLateFields = document.getElementById("shiftDialogLateFields");
const shiftDialogFullFields = document.getElementById("shiftDialogFullFields");
const shiftDialogFlexFields = document.getElementById("shiftDialogFlexFields");

const shiftDialogLateStart = document.getElementById("shiftDialogLateStart");
const shiftDialogLateCheckout = document.getElementById("shiftDialogLateCheckout");

const shiftDialogFullCheckout = document.getElementById("shiftDialogFullCheckout");

const shiftDialogFlexStartHour = document.getElementById("shiftDialogFlexStartHour");
const shiftDialogFlexStartMinute = document.getElementById("shiftDialogFlexStartMinute");
const shiftDialogFlexEndHour = document.getElementById("shiftDialogFlexEndHour");
const shiftDialogFlexEndMinute = document.getElementById("shiftDialogFlexEndMinute");

const shiftDialogAbsenceFields = document.getElementById("shiftDialogAbsenceFields");
const shiftDialogAbsenceType = document.getElementById("shiftDialogAbsenceType");
const shiftDialogAbsenceFrom = document.getElementById("shiftDialogAbsenceFrom");
const shiftDialogAbsenceTo = document.getElementById("shiftDialogAbsenceTo");

const shiftDialogCancel = document.getElementById("shiftDialogCancel");
const shiftDialogSave = document.getElementById("shiftDialogSave");
const shiftDialogDelete = document.getElementById("shiftDialogDelete");

const shiftDialogExternalHelpFields = document.getElementById("shiftDialogExternalHelpFields");
const shiftDialogExternalHelpBranch = document.getElementById("shiftDialogExternalHelpBranch");
const shiftDialogExternalHelpStartHour = document.getElementById("shiftDialogExternalHelpStartHour");
const shiftDialogExternalHelpStartMinute = document.getElementById("shiftDialogExternalHelpStartMinute");
const shiftDialogExternalHelpEndHour = document.getElementById("shiftDialogExternalHelpEndHour");
const shiftDialogExternalHelpEndMinute = document.getElementById("shiftDialogExternalHelpEndMinute");
const shiftDialogExternalHelpPauseHour = document.getElementById("shiftDialogExternalHelpPauseHour");
const shiftDialogExternalHelpPauseMinute = document.getElementById("shiftDialogExternalHelpPauseMinute");
const shiftDialogExternalHelpDuration = document.getElementById("shiftDialogExternalHelpDuration");

let shiftDialogContext = null;

const QUARTER_MINUTE_OPTIONS = ["00", "15", "30", "45"];

function initHourSelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = "";

  for (let hour = 0; hour <= 23; hour += 1) {
    const option = document.createElement("option");
    option.value = String(hour).padStart(2, "0");
    option.textContent = String(hour).padStart(2, "0");
    selectEl.appendChild(option);
  }
}

function initQuarterMinuteSelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = "";

  QUARTER_MINUTE_OPTIONS.forEach((minute) => {
    const option = document.createElement("option");
    option.value = minute;
    option.textContent = minute;
    selectEl.appendChild(option);
  });
}

function initQuarterTimePicker(hourEl, minuteEl) {
  initHourSelect(hourEl);
  initQuarterMinuteSelect(minuteEl);
}

function setQuarterPickerValue(hourEl, minuteEl, hhmm) {
  const normalized = normalizeTimeToQuarterHour(hhmm || "") || "00:00";
  const [hour, minute] = normalized.split(":");
  if (hourEl) hourEl.value = hour;
  if (minuteEl) minuteEl.value = minute;
}

function getQuarterPickerValue(hourEl, minuteEl) {
  if (!hourEl || !minuteEl) return "";
  const hour = hourEl.value || "00";
  const minute = minuteEl.value || "00";
  return `${hour}:${minute}`;
}

initQuarterTimePicker(shiftDialogFlexStartHour, shiftDialogFlexStartMinute);
initQuarterTimePicker(shiftDialogFlexEndHour, shiftDialogFlexEndMinute);
initQuarterTimePicker(shiftDialogExternalHelpStartHour, shiftDialogExternalHelpStartMinute);
initQuarterTimePicker(shiftDialogExternalHelpEndHour, shiftDialogExternalHelpEndMinute);
initQuarterTimePicker(shiftDialogExternalHelpPauseHour, shiftDialogExternalHelpPauseMinute);

function getAbsenceTypeMeta(type) {
  if (type === "sick") {
    return {
      dialogType: "K",
      title: "Krank",
      invalidRangeMessage: "Ungültiger Krankzeitraum.",
      confirmDeleteMessage: "OK = gesamte Krankmeldung löschen\nAbbrechen = Krankmeldung ab diesem Tag kürzen"
    };
  }

  return {
    dialogType: "U",
    title: "Urlaub",
    invalidRangeMessage: "Ungültiger Urlaubszeitraum.",
    confirmDeleteMessage: "OK = gesamten Urlaub löschen\nAbbrechen = Urlaub ab diesem Tag kürzen"
  };
}

function getAbsenceTypeFromDialogContext(type) {
  if (shiftDialogAbsenceType?.value === "sick") return "sick";
  return type === "K" ? "sick" : "vacation";
}

function getDialogTypeFromResolvedEntry(resolved) {
  const status = getResolvedStatus(resolved);
  if (status === ENTRY_STATUS.VACATION) return "U";
  if (status === ENTRY_STATUS.SICK) return "K";
  if (status === ENTRY_STATUS.EXTERNAL) return "AH";
  return null;
}

function resetShiftDialogInputs(isoDate) {
  shiftDialogLateStart.value = "13:00";
  shiftDialogLateCheckout.value = "yes";
  shiftDialogFullCheckout.value = "yes";
  setQuarterPickerValue(shiftDialogFlexStartHour, shiftDialogFlexStartMinute, "00:00");
  setQuarterPickerValue(shiftDialogFlexEndHour, shiftDialogFlexEndMinute, "00:00");

  shiftDialogExternalHelpBranch.value = "";
  setQuarterPickerValue(shiftDialogExternalHelpStartHour, shiftDialogExternalHelpStartMinute, "09:00");
  setQuarterPickerValue(shiftDialogExternalHelpEndHour, shiftDialogExternalHelpEndMinute, "14:00");
  setQuarterPickerValue(shiftDialogExternalHelpPauseHour, shiftDialogExternalHelpPauseMinute, "00:00");
  shiftDialogExternalHelpDuration.value = "05:00";
  refreshExternalHelpDurationField();

  shiftDialogAbsenceType.value = "vacation";
  shiftDialogAbsenceFrom.value = isoDate || "";
  shiftDialogAbsenceTo.value = isoDate || "";
}

function updateAbsenceDialogTitle() {
  if (!shiftDialogContext) return;
  const absenceType = getAbsenceTypeFromDialogContext(shiftDialogContext.type);
  shiftDialogTitle.textContent = getAbsenceTypeMeta(absenceType).title;
}

function openShiftDialog(type, context) {
  shiftDialogContext = context;
  resetShiftDialogInputs(context.isoDate);

  shiftDialogLateFields.classList.add("hidden");
  shiftDialogFullFields.classList.add("hidden");
  shiftDialogFlexFields.classList.add("hidden");
  shiftDialogAbsenceFields.classList.add("hidden");
  shiftDialogExternalHelpFields.classList.add("hidden");

  if (type === "AH") {
    shiftDialogTitle.textContent = "Aushilfe";
    shiftDialogExternalHelpFields.classList.remove("hidden");
  }

  if (type === "U" || type === "K") {
    shiftDialogAbsenceType.value = type === "K" ? "sick" : "vacation";
    shiftDialogAbsenceFields.classList.remove("hidden");
    updateAbsenceDialogTitle();
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

  if (type === "U" || type === "K") {
    const absenceType = getAbsenceTypeFromDialogContext(type);
    const meta = getAbsenceTypeMeta(absenceType);
    const choice = confirm(meta.confirmDeleteMessage);

    if (choice) {
      removeAbsenceEntryForEmployeeOnIso(emp.id, isoDate, absenceType);
    } else {
      trimAbsenceEntryFromIso(emp.id, isoDate, absenceType);
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
    const start = getQuarterPickerValue(shiftDialogFlexStartHour, shiftDialogFlexStartMinute);
    const end = getQuarterPickerValue(shiftDialogFlexEndHour, shiftDialogFlexEndMinute);

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

  if (type === "U" || type === "K") {
    const absenceType = getAbsenceTypeFromDialogContext(type);
    const meta = getAbsenceTypeMeta(absenceType);
    const fromIso = shiftDialogAbsenceFrom.value;
    const toIso = shiftDialogAbsenceTo.value;

    if (!fromIso || !toIso || !fromIsoDate(fromIso) || !fromIsoDate(toIso) || toIso < fromIso) {
      alert(meta.invalidRangeMessage);
      return;
    }

    clearDayRange(emp.id, fromIso, toIso, { commit: false });
    addOrReplaceAbsenceForEmployee(emp.id, absenceType, fromIso, toIso);
    closeShiftDialog();
    return;
  }

  if (type === "AH") {
    const branch = (shiftDialogExternalHelpBranch.value || "").trim();
    const start = getQuarterPickerValue(shiftDialogExternalHelpStartHour, shiftDialogExternalHelpStartMinute);
    const end = getQuarterPickerValue(shiftDialogExternalHelpEndHour, shiftDialogExternalHelpEndMinute);
    const pauseHHMM = getQuarterPickerValue(shiftDialogExternalHelpPauseHour, shiftDialogExternalHelpPauseMinute) || "00:00";

    clearDay(emp.id, isoDate, { commit: false });

    const ok = setExternalHelpForEmployeeOnDate(emp.id, isoDate, {
      branch,
      start,
      end,
      pauseHHMM
    });

    if (!ok) {
      alert("Ungültige Aushilfe-Zeiten. Bitte Start/Ende/Pause prüfen (nur 15-Minuten-Schritte).");
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
  setAbsence(employeeId, fromIso, toIso, type, "", { commit: false });

  syncVacationScheduleFromAbsences(employeeId);

  commitPlanChange();
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

function setExternalHelpForEmployeeOnDate(employeeId, isoDate, options = {}) {
  const branch = (options.branch || "").trim();
  const start = normalizeTimeToQuarterHour(options.start || "");
  const end = normalizeTimeToQuarterHour(options.end || "");
  const pauseMinutes = normalizeMinutesToQuarterHour(parseTimeToMinutes(options.pauseHHMM || "00:00"));

  if (!start || !end) return false;
  if (!isQuarterHourTime(start) || !isQuarterHourTime(end)) return false;

  const spanMinutes = diffMinutesBetweenHHMM(start, end);
  if (spanMinutes <= 0) return false;
  if (pauseMinutes >= spanMinutes) return false;

  const workedMinutes = Math.max(0, spanMinutes - pauseMinutes);
  if (workedMinutes <= 0) return false;

  setPlanEntry(employeeId, isoDate, {
    type: "external-help",
    status: ENTRY_STATUS.EXTERNAL,
    label: "AH",
    branch,
    externalHelp: true,
    start,
    end,
    pause: pauseMinutes,
    breakMinutes: pauseMinutes,
    minutes: workedMinutes
  });

  return true;
}

function getWeekSelectValueForDay(emp, isoDate) {
  const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);

  if (resolved.type === "holiday") return "H";

  const dialogType = getDialogTypeFromResolvedEntry(resolved);
  if (dialogType) return dialogType;

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
  if (value === "U" || value === "K" || value === "AH") {
    return `weekSelect ${value === "U" ? "vacation" : "free"}`;
  }

  return `weekSelect ${getShiftClassByKey(value === "H" ? "-" : value)}`;
}

function isReusableShiftValue(value) {
  return ["F3", "F4", "F5", "F6", "L", "G"].includes(value);
}

function getEmployeeLastShiftLabel(emp) {
  const shiftDays = Object.keys(state.schedule || {}).sort().reverse();

  for (const isoDate of shiftDays) {
    const value = getWeekSelectValueForDay(emp, isoDate);
    if (["F3", "F4", "F5", "F6", "L", "G", "FLEX"].includes(value)) {
      return value;
    }
  }

  return null;
}

function rememberLastSelectedShift(value) {
  if (!isReusableShiftValue(value)) return;
  lastSelectedShift = value;
}

function getAbsenceEntryForEmployeeOnIso(employeeId, isoDate, type) {
  return (state.absences || []).find((entry) => {
    if (!entry || entry.employeeId !== employeeId) return false;
    if (entry.type !== type) return false;
    return isoDate >= entry.from && isoDate <= entry.to;
  }) || null;
}

function minutesToHHMMInput(minutes) {
  return formatQuarterHourTime(Math.max(0, Number(minutes) || 0));
}

function removeAbsenceEntryForEmployeeOnIso(employeeId, isoDate, type) {
  const entry = getAbsenceEntryForEmployeeOnIso(employeeId, isoDate, type);
  if (!entry) return false;

  state.absences = (state.absences || []).filter((item) => item.id !== entry.id);
  syncVacationScheduleFromAbsences(employeeId);
  commitPlanChange();
  return true;
}
function trimAbsenceEntryFromIso(employeeId, isoDate, type) {
  const entry = getAbsenceEntryForEmployeeOnIso(employeeId, isoDate, type);
  if (!entry) return false;

  // Wenn der Eintrag genau an diesem Tag beginnt → komplett löschen
  if (entry.from === isoDate) {
    state.absences = state.absences.filter((a) => a.id !== entry.id);
    syncVacationScheduleFromAbsences(employeeId);
    commitPlanChange();
    return true;
  }

  // sonst bis zum Tag davor kürzen
  const prevDate = shiftIsoDateByDays(isoDate, -1);
  entry.to = prevDate;

  syncVacationScheduleFromAbsences(employeeId);

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
    const entry = normalizePlanEntry(resolved.sourceEntry) || resolved.sourceEntry;
    setQuarterPickerValue(shiftDialogFlexStartHour, shiftDialogFlexStartMinute, entry.start || "00:00");
    setQuarterPickerValue(shiftDialogFlexEndHour, shiftDialogFlexEndMinute, entry.end || "00:00");
  }

  if (type === "AH" && resolved.type === "external-help" && resolved.sourceEntry) {
    const entry = normalizePlanEntry(resolved.sourceEntry) || resolved.sourceEntry;
    const start = entry.start || "09:00";
    const end = entry.end || addMinutesToHHMM(start, entry.minutes || 0);
    const pauseMinutes = normalizeMinutesToQuarterHour(entry.pause ?? entry.breakMinutes ?? 0);

    shiftDialogExternalHelpBranch.value = entry.branch || "";
    setQuarterPickerValue(shiftDialogExternalHelpStartHour, shiftDialogExternalHelpStartMinute, start);
    setQuarterPickerValue(shiftDialogExternalHelpEndHour, shiftDialogExternalHelpEndMinute, end);
    setQuarterPickerValue(shiftDialogExternalHelpPauseHour, shiftDialogExternalHelpPauseMinute, minutesToHHMMInput(pauseMinutes));
    shiftDialogExternalHelpDuration.value = minutesToHHMMInput(entry.minutes);
    refreshExternalHelpDurationField();
  }

  if (type === "U") {
    const absence = getAbsenceEntryForEmployeeOnIso(emp.id, isoDate, "vacation");
    if (absence) {
      shiftDialogAbsenceType.value = "vacation";
      shiftDialogAbsenceFrom.value = absence.from;
      shiftDialogAbsenceTo.value = absence.to;
    }
  }

  if (type === "K") {
    const absence = getAbsenceEntryForEmployeeOnIso(emp.id, isoDate, "sick");
    if (absence) {
      shiftDialogAbsenceType.value = "sick";
      shiftDialogAbsenceFrom.value = absence.from;
      shiftDialogAbsenceTo.value = absence.to;
    }
  }
}

shiftDialogAbsenceType?.addEventListener("change", () => {
  updateAbsenceDialogTitle();
});

function refreshExternalHelpDurationField() {
  if (!shiftDialogExternalHelpDuration) return;

  const start = normalizeTimeToQuarterHour(
    getQuarterPickerValue(shiftDialogExternalHelpStartHour, shiftDialogExternalHelpStartMinute)
  );
  const end = normalizeTimeToQuarterHour(
    getQuarterPickerValue(shiftDialogExternalHelpEndHour, shiftDialogExternalHelpEndMinute)
  );
  const pauseMinutes = normalizeMinutesToQuarterHour(
    parseTimeToMinutes(
      getQuarterPickerValue(shiftDialogExternalHelpPauseHour, shiftDialogExternalHelpPauseMinute) || "00:00"
    )
  );

  if (!start || !end) {
    shiftDialogExternalHelpDuration.value = "";
    return;
  }

  const spanMinutes = diffMinutesBetweenHHMM(start, end);
  if (spanMinutes <= 0 || pauseMinutes >= spanMinutes) {
    shiftDialogExternalHelpDuration.value = "";
    return;
  }

  shiftDialogExternalHelpDuration.value = minutesToHHMMInput(spanMinutes - pauseMinutes);
}

[shiftDialogExternalHelpStartHour, shiftDialogExternalHelpStartMinute,
  shiftDialogExternalHelpEndHour, shiftDialogExternalHelpEndMinute,
  shiftDialogExternalHelpPauseHour, shiftDialogExternalHelpPauseMinute].forEach((el) => {
  el?.addEventListener("change", refreshExternalHelpDurationField);
});


function createWeekSelect(emp, isoDate) {
  const currentValue = getWeekSelectValueForDay(emp, isoDate);
  const blockingType = getBlockingTypeForEmployeeOnIso(emp, isoDate);

  const wrap = document.createElement("div");
  wrap.className = "weekCellControl";

  const isEmptyCell = currentValue === "-";

  const cellFlags = getWeekCellFlags(emp, isoDate);
  if (cellFlags.isLateToEarlyBridge) {
    wrap.classList.add("weekCellHandoverOk");
    wrap.title = "Vortag bis 19:10 und heute Frühstart";
  }

  const sel = document.createElement("select");
  sel.className = buildWeekSelectClass(currentValue);

  

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

    rememberLastSelectedShift(selectedValue);

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

  if (isEmptyCell && lastSelectedShift !== null) {
    const hint = document.createElement("span");
    hint.className = "weekCellHint";
    hint.textContent = lastSelectedShift;
    wrap.appendChild(hint);
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
      <th class="weekSummaryCol weekSummaryStart">Ist</th>
      <th class="weekSummaryCol">Δ Woche</th>
      <th class="weekSummaryCol">Δ Monat</th>
      <th class="weekSummaryCol">Gesamtminus</th>
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
    const lastShift = getEmployeeLastShiftLabel(emp);

    const tdNameRole = document.createElement("td");
    tdNameRole.className = "nameRoleCell";
    tdNameRole.innerHTML = `
      <div class="nameRoleName">${emp.name || "—"}</div>
      <div class="nameRoleSub">${emp.roleKey || "-"}</div>
      ${lastShift ? `<div class="nameRoleLast">letzte: ${lastShift}</div>` : ""}
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
    tdActual.className = "weekHoursCell weekSummaryCol weekSummaryStart";
    const plannedMinutes = getEmployeePlannedMinutesForWeek(emp, visibleDays);
    tdActual.textContent = minutesToHM(plannedMinutes);
    tr.appendChild(tdActual);

    const differenceMinutes = getEmployeeWeekDifferenceMinutes(emp, visibleDays);
    const tdDelta = document.createElement("td");
    tdDelta.className = `weekDeltaCell weekSummaryCol ${
      differenceMinutes < 0 ? "deltaNeg" : differenceMinutes > 0 ? "deltaPos" : "deltaZero"
    }`;
    tdDelta.textContent = formatSignedMinutes(differenceMinutes);
    tr.appendChild(tdDelta);

    const monthDifferenceMinutes = getEmployeeMonthDifferenceMinutes(emp);
    const tdMonthDelta = document.createElement("td");
    tdMonthDelta.className = `weekDeltaCell weekSummaryCol ${
      monthDifferenceMinutes < 0 ? "deltaNeg" : monthDifferenceMinutes > 0 ? "deltaPos" : "deltaZero"
    }`;
    tdMonthDelta.textContent = formatSignedMinutes(monthDifferenceMinutes);
    tr.appendChild(tdMonthDelta);

    const totalMinusMinutes = getEmployeeTotalMinusMinutes(emp);
    const tdTotalMinus = document.createElement("td");
    tdTotalMinus.className = `weekDeltaCell weekSummaryCol ${totalMinusMinutes > 0 ? "deltaNeg" : "deltaZero"}`;
    tdTotalMinus.textContent = totalMinusMinutes > 0 ? `-${minutesToHM(totalMinusMinutes)}` : "0:00";
    tr.appendChild(tdTotalMinus);

    const tdTarget = document.createElement("td");
    tdTarget.className = "weekTargetCell weekSummaryCol";
    tdTarget.textContent = minutesToHM(getEmployeeTargetMinutes(emp));
    tr.appendChild(tdTarget);

    weekTableBodyEl.appendChild(tr);
  });
}

function renderWeekView() {
  renderWeekHeader();
  renderWeekWarnings();
  renderWeekTable();
}
