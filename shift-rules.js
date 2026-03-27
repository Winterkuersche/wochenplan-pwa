const SHIFT_CODES_FREEZE = Object.freeze(["F3", "F4", "F5", "F6", "L", "G", "FLEX", "AH", "U", "K", "FÖ"]);
const ENTRY_FIELDS_FREEZE = Object.freeze(["type", "mode", "code", "start", "end", "pause", "minutes"]);

const SHIFT_RULES = Object.freeze({
  FO: {
    code: "FO",
    aliases: ["FÖ"],
    label: "FÖ",
    entryType: "shift",
    startPolicy: { type: "fixed", value: "08:55" },
    endPolicy: {
      type: "select",
      options: (() => {
        const values = [];
        let current = hhmmToMinutes("12:00");
        const max = hhmmToMinutes("19:00");

        while (current <= max) {
          values.push(minutesToHHMM(current));
          current += 15;
        }

        values.push("19:10");
        return values;
      })(),
      checkoutValue: "19:10"
    },
    breakPolicy: { type: "effective", configuredBreak: 5, includeBillingBonusOnCheckout: true },
    uiPolicy: {
      dialogRequired: true,
      dialogType: "FO",
      startReadOnly: true,
      startDefault: "08:55"
    }
  },
  F3: {
    code: "F3",
    label: "F3",
    entryType: "shift",
    startPolicy: { type: "fixed", value: "09:00" },
    endPolicy: { type: "fixed", value: "12:00" },
    breakPolicy: { type: "fixed", minutes: 0 },
    uiPolicy: { dialogRequired: false }
  },
  F4: {
    code: "F4",
    label: "F4",
    entryType: "shift",
    startPolicy: { type: "fixed", value: "09:00" },
    endPolicy: { type: "fixed", value: "13:00" },
    breakPolicy: { type: "fixed", minutes: 0 },
    uiPolicy: { dialogRequired: false }
  },
  F5: {
    code: "F5",
    label: "F5",
    entryType: "shift",
    startPolicy: { type: "fixed", value: "09:00" },
    endPolicy: { type: "fixed", value: "14:00" },
    breakPolicy: { type: "fixed", minutes: 0 },
    uiPolicy: { dialogRequired: false }
  },
  F6: {
    code: "F6",
    label: "F6",
    entryType: "shift",
    startPolicy: { type: "fixed", value: "09:00" },
    endPolicy: { type: "fixed", value: "15:00" },
    breakPolicy: { type: "fixed", minutes: 0 },
    uiPolicy: { dialogRequired: false }
  },
  L: {
    code: "L",
    label: "L",
    entryType: "shift",
    startPolicy: { type: "select", options: ["13:00", "14:00", "15:00", "16:00"], defaultValue: "13:00" },
    endPolicy: { type: "checkout", withoutCheckout: "19:00", withCheckout: "19:10", defaultCheckout: true },
    breakPolicy: { type: "effective", configuredBreakByCheckout: { yes: 10, no: 0 }, includeBillingBonusOnCheckout: true },
    uiPolicy: { dialogRequired: true, dialogType: "L" }
  },
  G: {
    code: "G",
    label: "G",
    entryType: "shift",
    startPolicy: { type: "fixed", value: "09:00" },
    endPolicy: { type: "checkout", withoutCheckout: "19:00", withCheckout: "19:10", defaultCheckout: true },
    breakPolicy: { type: "fixedByCheckout", byCheckout: { yes: 70, no: 60 } },
    uiPolicy: { dialogRequired: true, dialogType: "G" }
  },
  FLEX: {
    code: "FLEX",
    label: "Flex",
    entryType: "shift",
    startPolicy: { type: "user-input" },
    endPolicy: { type: "user-input" },
    breakPolicy: { type: "effective", configuredBreak: 0 },
    uiPolicy: { dialogRequired: true, dialogType: "FLEX", minWorkMinutes: 180 }
  },
  AH: {
    code: "AH",
    label: "AH",
    entryType: "external-help",
    startPolicy: { type: "user-input" },
    endPolicy: { type: "user-input" },
    breakPolicy: { type: "external-help" },
    uiPolicy: { dialogRequired: true, dialogType: "AH" }
  },
  U: {
    code: "U",
    label: "U",
    entryType: "vacation",
    startPolicy: { type: "none" },
    endPolicy: { type: "none" },
    breakPolicy: { type: "none" },
    uiPolicy: { dialogRequired: true, dialogType: "U" }
  },
  K: {
    code: "K",
    label: "K",
    entryType: "sick",
    startPolicy: { type: "none" },
    endPolicy: { type: "none" },
    breakPolicy: { type: "none" },
    uiPolicy: { dialogRequired: true, dialogType: "K" }
  }
});

const SHIFT_OPTION_GROUPS = Object.freeze([
  { value: "-", label: "-", group: "shift", type: "off" },
  { value: "FO", label: "FÖ", group: "shift", type: "shift" },
  { value: "F3", label: "F3", group: "shift", type: "shift" },
  { value: "F4", label: "F4", group: "shift", type: "shift" },
  { value: "F5", label: "F5", group: "shift", type: "shift" },
  { value: "F6", label: "F6", group: "shift", type: "shift" },
  { value: "L", label: "L", group: "shift", type: "shift" },
  { value: "G", label: "G", group: "shift", type: "shift" },
  { value: "FLEX", label: "Flex", group: "shift", type: "shift" },
  { value: "U", label: "U", group: "special", type: "vacation" },
  { value: "K", label: "K", group: "special", type: "sick" },
  { value: "AH", label: "AH", group: "special", type: "external-help" }
]);

function normalizeShiftCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return "";

  if (normalized === "FÖ") return "FO";
  if (/^L[1-4](E)?$/.test(normalized)) return "L";
  if (normalized === "G1") return "G";

  return normalized;
}

function getShiftRule(code) {
  const normalized = normalizeShiftCode(code);
  if (!normalized) return null;
  return SHIFT_RULES[normalized] || null;
}

function listShiftOptions() {
  return SHIFT_OPTION_GROUPS.map((option) => ({ ...option }));
}

function isDialogShift(code) {
  const rule = getShiftRule(code);
  return Boolean(rule?.uiPolicy?.dialogRequired);
}
