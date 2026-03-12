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

function getRemainingVacationDaysForEmployee(emp) {
  const total = Number(emp?.vacationDays || 0);
  const used = getUsedVacationDaysForEmployee(emp);
  return total - used;
}
