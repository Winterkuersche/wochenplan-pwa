function createAbsenceEntry({ id, employeeId, type, from, to, note = "" }) {
  if (!employeeId) return null;
  if (type !== "vacation" && type !== "sick") return null;
  if (!from || !to) return null;
  if (!fromIsoDate(from) || !fromIsoDate(to)) return null;
  if (from > to) return null;

  return {
    id: id || `abs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    employeeId,
    type,
    from,
    to,
    note: String(note || "").trim()
  };
}

function normalizeAbsences(absences) {
  if (!Array.isArray(absences)) return [];
  return absences
    .map((entry) => createAbsenceEntry(entry))
    .filter(Boolean);
}

function getAbsencesForEmployee(absences, employeeId) {
  if (!Array.isArray(absences) || !employeeId) return [];
  return absences.filter((entry) => entry.employeeId === employeeId);
}

function doesAbsenceMatchDate(absence, isoDate) {
  if (!absence || !isoDate) return false;
  return isIsoDateInRange(isoDate, absence.from, absence.to);
}

function getAbsenceEntriesForEmployeeOnDate(absences, employeeId, isoDate) {
  return getAbsencesForEmployee(absences, employeeId).filter((entry) =>
    doesAbsenceMatchDate(entry, isoDate)
  );
}

function getSickEntryForEmployeeOnDate(absences, employeeId, isoDate) {
  return getAbsenceEntriesForEmployeeOnDate(absences, employeeId, isoDate).find(
    (entry) => entry.type === "sick"
  ) || null;
}

function getVacationEntryForEmployeeOnDate(absences, employeeId, isoDate) {
  return getAbsenceEntriesForEmployeeOnDate(absences, employeeId, isoDate).find(
    (entry) => entry.type === "vacation"
  ) || null;
}

function getPriorityAbsenceForEmployeeOnDate(absences, employeeId, isoDate) {
  const sickEntry = getSickEntryForEmployeeOnDate(absences, employeeId, isoDate);
  if (sickEntry) return sickEntry;

  const vacationEntry = getVacationEntryForEmployeeOnDate(absences, employeeId, isoDate);
  if (vacationEntry) return vacationEntry;

  return null;
}

function addAbsenceEntry(absences, entryInput) {
  const normalized = Array.isArray(absences) ? [...absences] : [];
  const entry = createAbsenceEntry(entryInput);
  if (!entry) return normalized;

  normalized.push(entry);
  return normalized;
}

function removeAbsenceEntry(absences, absenceId) {
  if (!Array.isArray(absences) || !absenceId) return Array.isArray(absences) ? [...absences] : [];
  return absences.filter((entry) => entry.id !== absenceId);
}

function updateAbsenceEntry(absences, absenceId, updates) {
  if (!Array.isArray(absences) || !absenceId) return Array.isArray(absences) ? [...absences] : [];

  return absences.map((entry) => {
    if (entry.id !== absenceId) return entry;

    const merged = {
      ...entry,
      ...updates
    };

    return createAbsenceEntry(merged) || entry;
  });
}

function getAbsenceDisplayLabel(absenceType) {
  if (absenceType === "sick") return "K";
  if (absenceType === "vacation") return "U";
  return "";
}

function getAbsenceMinutesForEmployee(employee) {
  return getDailyTargetMinutesFromWeeklyHHMM(employee?.target || "00:00");
}
