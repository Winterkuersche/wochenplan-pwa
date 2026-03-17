function hhmmToMinutes(value) {
  if (typeof value !== "string") return 0;

  const trimmed = value.trim();
  if (!trimmed) return 0;

  const parts = trimmed.split(":");
  if (parts.length !== 2) return 0;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  if (hours < 0 || minutes < 0 || minutes > 59) return 0;

  return hours * 60 + minutes;
}

const QUARTER_HOUR_STEP_MINUTES = 15;
const PLAN_TIME_EXCEPTIONS = new Set(["19:10"]);
const PLAN_BREAK_MINUTE_EXCEPTIONS = new Set([10]);

function parseTimeToMinutes(value) {
  return hhmmToMinutes(value);
}

function minutesToHHMM(totalMinutes) {
  const safeMinutes = Number(totalMinutes);
  if (Number.isNaN(safeMinutes)) return "00:00";

  const sign = safeMinutes < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(safeMinutes));
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;

  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function diffMinutesBetweenHHMM(startHHMM, endHHMM) {
  const startMinutes = hhmmToMinutes(startHHMM);
  const endMinutes = hhmmToMinutes(endHHMM);
  return endMinutes - startMinutes;
}

function addMinutesToHHMM(hhmm, minutesToAdd) {
  const baseMinutes = hhmmToMinutes(hhmm);
  const resultMinutes = baseMinutes + Number(minutesToAdd || 0);
  return minutesToHHMM(resultMinutes);
}

function isValidHHMM(value) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return false;

  const [hoursText, minutesText] = trimmed.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;

  return true;
}

function isQuarterHourTime(value) {
  if (!isValidHHMM(value)) return false;
  return parseTimeToMinutes(value) % QUARTER_HOUR_STEP_MINUTES === 0;
}

function isAllowedPlanTime(value) {
  if (!isValidHHMM(value)) return false;
  const normalized = minutesToHHMM(parseTimeToMinutes(value));
  return isQuarterHourTime(normalized) || PLAN_TIME_EXCEPTIONS.has(normalized);
}

function normalizeTimeToQuarterHour(value) {
  if (!isValidHHMM(value)) return "";

  const totalMinutes = parseTimeToMinutes(value);
  const roundedMinutes = Math.round(totalMinutes / QUARTER_HOUR_STEP_MINUTES) * QUARTER_HOUR_STEP_MINUTES;

  return minutesToHHMM(roundedMinutes);
}

function normalizePlanTime(value) {
  if (!isValidHHMM(value)) return "";

  const normalized = minutesToHHMM(parseTimeToMinutes(value));
  if (PLAN_TIME_EXCEPTIONS.has(normalized)) return normalized;

  return normalizeTimeToQuarterHour(normalized);
}

function formatQuarterHourTime(value) {
  if (typeof value === "number") {
    const safeMinutes = Math.max(0, value);
    const roundedMinutes = Math.round(safeMinutes / QUARTER_HOUR_STEP_MINUTES) * QUARTER_HOUR_STEP_MINUTES;
    return minutesToHHMM(roundedMinutes);
  }

  return normalizeTimeToQuarterHour(value);
}

function normalizeMinutesToQuarterHour(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;

  const safeMinutes = Math.max(0, numeric);
  return Math.round(safeMinutes / QUARTER_HOUR_STEP_MINUTES) * QUARTER_HOUR_STEP_MINUTES;
}

function normalizePlanBreakMinutes(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;

  const safeMinutes = Math.max(0, Math.round(numeric));
  if (PLAN_BREAK_MINUTE_EXCEPTIONS.has(safeMinutes)) return safeMinutes;

  return normalizeMinutesToQuarterHour(safeMinutes);
}

function clampMinutes(value, minValue, maxValue) {
  return Math.min(Math.max(value, minValue), maxValue);
}

function getDailyTargetMinutesFromWeeklyHHMM(weeklyTargetHHMM) {
  const weeklyMinutes = hhmmToMinutes(weeklyTargetHHMM);
  return Math.round(weeklyMinutes / 6);
}

function getBreakMinutesForFlexibleShift(startHHMM, endHHMM) {
  const totalSpanMinutes = diffMinutesBetweenHHMM(startHHMM, endHHMM);

  if (totalSpanMinutes > SHIFT_CONFIG.flexibleShift.extraBreakThresholdMinutes) {
    return SHIFT_CONFIG.flexibleShift.extraBreakMinutes;
  }

  return 0;
}

function getWorkedMinutesFromRange(startHHMM, endHHMM, breakMinutes = 0) {
  const totalSpanMinutes = diffMinutesBetweenHHMM(startHHMM, endHHMM);
  return Math.max(0, totalSpanMinutes - Number(breakMinutes || 0));
}

function getPauseRangeForMep(entry) {
  if (!entry || !entry.start || !entry.end) return "";

  const startMinutes = hhmmToMinutes(entry.start);
  const endMinutes = hhmmToMinutes(entry.end);
  const spanMinutes = endMinutes - startMinutes;

  if (spanMinutes <= 6 * 60) return "";

  const mepLateShiftCutoff = hhmmToMinutes("19:10");
  const endsByLateCutoff = endMinutes <= mepLateShiftCutoff;
  const configuredBreak = Number(entry.pause ?? entry.breakMinutes ?? 0);
  const pauseMinutes = endsByLateCutoff
    ? 10
    : (configuredBreak > 0 ? configuredBreak : 10);

  const preferredStart = startMinutes + Math.floor((spanMinutes - pauseMinutes) / 2);

  const latestStart = endMinutes - pauseMinutes;
  const latestStartOutsideLastHour = endMinutes - 60 - pauseMinutes;
  const latestPreferredStart = latestStartOutsideLastHour >= startMinutes
    ? Math.min(latestStart, latestStartOutsideLastHour)
    : latestStart;
  const pauseStart = clampMinutes(preferredStart, startMinutes, latestPreferredStart);
  const pauseEnd = pauseStart + pauseMinutes;

  return `${minutesToHHMM(pauseStart)}-${minutesToHHMM(pauseEnd)}`;
}
