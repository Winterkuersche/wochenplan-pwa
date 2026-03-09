function getScheduleEntryForEmployeeOnDate(schedule, employeeId, isoDate) {
  if (!schedule || !employeeId || !isoDate) return null;
  return schedule?.[isoDate]?.[employeeId] || null;
}

function isExternalHelpEntry(entry) {
  return !!entry && entry.type === "external-help";
}

function getExternalHelpDisplayLabel(entry) {
  if (!isExternalHelpEntry(entry)) return "";
  return entry.label || "AH";
}

function getExternalHelpMinutes(entry) {
  if (!isExternalHelpEntry(entry)) return 0;

  if (typeof entry.minutes === "number") {
    return Math.max(0, entry.minutes);
  }

  if (typeof entry.minutes === "string") {
    return Math.max(0, hhmmToMinutes(entry.minutes));
  }

  return 0;
}

function createResolvedDayEntry({
  type = "off",
  label = "",
  minutesForMonth = 0,
  minutesForBranch = 0,
  isSunday = false,
  isHoliday = false,
  holidayName = "",
  sourceEntry = null
} = {}) {
  return {
    type,
    label,
    minutesForMonth: Math.max(0, minutesForMonth || 0),
    minutesForBranch: Math.max(0, minutesForBranch || 0),
    isSunday: !!isSunday,
    isHoliday: !!isHoliday,
    holidayName: holidayName || "",
    sourceEntry
  };
}

function getResolvedDayEntry({
  employee,
  isoDate,
  schedule,
  absences,
  stateKey
}) {
  if (!employee || !employee.id || !isoDate) {
    return createResolvedDayEntry();
  }

  const sunday = isSundayIsoDate(isoDate);
  const holiday = getHolidayByDate(stateKey, isoDate);
  const absence = getPriorityAbsenceForEmployeeOnDate(absences, employee.id, isoDate);
  const plannedEntry = getScheduleEntryForEmployeeOnDate(schedule, employee.id, isoDate);

  if (holiday) {
    return createResolvedDayEntry({
      type: "holiday",
      label: "H",
      minutesForMonth: sunday ? 0 : getAbsenceMinutesForEmployee(employee),
      minutesForBranch: 0,
      isSunday: sunday,
      isHoliday: true,
      holidayName: holiday.name,
      sourceEntry: holiday
    });
  }

  if (absence?.type === "sick") {
    return createResolvedDayEntry({
      type: "sick",
      label: "K",
      minutesForMonth: sunday ? 0 : getAbsenceMinutesForEmployee(employee),
      minutesForBranch: 0,
      isSunday: sunday,
      sourceEntry: absence
    });
  }

  if (absence?.type === "vacation") {
    return createResolvedDayEntry({
      type: "vacation",
      label: "U",
      minutesForMonth: sunday ? 0 : getAbsenceMinutesForEmployee(employee),
      minutesForBranch: 0,
      isSunday: sunday,
      sourceEntry: absence
    });
  }

  if (isExternalHelpEntry(plannedEntry)) {
    return createResolvedDayEntry({
      type: "external-help",
      label: getExternalHelpDisplayLabel(plannedEntry),
      minutesForMonth: sunday ? 0 : getExternalHelpMinutes(plannedEntry),
      minutesForBranch: 0,
      isSunday: sunday,
      sourceEntry: plannedEntry
    });
  }

  if (isShiftEntry(plannedEntry)) {
    return createResolvedDayEntry({
      type: "shift",
      label: getShiftDisplayLabel(plannedEntry),
      minutesForMonth: sunday ? 0 : (plannedEntry.minutes || 0),
      minutesForBranch: sunday ? 0 : (plannedEntry.minutes || 0),
      isSunday: sunday,
      sourceEntry: plannedEntry
    });
  }

  return createResolvedDayEntry({
    type: "off",
    label: "",
    minutesForMonth: 0,
    minutesForBranch: 0,
    isSunday: sunday
  });
}

function getResolvedDayLabel(params) {
  return getResolvedDayEntry(params).label;
}

function getResolvedMonthMinutes(params) {
  return getResolvedDayEntry(params).minutesForMonth;
}

function getResolvedBranchMinutes(params) {
  return getResolvedDayEntry(params).minutesForBranch;
}
