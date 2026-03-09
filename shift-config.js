const SHIFT_CONFIG = {
  minWorkMinutes: 180,

  earlyShifts: [
    { code: "F3", label: "F3", start: "09:00", end: "12:00", breakMinutes: 0 },
    { code: "F4", label: "F4", start: "09:00", end: "13:00", breakMinutes: 0 },
    { code: "F5", label: "F5", start: "09:00", end: "14:00", breakMinutes: 0 },
    { code: "F6", label: "F6", start: "09:00", end: "15:00", breakMinutes: 0 }
  ],

  lateShift: {
    possibleStarts: ["13:00", "14:00", "15:00", "16:00"],
    endWithoutCheckout: "19:00",
    endWithCheckout: "19:10",
    extraBreakMinutesWithCheckout: 10
  },

  fullShift: {
    start: "09:00",
    endWithoutCheckout: "19:00",
    endWithCheckout: "19:10",
    baseBreakMinutes: 60,
    extraBreakMinutesWithCheckout: 10
  },

  flexibleShift: {
    label: "Flex",
    extraBreakThresholdMinutes: 360,
    extraBreakMinutes: 60
  },

  statusOptions: [
    { value: "", label: "—", type: "off" },
    { value: "F3", label: "F3", type: "shift" },
    { value: "F4", label: "F4", type: "shift" },
    { value: "F5", label: "F5", type: "shift" },
    { value: "F6", label: "F6", type: "shift" },
    { value: "L", label: "L", type: "shift" },
    { value: "G", label: "G", type: "shift" },
    { value: "FLEX", label: "Flex", type: "shift" },
    { value: "U", label: "U", type: "vacation" },
    { value: "K", label: "K", type: "sick" },
    { value: "AH", label: "AH", type: "external-help" }
  ]
};
