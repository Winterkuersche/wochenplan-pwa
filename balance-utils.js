function normalizeYearMonthBalance(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) return '';
  return trimmed;
}

function shiftYearMonthByMonthsBalance(yearMonth, offsetMonths = 0) {
  const normalized = normalizeYearMonthBalance(yearMonth);
  if (!normalized) return '';

  const [year, month] = normalized.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return '';

  date.setMonth(date.getMonth() + Number(offsetMonths || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function collectRelevantYearMonthsUntilActiveMonthBalance({
  activeYearMonth,
  scheduleIsoDates = [],
  absences = [],
  manualMonthActualMinutes = {},
  historyStartMonth = '2026-01'
} = {}) {
  const normalizedActive = normalizeYearMonthBalance(activeYearMonth);
  if (!normalizedActive) return [];

  const candidates = [normalizedActive];

  scheduleIsoDates.forEach((isoDate) => {
    const month = normalizeYearMonthBalance(String(isoDate || '').slice(0, 7));
    if (month && month >= historyStartMonth && month <= normalizedActive) {
      candidates.push(month);
    }
  });

  absences.forEach((entry) => {
    const fromMonth = normalizeYearMonthBalance(String(entry?.from || '').slice(0, 7));
    const toMonth = normalizeYearMonthBalance(String(entry?.to || '').slice(0, 7));

    if (fromMonth && fromMonth >= historyStartMonth && fromMonth <= normalizedActive) {
      candidates.push(fromMonth);
    }
    if (toMonth && toMonth >= historyStartMonth && toMonth <= normalizedActive) {
      candidates.push(toMonth);
    }
  });

  Object.keys(manualMonthActualMinutes || {}).forEach((month) => {
    const normalized = normalizeYearMonthBalance(month);
    if (normalized && normalized >= historyStartMonth && normalized <= normalizedActive) {
      candidates.push(normalized);
    }
  });

  const unique = [...new Set(candidates)].sort();
  const first = unique[0] < historyStartMonth ? historyStartMonth : unique[0];

  const months = [];
  let cursor = first;
  while (cursor && cursor <= normalizedActive) {
    months.push(cursor);
    cursor = shiftYearMonthByMonthsBalance(cursor, 1);
  }

  return months;
}
