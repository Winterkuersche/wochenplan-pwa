const OVERVIEW_XLSX_SHEET_NAME = "Übersicht";

function buildOverviewXlsxWorkbook(options = {}) {
  const {
    XLSX: xlsx,
    monthTitle = "Monatsübersicht",
    weeks = [],
    employees = [],
    getWeekSummary,
    getResolvedEntry,
    getPlannerCellText,
    buildDailyStaffing
  } = options;

  if (!xlsx?.utils?.aoa_to_sheet || !xlsx?.utils?.book_new) {
    throw new Error("Der Tabellen-Export ist noch nicht verfügbar.");
  }

  const rows = [[monthTitle], []];
  const merges = [];
  const rowKinds = ["title", "spacer"];
  const columnCount = 7;

  weeks.forEach((weekDays) => {
    const visibleDays = (weekDays || []).slice(0, 6).filter(Boolean);
    if (!visibleDays.some((day) => day.inCurrentMonth)) return;

    const summary = getWeekSummary(weekDays);
    const firstDay = visibleDays[0];
    const lastDay = visibleDays[visibleDays.length - 1];
    const range = firstDay && lastDay
      ? `${formatXlsxDate(firstDay.date)}–${formatXlsxDate(lastDay.date)}`
      : "";
    const differenceLabel = summary.differenceMinutes <= 0 ? "Rest" : "Über";

    const headingRow = rows.length;
    rows.push([`Woche ${range}`]);
    rowKinds.push("weekHeading");
    merges.push({ s: { r: headingRow, c: 0 }, e: { r: headingRow, c: columnCount - 1 } });
    rows.push([
      "Genutzte Wochenstunden", summary.usedMinutes / 60,
      "Sollstunden", summary.targetMinutes / 60,
      differenceLabel, Math.abs(summary.differenceMinutes) / 60
    ]);
    rowKinds.push("summary");

    rows.push(["Mitarbeiter", ...visibleDays.map((day) => `${day.weekdayLabel} ${formatXlsxDate(day.date)}`)]);
    rowKinds.push("tableHeader");
    employees.forEach((employee) => {
      rows.push([
        employee.name || "—",
        ...visibleDays.map((day) => getPlannerCellText(getResolvedEntry(employee, day.iso)))
      ]);
      rowKinds.push("employee");
    });

    rows.push([]);
    rowKinds.push("spacer");
    rows.push(["Tagesbesetzung", "Früh", "Ganzer Tag", "Dazwischen", "Spät"]);
    rowKinds.push("staffingHeader");
    buildDailyStaffing(weekDays, employees, getResolvedEntry).forEach(({ day, groups }) => {
      rows.push([
        `${day.weekdayLabel} ${formatXlsxDate(day.date)}`,
        ...["early", "fullDay", "between", "late"].map((group) => (
          groups[group].map(({ name, start, end }) => `${name} (${start}–${end})`).join("\n") || "—"
        ))
      ]);
      rowKinds.push("staffing");
    });
    rows.push([]);
    rowKinds.push("spacer");
  });

  const sheet = xlsx.utils.aoa_to_sheet(rows);
  sheet["!merges"] = merges;
  sheet["!cols"] = [{ wch: 28 }, ...Array(columnCount - 1).fill(null).map(() => ({ wch: 20 }))];
  sheet["!rows"] = rowKinds.map((kind) => ({ hpt: kind === "title" ? 28 : kind === "staffing" ? 34 : 22 }));
  sheet["!autofilter"] = undefined;

  applyOverviewXlsxStyles(sheet, rows, rowKinds, xlsx);

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, OVERVIEW_XLSX_SHEET_NAME);
  workbook.Props = { Title: monthTitle, Subject: "Bearbeitbare Monatsübersicht" };
  return workbook;
}

function formatXlsxDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.`;
}

function applyOverviewXlsxStyles(sheet, rows, rowKinds, xlsx) {
  const colors = {
    navy: "243B53", blue: "DCEAF7", green: "E4F3E9", purple: "EEE5F4",
    gray: "E9EDF0", border: "B8C2CC", white: "FFFFFF"
  };
  rows.forEach((row, rowIndex) => {
    for (let columnIndex = 0; columnIndex < Math.max(row.length, 7); columnIndex += 1) {
      const address = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[address];
      if (!cell) continue;
      const kind = rowKinds[rowIndex];
      cell.s = {
        font: { name: "Arial", sz: kind === "title" ? 16 : 10, bold: ["title", "weekHeading", "tableHeader", "staffingHeader"].includes(kind), color: { rgb: kind === "title" || kind === "weekHeading" ? colors.white : "1F2933" } },
        fill: { fgColor: { rgb: kind === "title" || kind === "weekHeading" ? colors.navy : kind === "tableHeader" ? colors.blue : kind === "staffingHeader" ? colors.green : "FFFFFF" } },
        border: ["summary", "tableHeader", "employee", "staffingHeader", "staffing"].includes(kind) ? {
          top: { style: "thin", color: { rgb: colors.border } }, bottom: { style: "thin", color: { rgb: colors.border } },
          left: { style: "thin", color: { rgb: colors.border } }, right: { style: "thin", color: { rgb: colors.border } }
        } : undefined,
        alignment: { vertical: "center", wrapText: true }
      };
      if (kind === "summary" && typeof cell.v === "number") cell.z = '0.00 "h"';
      if (kind === "staffingHeader" && columnIndex > 0) {
        cell.s.fill = { fgColor: { rgb: [colors.green, colors.blue, colors.gray, colors.purple][columnIndex - 1] } };
      }
    }
  });
}

function exportOverviewXlsx(options = {}) {
  const xlsx = options.XLSX || window.XLSX;
  const workbook = buildOverviewXlsxWorkbook({ ...options, XLSX: xlsx });
  const monthKey = String(options.activeMonth || "Monat").replace(/[^0-9-]/g, "");
  xlsx.writeFile(workbook, `Monatsuebersicht-${monthKey || "Monat"}.xlsx`, { compression: true });
}
