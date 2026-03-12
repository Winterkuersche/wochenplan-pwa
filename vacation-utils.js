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

function getVacationEntriesForEmployee(employeeId) {
  return (state.absences || []).filter((entry) => {
    return entry?.employeeId === employeeId && entry.type === "vacation";
  });
}

function getUsedVacationDaysForEmployee(emp) {
  if (!emp?.id) return 0;

  return getVacationEntriesForEmployee(emp.id).reduce((sum, entry) => {
    return sum + countVacationDaysInRange(entry.from, entry.to);
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
    return Number(emp?.vacationDays ?? 30);
  }

  const ageOnYearStart = getAgeOnDate(emp.birthDate, `${year}-01-01`);

  if (ageOnYearStart >= 50) return 36;
  if (ageOnYearStart >= 40) return 34;
  if (ageOnYearStart >= 30) return 32;
  return 30;
}

function applyVacationDaysForYear(year) {
  state.employees.forEach((emp) => {
    if (!emp) return;
    emp.vacationDays = getVacationDaysByAgeForYear(emp, year);
  });

  saveMasterData();
  renderAllViews();
}

function getRemainingVacationDaysForEmployee(emp) {
  const total = Number(emp?.vacationDays || 0);
  const used = getUsedVacationDaysForEmployee(emp);
  return total - used;
}
