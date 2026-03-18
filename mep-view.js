const MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE = 8;

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

function buildMepEmployeeRows(employee, weekDays) {
  const isoDays = weekDays.map((day) => day.iso);

  const rowTypes = [
    { key: "start", label: "Beginn" },
    { key: "pause", label: "Pause" },
    { key: "end", label: "Ende" },
    { key: "sum", label: "Summe / Tag" }
  ];

  return rowTypes
    .map((rowType, index) => {
      const dayCells = isoDays
        .map((isoDate) => {
          const entry = employee ? getEmployeeDayEntry(employee.id, isoDate) : null;

          if (!entry) return "<td></td>";

          if (rowType.key === "start") {
            return `<td>${entry.start || ""}</td>`;
          }

          if (rowType.key === "pause") {
            return `<td>${getMepPauseLabel(entry)}</td>`;
          }

          if (rowType.key === "end") {
            return `<td>${entry.end || ""}</td>`;
          }

          if (rowType.key === "sum") {
            return `<td>${entry.minutes ? minutesToHM(entry.minutes) : ""}</td>`;
          }

          return "<td></td>";
        })
        .join("");

      const baseColumns =
        index === 0
          ? `
            <td rowspan="4" class="mepTplEmployee">${employee?.name || ""}</td>
            <td rowspan="4">${getMepRoleLabel(employee)}</td>
            <td rowspan="4">${getMepTargetLabel(employee)}</td>
          `
          : "";

      const summaryColumns =
        index === 0
          ? `
            <td rowspan="4" class="mepTplSummary mepTplSummaryWeek"><div class="mepTplSummaryBox">${employee ? minutesToHM(getEmployeeAccountMinutesForWeek(employee, weekDays)) : ""}</div></td>
            <td rowspan="4" class="mepTplSummary mepTplSummaryMonth"><div class="mepTplSummaryBox">${employee ? minutesToHM(getEmployeeAccountMinutesForMonth(employee, state.activeMonth)) : ""}</div></td>
          `
          : "";

      return `
        <tr>
          ${baseColumns}
          <td class="mepTplMetric">${rowType.label}</td>
          ${dayCells}
          ${summaryColumns}
        </tr>
      `;
    })
    .join("");
}

function renderMepTemplateView() {
  const pagesEl = document.getElementById("mepTemplatePages");
  const sheetTemplate = document.getElementById("mepTemplateSheetTemplate");
  if (!pagesEl || !sheetTemplate) return;

  const weekDays = getActiveWeekDays();
  const weekFrom = state.weekFrom || "";
  const weekTo = state.weekTo || "";
  const totalEmployees = Math.max(state.employees.length, 1);
  const totalPages = Math.max(1, Math.ceil(totalEmployees / MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE));

  pagesEl.innerHTML = "";

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const sheetFragment = sheetTemplate.content.cloneNode(true);
    const bodyEl = sheetFragment.querySelector(".mepTemplateBody");
    if (!bodyEl) continue;

    const pageEmployees = state.employees.slice(
      pageIndex * MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE,
      (pageIndex + 1) * MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE
    );

    sheetFragment.querySelector("[data-mep-month-year]").textContent = formatMepMonthYear(weekFrom);
    sheetFragment.querySelector("[data-mep-week-from]").textContent = formatMepFullDate(weekFrom);
    sheetFragment.querySelector("[data-mep-week-to]").textContent = formatMepFullDate(weekTo);

    weekDays.forEach((day, index) => {
      const dateEl = sheetFragment.querySelector(`[data-mep-date-index="${index}"]`);
      if (dateEl) {
        dateEl.textContent = formatMepHeaderDate(day.iso);
      }
    });

    let rowsHtml = "";

    for (let slotIndex = 0; slotIndex < MEP_TEMPLATE_EMPLOYEE_SLOTS_PER_PAGE; slotIndex += 1) {
      rowsHtml += buildMepEmployeeRows(pageEmployees[slotIndex], weekDays);
    }

    bodyEl.innerHTML = rowsHtml;
    pagesEl.appendChild(sheetFragment);
  }
}
