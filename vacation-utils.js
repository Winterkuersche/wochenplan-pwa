function isWorkdayForVacation(isoDate) {
  const date = fromIsoDate(isoDate);
  if (!date) return false;

  // Sonntag nicht zählen
  return date.getDay() !== 0;
}

function countVacationDaysInRange(fromIso, toIso) {
  const from = fromIsoDate(fromIso);
  const to = fromIsoDate(toIso);

  if (!from || !to || to < from) return 0;

  let count = 0;
  const cursor = new Date(from);

  while (cursor <= to) {
    const iso = toIsoDate(cursor);

    if (isWorkdayForVacation(iso)) {
      count += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function countVacationDaysInRangeForYear(fromIso, toIso, year) {
  const from = fromIsoDate(fromIso);
  const to = fromIsoDate(toIso);

  if (!from || !to || to < from) return 0;
  if (!year) return countVacationDaysInRange(fromIso, toIso);

  let count = 0;
  const cursor = new Date(from);

  while (cursor <= to) {
    if (cursor.getFullYear() === year) {
      const iso = toIsoDate(cursor);

      if (isWorkdayForVacation(iso)) {
        count += 1;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function getVacationEntriesForEmployee(employeeId) {
  return (state.absences || []).filter((entry) => {
    return entry?.employeeId === employeeId && entry.type === "vacation";
  });
}

function getUsedVacationDaysForEmployee(emp, year = null) {
  if (!emp?.id) return 0;

  if (typeof getUsedVacationDaysFromScheduleForEmployee === "function") {
    const resolvedYear = year || new Date().getFullYear();
    return getUsedVacationDaysFromScheduleForEmployee(emp.id, resolvedYear);
  }

  return getVacationEntriesForEmployee(emp.id).reduce((sum, entry) => {
    return sum + countVacationDaysInRangeForYear(entry.from, entry.to, year);
  }, 0);
}

function getAgeOnDate(birthDate, isoDate) {
  const birth = fromIsoDate(birthDate);
  const date = fromIsoDate(isoDate);

  if (!birth || !date) return 0;

  let age = date.getFullYear() - birth.getFullYear();
  const monthDiff = date.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && date.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
}

function getVacationDaysByAgeForYear(emp, year) {
  if (!emp?.birthDate) {
    return Number(emp?.totalVacationDays ?? emp?.vacationDays ?? 30);
  }

  const ageOnYearStart = getAgeOnDate(emp.birthDate, `${year}-01-01`);

  if (ageOnYearStart >= 30) return 36;
  if (ageOnYearStart >= 28) return 34;
  if (ageOnYearStart >= 26) return 32;
  if (ageOnYearStart >= 24) return 30;

  return 30;
}

function calculateVacationDays(emp, year) {
  let days = getVacationDaysByAgeForYear(emp, year);

  if (emp?.serviceBonus) {
    days += 1;
  }

  return days;
}

function applyVacationDaysForYear(year) {
  state.employees.forEach((emp) => {
    if (!emp) return;
    emp.vacationDays = calculateVacationDays(emp, year);
  });

  saveAppStateDebounced();
  renderAllViews();
}

function getVacationSummaryForEmployee(emp, year = new Date().getFullYear()) {
  const total = Number(emp?.totalVacationDays ?? calculateVacationDays(emp, year));
  const used = getUsedVacationDaysForEmployee(emp, year);

  return {
    total,
    used,
    remaining: total - used
  };
}

function getRemainingVacationDaysForEmployee(emp, year = new Date().getFullYear()) {
  return getVacationSummaryForEmployee(emp, year).remaining;
}
