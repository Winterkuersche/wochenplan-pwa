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
