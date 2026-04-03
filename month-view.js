function getMonthViewContentEl() {
  return document.getElementById("monthViewContent");
}

const MONTH_FALLBACK_ALLOWED_CODES = ["G", "U", "K", "AH", "FLEX"];
const MONTH_FALLBACK_DEFAULT_OPTIONS = [
  { code: "G", label: "Ganztag (G)" },
  { code: "U", label: "Urlaub (U)" },
  { code: "K", label: "Krank (K)" },
  { code: "AH", label: "Aushilfe (AH)" },
  { code: "FLEX", label: "Flexible Schicht (FLEX)" }
];
const monthFallbackOverlayEl = document.getElementById("monthFallbackOverlay");
const monthFallbackOptionsEl = document.getElementById("monthFallbackOptions");
const monthFallbackCancelEl = document.getElementById("monthFallbackCancel");
let monthFallbackDialogState = null;

function setMonthFallbackBodyScrollLock(isLocked) {
  const body = document.body;
  if (!body?.style) return;

  if (isLocked) {
    if (!body.dataset.monthFallbackPrevOverflow) {
      body.dataset.monthFallbackPrevOverflow = body.style.overflow || "";
    }
    body.style.overflow = "hidden";
    return;
  }

  if (Object.prototype.hasOwnProperty.call(body.dataset, "monthFallbackPrevOverflow")) {
    body.style.overflow = body.dataset.monthFallbackPrevOverflow;
    delete body.dataset.monthFallbackPrevOverflow;
  }
}

function getActiveMonthDays() {
  const monthPlan = state.monthPlan;
  if (!monthPlan?.weeks) return [];

  const days = [];
  monthPlan.weeks.forEach((week) => {
    week.forEach((day) => {
      if (day.inCurrentMonth) {
        days.push(day);
      }
    });
  });

  return days;
}

function getMonthTitleFromDays(days) {
  if (!days.length) return "Monat";

  const firstDate = days[0].date;
  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  return `${monthNames[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
}

function getMonthCellClass(resolved, day) {
  const classes = ["monthCell"];
  const status = getResolvedStatus(resolved);

  if (day.weekdayIndex === 6) classes.push("monthCellSunday");
  if (resolved.type === "holiday") classes.push("monthCellHoliday");
  if (status === ENTRY_STATUS.VACATION) classes.push("monthCellVacation");
  if (status === ENTRY_STATUS.SICK) classes.push("monthCellSick");
  if (status === ENTRY_STATUS.EXTERNAL) classes.push("monthCellExternalHelp");
  if (status === ENTRY_STATUS.WORK) classes.push("monthCellShift");

  return classes.join(" ");
}

function buildMonthHeaderRow(days, options = {}) {
  const { includeSummaryColumns = true } = options;
  let html = `
    <tr>
      <th>Name</th>
  `;

  days.forEach((day) => {
    const isSunday = day.weekdayIndex === 6;
    const className = isSunday ? ` class="monthHeadSunday"` : "";
    html += `<th${className}>${pad2(day.date.getDate())}<br>${day.weekdayLabel}</th>`;
  });

  if (includeSummaryColumns) {
    html += `
      <th>Monat Ist</th>
      <th>Δ Monat</th>
      <th>Gesamtminus</th>
    `;
  }

  html += `
    </tr>
  `;

  return html;
}

function buildMonthEmployeeRow(emp, days, options = {}) {
  const { includeSummaryColumns = true } = options;
  let html = `
    <tr>
      <td class="nameRoleCell">
        <div class="nameRoleName">${emp.name || "—"}</div>
        <div class="nameRoleSub">${emp.roleKey || "-"}</div>
      </td>
  `;

  let monthMinutes = 0;

  days.forEach((day) => {
    const resolved = getResolvedEntryForEmployeeOnIso(emp, day.iso);
    const className = getMonthCellClass(resolved, day);

    monthMinutes += resolved.minutesForMonth || 0;

    let cellText = resolved.label || "";
    const status = getResolvedStatus(resolved);

if (status === ENTRY_STATUS.WORK) {
  const entry = resolved.sourceEntry || resolved;

  if (entry.start && entry.end) {
    if (entry.mode === "flex") {
      cellText = `${formatHMToQuarterLabel(entry.start)}-${formatHMToQuarterLabel(entry.end)}`;
    } else {
      cellText = `${entry.start}-${entry.end}`;
    }
  } else if (entry.code) {
    cellText = entry.code;
  }
} else if (status === ENTRY_STATUS.VACATION || status === ENTRY_STATUS.SICK || status === ENTRY_STATUS.EXTERNAL) {
  cellText = getStatusShortLabel(status);
}
   html += `
  <td
    class="${className} monthCellClickable"
    data-emp-id="${emp.id}"
    data-iso="${day.iso}"
    title="Klicken zum Bearbeiten"
  >
    ${cellText}
  </td>
`;
  });

  if (includeSummaryColumns) {
    const monthIsManual = isMonthActualManual(emp, state.activeMonth);
    const manualMarker = monthIsManual
      ? '<span class="manualMonthMarker" aria-label="Monats-Ist manuell" title="Monats-Iststunden manuell hinterlegt.">•</span>'
      : "";
    const monthDisplayMinutes = getEffectiveMonthActualMinutes(emp, state.activeMonth, monthMinutes);
    const monthDifferenceMinutes = getEmployeeMonthDifferenceMinutes(emp);
    const totalMinusMinutes = getEmployeeTotalMinusMinutes(emp);
    const monthDeltaTitle = monthIsManual
      ? "Delta des Monats. Iststunden manuell hinterlegt."
      : "Delta des Monats.";
    const monthActualTitle = monthIsManual
      ? "Monats-Iststunden manuell hinterlegt."
      : "Monats-Iststunden planbasiert berechnet.";

    html += `
      <td class="weekHoursCell" title="${monthActualTitle}">${minutesToHM(monthDisplayMinutes)}${manualMarker}</td>
      <td class="weekDeltaCell ${monthDifferenceMinutes < 0 ? "deltaNeg" : monthDifferenceMinutes > 0 ? "deltaPos" : "deltaZero"}" title="${monthDeltaTitle}">${formatSignedMinutes(monthDifferenceMinutes)}</td>
      <td class="weekDeltaCell ${totalMinusMinutes > 0 ? "deltaNeg" : "deltaZero"}">${totalMinusMinutes > 0 ? `-${minutesToHM(totalMinusMinutes)}` : "0:00"}</td>
    `;
  }

  html += `
    </tr>
  `;

  return html;
}
function bindMonthCellActions(scopeEl = document) {
  const tables = scopeEl?.querySelectorAll?.("table")?.length
    ? [...scopeEl.querySelectorAll("table")]
    : [document.getElementById("monthTable")].filter(Boolean);
  if (!tables.length) return;

  tables.forEach((table) => {
    table.querySelectorAll(".monthCellClickable").forEach((cell) => {
      cell.addEventListener("click", () => {
      const empId = cell.dataset.empId;
      const isoDate = cell.dataset.iso;

      const emp = state.employees.find((e) => e.id === empId);
      if (!emp || !isoDate) return;

      const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);

      if (resolved.type === "holiday") return;

      if (resolved.type === "vacation") {
        openShiftDialog("U", { emp, isoDate, type: "U" });
        return;
      }

      if (resolved.type === "sick") {
        openShiftDialog("K", { emp, isoDate, type: "K" });
        return;
      }

      if (resolved.type === "external-help") {
        openShiftDialog("AH", { emp, isoDate, type: "AH" });
        return;
      }

      if (resolved.type === "shift" && resolved.sourceEntry) {
        const entry = resolved.sourceEntry;

        if (entry.mode === "late") {
          openShiftDialog("L", { emp, isoDate, type: "L" });
          return;
        }

        if (entry.mode === "full") {
          openShiftDialog("G", { emp, isoDate, type: "G" });
          return;
        }

        if (entry.mode === "flex") {
          openShiftDialog("FLEX", { emp, isoDate, type: "FLEX" });
          return;
        }
      }

      openMonthFallbackDialog(emp, isoDate);
    });
  });
  });
}

function openMonthFallbackDialog(emp, isoDate) {
  if (!monthFallbackOverlayEl || !monthFallbackOptionsEl) return;
  if (monthFallbackDialogState) closeMonthFallbackDialog();

  const options = getMonthFallbackDialogOptions();
  if (!options.length) return;

  const activeElement = document.activeElement;
  const canRestoreFocus = (
    (typeof HTMLElement !== "undefined" && activeElement instanceof HTMLElement)
    || (activeElement && typeof activeElement.focus === "function")
  );

  monthFallbackDialogState = {
    emp,
    isoDate,
    options,
    previousFocusEl: canRestoreFocus ? activeElement : null
  };

  monthFallbackOptionsEl.innerHTML = "";

  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "monthFallbackOptionBtn";
    button.textContent = option.label;
    button.setAttribute("aria-label", `${option.label} auswählen`);
    button.dataset.code = option.code;
    button.addEventListener("click", () => {
      selectMonthFallbackOption(option.code);
    });
    monthFallbackOptionsEl.appendChild(button);
  });

  monthFallbackOverlayEl.classList.remove("hidden");
  monthFallbackOverlayEl.setAttribute("aria-hidden", "false");
  setMonthFallbackBodyScrollLock(true);
  monthFallbackOptionsEl.querySelector("button")?.focus();
}

function getShiftedYearMonth(yearMonth, offset) {
  const activeMonth = yearMonth || state.activeMonth || toIsoDate(new Date()).slice(0, 7);
  const [year, month] = activeMonth.split("-").map(Number);
  const nextDate = new Date(year, month - 1 + offset, 1);

  return `${nextDate.getFullYear()}-${pad2(nextDate.getMonth() + 1)}`;
}

function shiftActiveMonth(offset) {
  state.activeMonth = getShiftedYearMonth(state.activeMonth, offset);

  // state.weekFrom bleibt bewusst unverändert: Für die aktuelle MEP-Monatsansicht
  // ist state.activeMonth die maßgebliche Quelle, und getActiveWeekDays fällt bei
  // einem Monatssprung ohnehin auf die erste sichtbare Woche des neuen Monats zurück.
  syncMonthPlanToState();
  saveAppStateDebounced();
  renderAllViews();
}

function bindMonthNavigation() {
  document.getElementById("monthPrev")?.addEventListener("click", () => {
    shiftActiveMonth(-1);
  });

  document.getElementById("monthNext")?.addEventListener("click", () => {
    shiftActiveMonth(1);
  });

  document.getElementById("overviewMonthPrev")?.addEventListener("click", () => {
    shiftActiveMonth(-1);
  });

  document.getElementById("overviewMonthNext")?.addEventListener("click", () => {
    shiftActiveMonth(1);
  });
}

function updateMonthHeaderTitle(days) {
  const titleEl = document.getElementById("monthTitle");
  if (!titleEl) return;

  titleEl.textContent = getMonthTitleFromDays(days);
}

function buildMonthViewMarkup(days, options = {}) {
  const {
    tableId = "monthTable",
    tableClass = "",
    activeEmployees = state.employees.filter((emp) => isEmployeeActiveInMonth(emp, state.activeMonth)),
    includeSummaryColumns = true,
    withViewHeader = true
  } = options;
  const tableClassAttr = tableClass ? ` class="${tableClass}"` : "";
  let html = `
  `;

  if (withViewHeader) {
    html += `
    <div class="monthViewHeader">
      <strong>${getMonthTitleFromDays(days)}</strong>
      <span class="small">${days.length} Tage im aktuellen Monat</span>
    </div>
    `;
  }

  html += `
    <table id="${tableId}"${tableClassAttr}>
      <thead>
        ${buildMonthHeaderRow(days, { includeSummaryColumns })}
      </thead>
      <tbody>
  `;

  activeEmployees.forEach((emp) => {
    html += buildMonthEmployeeRow(emp, days, { includeSummaryColumns });
  });

  html += `
      </tbody>
    </table>
  `;

  return html;
}

function renderMonthTableInto(container, options = {}) {
  if (!container) return;
  const {
    withHeaderTitle = true,
    tableId = "monthTable",
    tableClass = "",
    days = null,
    activeEmployees = null,
    includeSummaryColumns = true,
    withViewHeader = true
  } = options;

  container.innerHTML = "";

  const tableDays = Array.isArray(days) ? days : getActiveMonthDays();
  if (!tableDays.length) {
    container.innerHTML = "<div class='small'>Kein Monat geladen.</div>";
    return;
  }

  if (withHeaderTitle) updateMonthHeaderTitle(tableDays);
  container.innerHTML = buildMonthViewMarkup(tableDays, {
    tableId,
    tableClass,
    activeEmployees: Array.isArray(activeEmployees) ? activeEmployees : undefined,
    includeSummaryColumns,
    withViewHeader
  });

  bindMonthCellActions(container);
}

function renderMonthView() {
  renderMonthTableInto(getMonthViewContentEl(), {
    withHeaderTitle: true,
    tableId: "monthTable"
  });
}

function getMonthFallbackDialogOptions() {
  const allowedCodeSet = new Set(MONTH_FALLBACK_ALLOWED_CODES);
  const availableDialogOptions = typeof getShiftSelectOptions === "function"
    ? getShiftSelectOptions()
      .filter((option) => option?.isDialogShift)
      .map((option) => {
        const code = getShiftCodeForSelectValue(option.value);
        return { code, label: `${option.label} (${code})` };
      })
      .filter((option) => allowedCodeSet.has(option.code))
    : [];

  const optionPool = availableDialogOptions.length ? availableDialogOptions : MONTH_FALLBACK_DEFAULT_OPTIONS;
  return optionPool.filter((option, index, arr) => (
    arr.findIndex((entry) => entry.code === option.code) === index
  ));
}

function closeMonthFallbackDialog() {
  if (!monthFallbackOverlayEl || !monthFallbackDialogState) return;

  monthFallbackOverlayEl.classList.add("hidden");
  monthFallbackOverlayEl.setAttribute("aria-hidden", "true");
  setMonthFallbackBodyScrollLock(false);
  if (monthFallbackOptionsEl) monthFallbackOptionsEl.innerHTML = "";

  const previousFocusEl = monthFallbackDialogState.previousFocusEl;
  monthFallbackDialogState = null;
  if (previousFocusEl && typeof previousFocusEl.focus === "function") {
    previousFocusEl.focus();
  }
}

function getMonthFallbackFocusableElements() {
  const optionButtons = monthFallbackOptionsEl
    ? [...monthFallbackOptionsEl.querySelectorAll("button")]
    : [];
  return [...optionButtons, monthFallbackCancelEl].filter(Boolean);
}

function selectMonthFallbackOption(code) {
  if (!monthFallbackDialogState) return;
  const selectedCode = getShiftCodeForSelectValue(code);
  const selectedOption = monthFallbackDialogState.options.find((option) => option.code === selectedCode);
  if (!selectedOption) return;

  const { emp, isoDate } = monthFallbackDialogState;
  closeMonthFallbackDialog();
  openShiftDialog(selectedOption.code, { emp, isoDate, type: selectedOption.code });
}

function handleMonthFallbackDialogKeydown(event) {
  if (monthFallbackOverlayEl?.classList.contains("hidden")) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeMonthFallbackDialog();
    return;
  }

  if (event.key !== "Tab") return;

  const focusableEls = getMonthFallbackFocusableElements();
  if (!focusableEls.length) return;

  const firstEl = focusableEls[0];
  const lastEl = focusableEls[focusableEls.length - 1];
  const activeEl = document.activeElement;

  if (event.shiftKey) {
    if (activeEl === firstEl || !focusableEls.includes(activeEl)) {
      event.preventDefault();
      lastEl.focus();
    }
    return;
  }

  if (activeEl === lastEl || !focusableEls.includes(activeEl)) {
    event.preventDefault();
    firstEl.focus();
  }
}

if (monthFallbackCancelEl) {
  monthFallbackCancelEl.addEventListener("click", () => {
    closeMonthFallbackDialog();
  });
}

if (monthFallbackOverlayEl) {
  monthFallbackOverlayEl.addEventListener("click", (event) => {
    if (event.target === monthFallbackOverlayEl) {
      closeMonthFallbackDialog();
    }
  });
}

document.addEventListener("keydown", handleMonthFallbackDialogKeydown);
