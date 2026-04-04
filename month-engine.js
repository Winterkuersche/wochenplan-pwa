const MONTH_WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

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
    monthLabel: `${pad2(monthIndex + 1)}.${year}`,
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

  const date = fromIsoDate(isoDateString);
  if (!date) return null;

  return buildMonthPlan(date.getFullYear(), date.getMonth());
}

function getMonthPlanFromYearMonth(yearMonth) {
  if (typeof yearMonth !== "string") return null;
  const normalized = yearMonth.trim().match(/^(\d{4})-(\d{2})$/);
  if (!normalized) return null;

  const month = Number(normalized[2]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;

  return getMonthPlanFromDateString(`${normalized[1]}-${normalized[2]}-01`);
}

function getMonthTitleFromDays(days = []) {
  if (!Array.isArray(days) || !days.length) return "Monat";
  const firstDate = days[0]?.date;
  if (!(firstDate instanceof Date)) return "Monat";
  return `${MONTH_NAMES[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
}

function getMonthCellClass(resolved, day) {
  const classes = ["monthCell"];
  const status = getResolvedStatus(resolved);

  if (day?.weekdayIndex === 6) classes.push("monthCellSunday");
  if (resolved?.type === "holiday") classes.push("monthCellHoliday");
  if (status === ENTRY_STATUS.VACATION) classes.push("monthCellVacation");
  if (status === ENTRY_STATUS.SICK) classes.push("monthCellSick");
  if (status === ENTRY_STATUS.EXTERNAL) classes.push("monthCellExternalHelp");
  if (status === ENTRY_STATUS.WORK) classes.push("monthCellShift");

  return classes.join(" ");
}

function getMonthCellText(resolved, options = {}) {
  const { formatQuarterLabel = (value) => value } = options;
  const status = getResolvedStatus(resolved);
  let cellText = resolved?.label || "";

  if (status === ENTRY_STATUS.WORK) {
    const entry = resolved?.sourceEntry || resolved || {};
    if (entry.start && entry.end) {
      if (entry.mode === "flex") {
        cellText = `${formatQuarterLabel(entry.start)}-${formatQuarterLabel(entry.end)}`;
      } else {
        cellText = `${entry.start}-${entry.end}`;
      }
    } else if (entry.code) {
      cellText = entry.code;
    }
  } else if ([ENTRY_STATUS.VACATION, ENTRY_STATUS.SICK, ENTRY_STATUS.EXTERNAL].includes(status)) {
    cellText = getStatusShortLabel(status);
  }

  return cellText;
}

function getMonthDialogTypeForResolvedEntry(resolved) {
  if (!resolved || typeof resolved !== "object") return null;
  if (resolved.type === "holiday") return null;
  if (resolved.type === "vacation") return "U";
  if (resolved.type === "sick") return "K";
  if (resolved.type === "external-help") return "AH";

  if (resolved.type === "shift" && resolved.sourceEntry) {
    const mode = resolved.sourceEntry.mode;
    if (mode === "late") return "L";
    if (mode === "full") return "G";
    if (mode === "flex") return "FLEX";
  }

  return null;
}
