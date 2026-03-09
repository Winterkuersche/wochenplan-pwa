function pad2Date(value) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${pad2Date(date.getMonth() + 1)}-${pad2Date(date.getDate())}`;
}

function fromIsoDate(isoDate) {
  if (typeof isoDate !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;

  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function cloneDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isIsoDateInRange(isoDate, fromIso, toIso) {
  if (!isoDate || !fromIso || !toIso) return false;
  return isoDate >= fromIso && isoDate <= toIso;
}

function getMondayBasedDayIndex(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return -1;
  return (date.getDay() + 6) % 7;
}

function isSundayDate(date) {
  return getMondayBasedDayIndex(date) === 6;
}

function isSundayIsoDate(isoDate) {
  const date = fromIsoDate(isoDate);
  if (!date) return false;
  return isSundayDate(date);
}

function formatShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${pad2Date(date.getDate())}.${pad2Date(date.getMonth() + 1)}`;
}

function formatIsoToShortDate(isoDate) {
  const date = fromIsoDate(isoDate);
  if (!date) return "";
  return formatShortDate(date);
}

function formatMonthYearFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${pad2Date(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function getYearFromIsoDate(isoDate) {
  if (typeof isoDate !== "string" || isoDate.length < 4) return NaN;
  return Number(isoDate.slice(0, 4));
}

function eachIsoDateInRange(fromIso, toIso) {
  const startDate = fromIsoDate(fromIso);
  const endDate = fromIsoDate(toIso);

  if (!startDate || !endDate || startDate > endDate) return [];

  const result = [];
  let cursor = cloneDate(startDate);

  while (cursor && cursor <= endDate) {
    result.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}
