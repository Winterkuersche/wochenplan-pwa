const MONTH_WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function padMonthEngine(value) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${padMonthEngine(date.getMonth() + 1)}-${padMonthEngine(date.getDate())}`;
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getMondayBasedDayIndex(date) {
  // JS: So=0, Mo=1, ... Sa=6
  // Gewünscht: Mo=0, Di=1, ... So=6
  return (date.getDay() + 6) % 7;
}

function getStartOfVisibleMonthGrid(year, monthIndex) {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const mondayIndex = getMondayBasedDayIndex(firstOfMonth);
  const gridStart = cloneDate(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - mondayIndex);
  return gridStart;
}

function getEndOfVisibleMonthGrid(year, monthIndex) {
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const mondayIndex = getMondayBasedDayIndex(lastOfMonth);
  const daysUntilSunday = 6 - mondayIndex;
  const gridEnd = cloneDate(lastOfMonth);
  gridEnd.setDate(lastOfMonth.getDate() + daysUntilSunday);
  return gridEnd;
}

function buildMonthDayObject(date, targetYear, targetMonthIndex) {
  const monthIndex = date.getMonth();
  const weekdayIndex = getMondayBasedDayIndex(date);

  return {
    date: cloneDate(date),
    iso: toIsoDate(date),
    year: date.getFullYear(),
    monthIndex,
    month: monthIndex + 1,
    day: date.getDate(),
    weekdayIndex,
    weekdayLabel: MONTH_WEEKDAY_LABELS[weekdayIndex],
    inCurrentMonth: date.getFullYear() === targetYear && monthIndex === targetMonthIndex,
    isOutsideMonth: !(date.getFullYear() === targetYear && monthIndex === targetMonthIndex),
  };
}

function buildMonthWeeks(year, monthIndex) {
  const gridStart = getStartOfVisibleMonthGrid(year, monthIndex);
  const gridEnd = getEndOfVisibleMonthGrid(year, monthIndex);
  const weeks = [];

  let cursor = cloneDate(gridStart);

  while (cursor <= gridEnd) {
    const week = [];

    for (let i = 0; i < 7; i++) {
      week.push(buildMonthDayObject(cursor, year, monthIndex));
      const next = cloneDate(cursor);
      next.setDate(cursor.getDate() + 1);
      cursor = next;
    }

    weeks.push(week);
  }

  return weeks;
}

function getMonthMeta(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  return {
    year,
    monthIndex,
    month: monthIndex + 1,
    monthLabel: `${padMonthEngine(monthIndex + 1)}.${year}`,
    firstOfMonth: cloneDate(firstDay),
    lastOfMonth: cloneDate(lastDay),
    firstOfMonthIso: toIsoDate(firstDay),
    lastOfMonthIso: toIsoDate(lastDay),
  };
}

function buildMonthPlan(year, monthIndex) {
  return {
    meta: getMonthMeta(year, monthIndex),
    weeks: buildMonthWeeks(year, monthIndex),
  };
}

function getMonthPlanFromDateString(isoDateString) {
  if (!isoDateString) return null;

  const date = new Date(isoDateString);
  if (Number.isNaN(date.getTime())) return null;

  return buildMonthPlan(date.getFullYear(), date.getMonth());
}
