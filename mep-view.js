const MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE = 9;
const MEP_TEMPLATE_BASE_SHEET_SCALE = 1;
const MEP_TEMPLATE_MAX_TABLE_SCALE = 1;
const MEP_HAND_VARIANT_COUNT = 8;
const MEP_TEMPLATE_TABLE_BOTTOM_BUFFER_PX = 0;

function mepPad2(value) {
  return String(value).padStart(2, "0");
}

function formatMepHeaderDate(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return `${mepPad2(date.getDate())}.${mepPad2(date.getMonth() + 1)}.`;
}

function formatMepMonthYear(isoDate) {
  if (!isoDate) return "____________";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "____________";
  return `${mepPad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatMepVisibleMonthTitle(yearMonth = state.activeMonth) {
  const normalizedYearMonth = yearMonth || state.activeMonth || toIsoDate(new Date()).slice(0, 7);
  const [year, month] = normalizedYearMonth.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);

  if (Number.isNaN(date.getTime())) return "Monatsansicht";

  return date.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });
}

function updateMepMonthHeaderTitle(yearMonth = state.activeMonth) {
  const titleEl = document.getElementById("mepMonthTitle");
  if (!titleEl) return;

  titleEl.textContent = `Sichtbarer Monat: ${formatMepVisibleMonthTitle(yearMonth)}`;
}

function bindMepMonthNavigation() {
  document.getElementById("mepMonthPrev")?.addEventListener("click", () => {
    shiftActiveMonth(-1);
  });

  document.getElementById("mepMonthNext")?.addEventListener("click", () => {
    shiftActiveMonth(1);
  });
}

function formatMepFullDate(isoDate) {
  if (!isoDate) return "____________";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "____________";
  return `${mepPad2(date.getDate())}.${mepPad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function getMepRoleLabel(employee) {
  if (!employee) return "";
  return employee.roleKey || employee.contractModel || "";
}

function getMepTargetLabel(employee) {
  if (!employee) return "";
  return employee.target || "";
}

function getMepPauseLabel(entry) {
  if (!entry) return "";
  return getPauseRangeForMep(entry);
}

function getMepTemplateTableHeightBudget(wrapEl, wrapInnerEl, footerEl) {
  if (!wrapEl || !wrapInnerEl || !footerEl) return 0;

  const wrapHeight = wrapEl.clientHeight || wrapEl.getBoundingClientRect().height || 0;
  const wrapInnerHeight = wrapInnerEl.clientHeight || wrapInnerEl.getBoundingClientRect().height || 0;
  const wrapStyles = window.getComputedStyle(wrapEl);
  const wrapPaddingBottom = parseFloat(wrapStyles.paddingBottom || "0") || 0;
  const layoutSlack = Math.max(
    0,
    wrapPaddingBottom,
    wrapHeight - wrapInnerHeight
  );

  return Math.max(0, wrapHeight - layoutSlack - MEP_TEMPLATE_TABLE_BOTTOM_BUFFER_PX);
}

function escapeMepHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMepHandVariantClass(variant = 0) {
  return `mepTplHandVariant${((variant % MEP_HAND_VARIANT_COUNT) + MEP_HAND_VARIANT_COUNT) % MEP_HAND_VARIANT_COUNT}`;
}

function renderMepHandText(value, variant = 0, extraClass = "") {
  if (value === null || value === undefined || value === "") return "";
  const variantClass = getMepHandVariantClass(variant);
  const className = ["mepTplHandwrite", variantClass, extraClass].filter(Boolean).join(" ");
  return `<span class="${className}">${escapeMepHtml(value)}</span>`;
}

function getMepNameLines(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return [];

  if (normalized.includes(",")) {
    const [lastName, ...firstNameParts] = normalized.split(",");
    const firstName = firstNameParts.join(",").trim();
    return [lastName.trim(), firstName].filter(Boolean);
  }

  return [normalized];
}

function renderMepEmployeeName(value, variant = 0) {
  const lines = getMepNameLines(value);
  if (!lines.length) return "";

  if (lines.length === 1) {
    return renderMepHandText(lines[0], variant, "mepTplHandName");
  }

  return `
    <span class="mepTplNameStack">
      ${lines
        .map((line, index) => renderMepHandText(line, variant + index, "mepTplHandNameLine"))
        .join("")}
    </span>
  `;
}


function getMepDayColumnClass(dayIndex) {
  const dayColumnClasses = [
    "mepTplDayCell--mon",
    "mepTplDayCell--tue",
    "mepTplDayCell--wed",
    "mepTplDayCell--thu",
    "mepTplDayCell--fri",
    "mepTplDayCell--sat",
    "mepTplDayCell--sun"
  ];

  return dayColumnClasses[dayIndex] || "";
}

function getMepDayCellClasses(dayIndex, day) {
  return [
    "mepTplDayCell",
    getMepDayColumnClass(dayIndex),
    dayIndex === 4 ? "mepTplCellSeparator" : "",
    dayIndex === 5 ? "mepTplCellSeparator" : "",
    dayIndex === 6 ? "mepTplCellBeforeSummary" : "",
    day?.isOutsideMonth ? "mepTplDayCell--outside" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function getOutsideMonthRuns(weekDays) {
  const runs = [];
  const safeWeekDays = Array.isArray(weekDays) ? weekDays : [];
  let runStartIndex = -1;

  safeWeekDays.forEach((day, index) => {
    const isOutsideMonth = Boolean(day?.isOutsideMonth);

    if (isOutsideMonth && runStartIndex === -1) {
      runStartIndex = index;
      return;
    }

    if (!isOutsideMonth && runStartIndex !== -1) {
      runs.push({
        startIndex: runStartIndex,
        length: index - runStartIndex
      });
      runStartIndex = -1;
    }
  });

  if (runStartIndex !== -1) {
    runs.push({
      startIndex: runStartIndex,
      length: safeWeekDays.length - runStartIndex
    });
  }

  return runs;
}

function getMepEmployeeRowClasses(rowTypeKey) {
  return [
    "mepTplEmployeeRow",
    `mepTplEmployeeRow--${rowTypeKey}`,
    rowTypeKey === "start" ? "mepTplEmployeeRow--blockStart" : "",
    rowTypeKey === "sum" ? "mepTplEmployeeRow--blockEnd" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function renderMepOutsideRunMarker(outsideRun) {
  if (!outsideRun?.length) return "";

  return `<span class="mepTplOutsideRunMarker" aria-hidden="true"></span>`;
}

function syncMepOutsideRunMarkers(root = document) {
  const markerRoot = root?.querySelectorAll ? root : document;

  markerRoot.querySelectorAll("[data-mep-outside-run-start='true']").forEach((startCell) => {
    const markerEl = startCell.querySelector(".mepTplOutsideRunMarker");
    const startDayIndex = Number(startCell.dataset.mepDayIndex || 0);
    const runColumns = Number(startCell.dataset.mepOutsideRunColumns || 0);

    if (!markerEl || !runColumns) return;

    let endRow = startCell.parentElement;
    for (let offset = 0; offset < 3; offset += 1) {
      endRow = endRow?.nextElementSibling;
    }

    const endDayIndex = startDayIndex + runColumns - 1;
    const endCell = endRow?.querySelector(`[data-mep-day-index="${endDayIndex}"]`);

    if (!endCell) return;

    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();
    const runWidth = Math.max(0, endRect.right - startRect.left);
    const runHeight = Math.max(0, endRect.bottom - startRect.top);
    const lineLength = Math.hypot(runWidth, runHeight);
    const lineAngle = Math.atan2(runHeight, runWidth);

    markerEl.style.width = `${lineLength}px`;
    markerEl.style.transform = `translateY(-50%) rotate(${lineAngle}rad)`;
  });
}

function buildMepEmployeeRows(employee, weekDays, employeeOffset = 0) {
  const safeWeekDays = Array.isArray(weekDays) ? [...weekDays] : [];

  while (safeWeekDays.length < 7) {
    safeWeekDays.push({ iso: "", isOutsideMonth: false });
  }

  const rowTypes = [
    { key: "start", label: "Beginn" },
    { key: "pause", label: "Pause" },
    { key: "end", label: "Ende" },
    { key: "sum", label: "Summe / Tag" }
  ];
  const outsideMonthRuns = getOutsideMonthRuns(safeWeekDays);
  const outsideRunMap = new Map(
    outsideMonthRuns.map((run) => [run.startIndex, run])
  );

  return rowTypes
    .map((rowType, index) => {
      const dayCells = safeWeekDays
        .map((day, dayIndex) => {
          const isoDate = day?.iso || "";
          const variant = employeeOffset * 7 + index * 3 + dayIndex;
          const dayCellClassNames = [getMepDayCellClasses(dayIndex, day)];
          const isOutsideRunStart = index === 0 && outsideRunMap.has(dayIndex);

          if (isOutsideRunStart) {
            dayCellClassNames.push("mepTplDayCell--outsideRunStart");
          }

          const outsideRun = isOutsideRunStart ? outsideRunMap.get(dayIndex) : null;
          const outsideRunMarker = renderMepOutsideRunMarker(outsideRun);
          const dayCellClassName = dayCellClassNames.filter(Boolean).join(" ");
          const dayCellAttributes = [
            `class="${dayCellClassName}"`,
            `data-mep-day-index="${dayIndex}"`
          ];

          if (outsideRun) {
            dayCellAttributes.push(`data-mep-outside-run-columns="${outsideRun.length}"`);
          }

          if (isOutsideRunStart) {
            dayCellAttributes.push('data-mep-outside-run-start="true"');
          }

          if (day?.isOutsideMonth) {
            return `<td ${dayCellAttributes.join(" ")}>${outsideRunMarker}</td>`;
          }

          const entry = employee && isoDate ? getEmployeeDayEntry(employee.id, isoDate) : null;

          if (!entry) return `<td ${dayCellAttributes.join(" ")}></td>`;

          if (rowType.key === "start") {
            return `<td ${dayCellAttributes.join(" ")}>${renderMepHandText(entry.start || "", variant, "mepTplHandValue")}</td>`;
          }

          if (rowType.key === "pause") {
            return `<td ${dayCellAttributes.join(" ")}>${renderMepHandText(getMepPauseLabel(entry), variant + 1, "mepTplHandValue")}</td>`;
          }

          if (rowType.key === "end") {
            return `<td ${dayCellAttributes.join(" ")}>${renderMepHandText(entry.end || "", variant + 2, "mepTplHandValue")}</td>`;
          }

          if (rowType.key === "sum") {
            return `<td ${dayCellAttributes.join(" ")}>${renderMepHandText(entry.minutes ? minutesToHM(entry.minutes) : "", variant + 3, "mepTplHandValue")}</td>`;
          }

          return `<td ${dayCellAttributes.join(" ")}></td>`;
        })
        .join("");

      const baseColumns =
        index === 0
          ? `
            <td rowspan="4" class="mepTplEmployee mepTplColEmployee">${renderMepEmployeeName(employee?.name || "", employeeOffset)}</td>
            <td rowspan="4" class="mepTplColRole">${renderMepHandText(getMepRoleLabel(employee), employeeOffset + 1, "mepTplHandMeta")}</td>
            <td rowspan="4" class="mepTplColTarget">${renderMepHandText(getMepTargetLabel(employee), employeeOffset + 2, "mepTplHandMeta")}</td>
          `
          : "";

      const summaryColumns =
        index === 0
          ? `
            <td rowspan="4" class="mepTplSummary mepTplSummaryWeek mepTplSummaryCell mepTplSummaryCellWeek"><div class="mepTplSummaryBox">${renderMepHandText(employee ? minutesToHM(getEmployeeAccountMinutesForWeek(employee, safeWeekDays)) : "", employeeOffset + 3, "mepTplHandSummary")}</div></td>
            <td rowspan="4" class="mepTplSummary mepTplSummaryMonth mepTplSummaryCell mepTplSummaryCellMonth"><div class="mepTplSummaryBox">${renderMepHandText(employee ? minutesToHM(getEmployeeAccountMinutesForMonth(employee, state.activeMonth)) : "", employeeOffset + 4, "mepTplHandSummary")}</div></td>
          `
          : "";

      return `
        <tr class="${getMepEmployeeRowClasses(rowType.key)}">
          ${baseColumns}
          <td class="mepTplMetric mepTplColMetric">${rowType.label}</td>
          ${dayCells}
          ${summaryColumns}
        </tr>
      `;
    })
    .join("");
}

function getMepTemplateSheetModelsForMonth() {
  const monthWeeks = state.monthPlan?.weeks || [];
  const employees = Array.isArray(state.employees) ? state.employees : [];
  const employeePageCount = Math.max(1, Math.ceil(Math.max(employees.length, 1) / MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE));

  if (!monthWeeks.length) {
    return [
      {
        weekDays: getActiveWeekDays(),
        weekIndex: 0,
        pageIndex: 0,
        employees: employees.slice(0, MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE),
        weekFrom: state.weekFrom || "",
        weekTo: state.weekTo || "",
        activeMonth: state.activeMonth || (state.weekFrom || "").slice(0, 7)
      }
    ];
  }

  return monthWeeks.flatMap((weekDays, weekIndex) => {
    const safeWeekDays = Array.isArray(weekDays) ? weekDays : [];
    const weekFrom = safeWeekDays[0]?.iso || "";
    const weekTo = safeWeekDays[safeWeekDays.length - 1]?.iso || weekFrom;
    const activeMonth =
      state.activeMonth ||
      safeWeekDays.find((day) => day?.inCurrentMonth)?.iso?.slice(0, 7) ||
      weekFrom.slice(0, 7);

    return Array.from({ length: employeePageCount }, (_, pageIndex) => ({
      weekDays: safeWeekDays,
      weekIndex,
      pageIndex,
      employees: employees.slice(
        pageIndex * MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE,
        (pageIndex + 1) * MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE
      ),
      weekFrom,
      weekTo,
      activeMonth
    }));
  });
}

function getMepTemplateSheetModelsForWeek() {
  const weekDays = getActiveWeekDays();
  const employees = Array.isArray(state.employees) ? state.employees : [];
  const totalPages = Math.max(1, Math.ceil(Math.max(employees.length, 1) / MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE));

  return Array.from({ length: totalPages }, (_, pageIndex) => ({
    weekDays,
    weekIndex: 0,
    pageIndex,
    employees: employees.slice(
      pageIndex * MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE,
      (pageIndex + 1) * MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE
    ),
    weekFrom: state.weekFrom || weekDays[0]?.iso || "",
    weekTo: state.weekTo || weekDays[weekDays.length - 1]?.iso || "",
    activeMonth: state.activeMonth || (weekDays[0]?.iso || "").slice(0, 7)
  }));
}

function fitMepTemplateSheets() {
  const pagesEl = document.getElementById("mepTemplatePages");
  if (!pagesEl) return;

  const pageContainerWidth = pagesEl.clientWidth || pagesEl.getBoundingClientRect().width || 0;

  pagesEl.querySelectorAll(".mepTplSheet").forEach((sheetEl) => {
    const innerEl = sheetEl.querySelector(".mepTplSheetInner");
    const wrapEl = sheetEl.querySelector(".mepTplWrap");
    const wrapInnerEl = sheetEl.querySelector(".mepTplWrapInner");
    const footerEl = sheetEl.querySelector(".mepTplFooter");

    if (!innerEl || !wrapEl || !wrapInnerEl || !footerEl) return;

    sheetEl.style.setProperty("--mep-sheet-scale", "1");
    sheetEl.style.setProperty("--mep-table-scale", "1");

    const fullSheetWidth = innerEl.getBoundingClientRect().width || 0;
    const maxSheetScaleFromWidth =
      pageContainerWidth > 0 && fullSheetWidth > 0
        ? Math.min(1, pageContainerWidth / fullSheetWidth)
        : 1;
    const minReadableScale = Math.min(1, window.innerWidth < 920 ? 0.82 : 0.9);
    const sheetScale = Math.max(
      Math.min(MEP_TEMPLATE_BASE_SHEET_SCALE, maxSheetScaleFromWidth),
      Math.min(minReadableScale, maxSheetScaleFromWidth)
    );

    sheetEl.style.setProperty("--mep-sheet-scale", `${sheetScale}`);

    const availableWrapHeight = getMepTemplateTableHeightBudget(wrapEl, wrapInnerEl, footerEl);
    const tableHeight = wrapInnerEl.scrollHeight;
    const fitsReservedTableZone = availableWrapHeight <= 0 || tableHeight <= availableWrapHeight + 1;
    const tableScale = 1;

    sheetEl.style.setProperty("--mep-table-scale", `${tableScale}`);
    sheetEl.classList.toggle("mepTplSheet--tableOverflow", !fitsReservedTableZone);
  });

  syncMepOutsideRunMarkers(pagesEl);
}

function renderMepTemplateView(options = {}) {
  const { scope = "month" } = options;
  const pagesEl = document.getElementById("mepTemplatePages");
  const sheetTemplate = document.getElementById("mepTemplateSheetTemplate");
  if (!pagesEl || !sheetTemplate) return;

  updateMepMonthHeaderTitle(state.activeMonth);

  const sheetModels =
    scope === "week" ? getMepTemplateSheetModelsForWeek() : getMepTemplateSheetModelsForMonth();

  pagesEl.innerHTML = "";

  sheetModels.forEach((sheetModel, sheetIndex) => {
    const sheetFragment = sheetTemplate.content.cloneNode(true);
    const bodyEl = sheetFragment.querySelector(".mepTemplateBody");
    if (!bodyEl) return;

    const weekDays = Array.isArray(sheetModel.weekDays) ? sheetModel.weekDays : [];
    const monthSourceDate = `${sheetModel.activeMonth || ""}-01`;

    const monthYearEl = sheetFragment.querySelector("[data-mep-month-year]");
    const weekFromEl = sheetFragment.querySelector("[data-mep-week-from]");
    const weekToEl = sheetFragment.querySelector("[data-mep-week-to]");

    if (monthYearEl) monthYearEl.textContent = formatMepMonthYear(monthSourceDate);
    if (weekFromEl) weekFromEl.textContent = formatMepFullDate(sheetModel.weekFrom);
    if (weekToEl) weekToEl.textContent = formatMepFullDate(sheetModel.weekTo);

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const dateEl = sheetFragment.querySelector(`[data-mep-date-index="${dayIndex}"]`);
      if (!dateEl) continue;

      const day = weekDays[dayIndex] || null;
      const isoDate = day?.iso || "";
      const headerCell = dateEl.closest("th");
      dateEl.textContent = day?.isOutsideMonth ? "" : formatMepHeaderDate(isoDate);
      dateEl.className = [
        "mepTplHeaderDate",
        getMepHandVariantClass(sheetIndex * 7 + dayIndex)
      ].filter(Boolean).join(" ");
      headerCell?.classList.toggle("mepTplDayHeader--outsideMonth", Boolean(day?.isOutsideMonth));
    }

    let rowsHtml = "";

    for (let slotIndex = 0; slotIndex < MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE; slotIndex += 1) {
      rowsHtml += buildMepEmployeeRows(sheetModel.employees[slotIndex], weekDays, slotIndex);
    }

    bodyEl.innerHTML = rowsHtml;
    pagesEl.appendChild(sheetFragment);
  });

  requestAnimationFrame(() => {
    fitMepTemplateSheets();
  });
}
