function findEarlyShiftByCode(code) {
  return SHIFT_CONFIG.earlyShifts.find((shift) => shift.code === code) || null;
}

function getLateShiftCodeFromStart(startHHMM) {
  const startMinutes = hhmmToMinutes(startHHMM);
  const endMinutes = hhmmToMinutes(SHIFT_CONFIG.lateShift.endWithoutCheckout);
  const workedMinutes = endMinutes - startMinutes;
  const workedHours = Math.round(workedMinutes / 60);

  return `L${workedHours}`;
}

function buildEarlyShiftEntry(code) {
  const shift = findEarlyShiftByCode(code);
  if (!shift) return null;

  const breakMinutes = getEffectiveBreakMinutes(shift.start, shift.end, shift.breakMinutes, {
    includeBillingBonus: shift.end === "19:10"
  });
  const workedMinutes = getWorkedMinutesFromRange(
    shift.start,
    shift.end,
    breakMinutes
  );

  return {
    type: "shift",
    status: "shift",
    mode: "early",
    shiftType: "early",
    code: shift.code,
    shiftKey: shift.code,
    label: shift.label,
    start: shift.start,
    end: shift.end,
    pause: breakMinutes,
    breakMinutes,
    note: "",
    minutes: workedMinutes
  };
}

function buildLateShiftEntry(startHHMM, withCheckout) {
  if (!SHIFT_CONFIG.lateShift.possibleStarts.includes(startHHMM)) {
    return null;
  }

  const endHHMM = withCheckout
    ? SHIFT_CONFIG.lateShift.endWithCheckout
    : SHIFT_CONFIG.lateShift.endWithoutCheckout;

  const configuredBreakMinutes = withCheckout
    ? SHIFT_CONFIG.lateShift.extraBreakMinutesWithCheckout
    : 0;
  const breakMinutes = getEffectiveBreakMinutes(startHHMM, endHHMM, configuredBreakMinutes, {
    includeBillingBonus: withCheckout
  });

  const workedMinutes = getWorkedMinutesFromRange(startHHMM, endHHMM, breakMinutes);
  const code = getLateShiftCodeFromStart(startHHMM);

  return {
    type: "shift",
    status: "shift",
    mode: "late",
    shiftType: "late",
    code,
    shiftKey: code,
    label: code,
    start: startHHMM,
    end: endHHMM,
    pause: breakMinutes,
    breakMinutes,
    note: "",
    withCheckout: !!withCheckout,
    minutes: workedMinutes
  };
}

function buildFullShiftEntry(withCheckout) {
  const startHHMM = SHIFT_CONFIG.fullShift.start;
  const endHHMM = withCheckout
    ? SHIFT_CONFIG.fullShift.endWithCheckout
    : SHIFT_CONFIG.fullShift.endWithoutCheckout;

  const breakMinutes = SHIFT_CONFIG.fullShift.baseBreakMinutes +
    (withCheckout ? SHIFT_CONFIG.fullShift.extraBreakMinutesWithCheckout : 0);

  const workedMinutes = getWorkedMinutesFromRange(startHHMM, endHHMM, breakMinutes);

  return {
    type: "shift",
    status: "shift",
    mode: "full",
    shiftType: "full",
    code: "G",
    shiftKey: "G",
    label: "G",
    start: startHHMM,
    end: endHHMM,
    pause: breakMinutes,
    breakMinutes,
    note: "",
    withCheckout: !!withCheckout,
    minutes: workedMinutes
  };
}

function buildFlexibleShiftEntry(startHHMM, endHHMM) {
  const normalizedStart = normalizePlanTime(startHHMM);
  const normalizedEnd = normalizePlanTime(endHHMM);

  if (!normalizedStart || !normalizedEnd) {
    return null;
  }

  if (!isAllowedPlanTime(normalizedStart) || !isAllowedPlanTime(normalizedEnd)) {
    return null;
  }

  const totalSpanMinutes = diffMinutesBetweenHHMM(normalizedStart, normalizedEnd);
  if (totalSpanMinutes <= 0) return null;

  const breakMinutes = getBreakMinutesForFlexibleShift(normalizedStart, normalizedEnd);
  const workedMinutes = getWorkedMinutesFromRange(normalizedStart, normalizedEnd, breakMinutes);

  if (workedMinutes < SHIFT_CONFIG.minWorkMinutes) {
    return null;
  }

  return {
    type: "shift",
    status: "shift",
    mode: "flex",
    shiftType: "flex",
    code: "FLEX",
    shiftKey: "FLEX",
    label: `${normalizedStart}-${normalizedEnd}`,
    start: normalizedStart,
    end: normalizedEnd,
    pause: breakMinutes,
    breakMinutes,
    note: "",
    minutes: workedMinutes
  };
}

function buildFoShiftEntry(endHHMM) {
  const startHHMM = "08:55";
  const normalizedEnd = normalizePlanTime(endHHMM);
  if (!normalizedEnd || !isAllowedPlanTime(normalizedEnd)) return null;

  const spanMinutes = diffMinutesBetweenHHMM(startHHMM, normalizedEnd);
  if (spanMinutes <= 0) return null;

  const includeBillingBonus = normalizedEnd === "19:10";
  const configuredBreakMinutes = 5;
  const breakMinutes = getEffectiveBreakMinutes(startHHMM, normalizedEnd, configuredBreakMinutes, {
    includeBillingBonus
  });
  if (breakMinutes >= spanMinutes) return null;

  const workedMinutes = getWorkedMinutesFromRange(startHHMM, normalizedEnd, breakMinutes);

  return {
    type: "shift",
    status: "shift",
    mode: "early",
    shiftType: "early",
    code: "FO",
    shiftKey: "FO",
    label: "FÖ",
    start: startHHMM,
    end: normalizedEnd,
    pause: breakMinutes,
    breakMinutes,
    note: "",
    withCheckout: includeBillingBonus,
    minutes: workedMinutes
  };
}

function isShiftEntry(value) {
  return !!value && value.type === "shift";
}

function getShiftDisplayLabel(entry) {
  if (!isShiftEntry(entry)) return "";

  if (entry.mode === "flex") {
    return entry.label || `${entry.start}-${entry.end}`;
  }

  return entry.label || entry.code || "";
}

function getShiftWorkedHHMM(entry) {
  if (!isShiftEntry(entry)) return "00:00";
  return minutesToHHMM(entry.minutes || 0);
}
