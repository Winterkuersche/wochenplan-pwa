function findEarlyShiftByCode(code) {
  const normalizedCode = normalizeShiftCode(code);
  if (!["FO", "F3", "F4", "F5", "F6"].includes(normalizedCode)) return null;
  return getShiftRule(normalizedCode);
}

function getLateShiftCodeFromStart(startHHMM) {
  const startMinutes = hhmmToMinutes(startHHMM);
  const endMinutes = hhmmToMinutes("19:00");
  const workedMinutes = endMinutes - startMinutes;
  const workedHours = Math.round(workedMinutes / 60);

  return `L${workedHours}`;
}

function resolvePolicyTime(policy, userInput, fieldName) {
  if (!policy) return "";

  if (policy.type === "fixed") {
    return normalizePlanTime(policy.value);
  }

  if (policy.type === "checkout") {
    const useCheckout = Boolean(userInput.withCheckout);
    return useCheckout
      ? normalizePlanTime(policy.withCheckout)
      : normalizePlanTime(policy.withoutCheckout);
  }

  if (policy.type === "select" || policy.type === "user-input") {
    return normalizePlanTime(userInput[fieldName] || "");
  }

  return "";
}

function resolvePolicyBreakMinutes(rule, startHHMM, endHHMM, userInput) {
  const breakPolicy = rule?.breakPolicy || { type: "none" };

  if (breakPolicy.type === "fixed") {
    return normalizePlanBreakMinutes(breakPolicy.minutes || 0);
  }

  if (breakPolicy.type === "fixedByCheckout") {
    const configuredMinutes = Boolean(userInput.withCheckout)
      ? breakPolicy.byCheckout?.yes
      : breakPolicy.byCheckout?.no;
    return normalizePlanBreakMinutes(configuredMinutes || 0);
  }

  if (breakPolicy.type === "external-help") {
    return getExternalHelpBreakDeductionMinutes(startHHMM, endHHMM);
  }

  if (breakPolicy.type === "effective") {
    const configuredMinutes = typeof breakPolicy.configuredBreakByCheckout === "object"
      ? (Boolean(userInput.withCheckout)
        ? breakPolicy.configuredBreakByCheckout?.yes
        : breakPolicy.configuredBreakByCheckout?.no)
      : breakPolicy.configuredBreak;

    return getEffectiveBreakMinutes(startHHMM, endHHMM, configuredMinutes || 0, {
      includeBillingBonus: Boolean(userInput.withCheckout) && Boolean(breakPolicy.includeBillingBonusOnCheckout)
    });
  }

  return 0;
}

function buildShiftEntryFromRule(rule, userInput = {}, context = {}) {
  if (!rule) return null;

  const startHHMM = resolvePolicyTime(rule.startPolicy, userInput, "start");
  const endHHMM = resolvePolicyTime(rule.endPolicy, userInput, "end");

  if (["shift", "external-help"].includes(rule.entryType)) {
    if (!startHHMM || !endHHMM) return null;
    if (!isAllowedPlanTime(startHHMM) || !isAllowedPlanTime(endHHMM)) return null;

    const spanMinutes = diffMinutesBetweenHHMM(startHHMM, endHHMM);
    if (spanMinutes <= 0) return null;

    const breakMinutes = resolvePolicyBreakMinutes(rule, startHHMM, endHHMM, userInput);
    if (breakMinutes >= spanMinutes) return null;

    const workedMinutes = rule.entryType === "external-help"
      ? getExternalHelpWorkedMinutes(startHHMM, endHHMM)
      : getWorkedMinutesFromRange(startHHMM, endHHMM, breakMinutes);

    if (rule.code === "FLEX" && workedMinutes < (rule.uiPolicy?.minWorkMinutes || 0)) {
      return null;
    }

    const baseEntry = {
      type: rule.entryType,
      status: rule.entryType === "external-help" ? ENTRY_STATUS.EXTERNAL : ENTRY_STATUS.WORK,
      mode: rule.code === "L"
        ? "late"
        : rule.code === "G"
          ? "full"
          : rule.code === "FLEX"
            ? "flex"
            : "early",
      shiftType: rule.code === "L"
        ? "late"
        : rule.code === "G"
          ? "full"
          : rule.code === "FLEX"
            ? "flex"
            : "early",
      code: rule.code,
      shiftKey: rule.code,
      label: rule.code === "FLEX"
        ? `${startHHMM}-${endHHMM}`
        : (rule.label || rule.code),
      start: startHHMM,
      end: endHHMM,
      pause: breakMinutes,
      breakMinutes,
      note: "",
      minutes: workedMinutes,
      withCheckout: Boolean(userInput.withCheckout)
    };

    if (rule.code === "L") {
      baseEntry.label = getLateShiftCodeFromStart(startHHMM);
      baseEntry.code = baseEntry.label;
      baseEntry.shiftKey = baseEntry.label;
    }

    if (rule.entryType === "external-help") {
      baseEntry.label = "AH";
      baseEntry.externalHelp = true;
      baseEntry.branch = (userInput.branch || context.branch || "").trim();
      baseEntry.mode = "external-help";
      baseEntry.shiftType = "external-help";
      baseEntry.code = "AH";
      baseEntry.shiftKey = "AH";
    }

    return baseEntry;
  }

  return null;
}

function buildEarlyShiftEntry(code) {
  const shiftRule = findEarlyShiftByCode(code);
  if (!shiftRule) return null;

  const normalizedCode = normalizeShiftCode(code);
  if (normalizedCode === "FO") {
    return buildShiftEntryFromRule(shiftRule, { end: "12:00", withCheckout: false });
  }

  return buildShiftEntryFromRule(shiftRule, {});
}

function buildLateShiftEntry(startHHMM, withCheckout) {
  const shiftRule = getShiftRule("L");
  return buildShiftEntryFromRule(shiftRule, {
    start: startHHMM,
    withCheckout: Boolean(withCheckout)
  });
}

function buildFullShiftEntry(withCheckout) {
  const shiftRule = getShiftRule("G");
  return buildShiftEntryFromRule(shiftRule, { withCheckout: Boolean(withCheckout) });
}

function buildFlexibleShiftEntry(startHHMM, endHHMM) {
  const shiftRule = getShiftRule("FLEX");
  return buildShiftEntryFromRule(shiftRule, {
    start: startHHMM,
    end: endHHMM
  });
}

function buildFoShiftEntry(endHHMM) {
  const shiftRule = getShiftRule("FO");
  const normalizedEnd = normalizePlanTime(endHHMM);
  return buildShiftEntryFromRule(shiftRule, {
    end: normalizedEnd,
    withCheckout: normalizedEnd === "19:10"
  });
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
