const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

function createXlsxMock() {
  return {
    utils: {
      aoa_to_sheet(rows) {
        const sheet = {};
        rows.forEach((row, r) => row.forEach((value, c) => {
          if (value === undefined) return;
          const address = this.encode_cell({ r, c });
          sheet[address] = { v: value, t: typeof value === 'number' ? 'n' : 's' };
        }));
        return sheet;
      },
      encode_cell({ r, c }) {
        return `${String.fromCharCode(65 + c)}${r + 1}`;
      },
      book_new() { return { SheetNames: [], Sheets: {} }; },
      book_append_sheet(workbook, sheet, name) {
        workbook.SheetNames.push(name);
        workbook.Sheets[name] = sheet;
      }
    },
    writeFile() {}
  };
}

function createWeek() {
  return Array.from({ length: 7 }, (_, index) => ({
    iso: `2026-09-${String(7 + index).padStart(2, '0')}`,
    date: new Date(2026, 8, 7 + index),
    weekdayLabel: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][index],
    inCurrentMonth: true
  }));
}

test('XLSX overview contains summary, editable employee cells and reused daily staffing output', () => {
  const ctx = loadScripts(['xlsx-export.js']);
  const XLSX = createXlsxMock();
  let staffingCalls = 0;
  const workbook = ctx.buildOverviewXlsxWorkbook({
    XLSX,
    monthTitle: 'September 2026',
    weeks: [createWeek()],
    employees: [{ id: 'e1', name: 'Muster, Anna' }],
    getWeekSummary: () => ({ usedMinutes: 2100, targetMinutes: 2400, differenceMinutes: -300 }),
    getResolvedEntry: (_employee, iso) => ({ label: iso, start: '09:00', end: '17:00' }),
    getPlannerCellText: (entry) => entry.label,
    buildDailyStaffing(days) {
      staffingCalls += 1;
      return days.slice(0, 6).map((day) => ({
        day,
        groups: { early: [{ name: 'Anna', start: '09:00', end: '17:00' }], fullDay: [], between: [], late: [] }
      }));
    }
  });

  assert.deepEqual([...workbook.SheetNames], ['Übersicht']);
  assert.equal(staffingCalls, 1);
  const sheet = workbook.Sheets['Übersicht'];
  const values = Object.values(sheet).filter((cell) => cell && 'v' in cell).map((cell) => cell.v);
  assert.ok(values.includes('Genutzte Wochenstunden'));
  assert.ok(values.includes('Sollstunden'));
  assert.ok(values.includes('Rest'));
  assert.ok(values.includes('Muster, Anna'));
  assert.ok(values.includes('2026-09-07'));
  assert.ok(values.includes('Anna (09:00–17:00)'));
  assert.equal(sheet.B5.t, 's');
  assert.equal(sheet.B4.t, 'n');
  assert.equal(sheet.B4.z, '0.00 "h"');
});

test('XLSX export writes a compatible xlsx filename for the selected month', () => {
  const ctx = loadScripts(['xlsx-export.js'], { window: {} });
  const XLSX = createXlsxMock();
  let written;
  XLSX.writeFile = (_workbook, filename, options) => { written = { filename, options }; };

  ctx.exportOverviewXlsx({
    XLSX,
    activeMonth: '2026-09',
    weeks: [],
    getWeekSummary() {}, getResolvedEntry() {}, getPlannerCellText() {}, buildDailyStaffing() { return []; }
  });

  assert.equal(written.filename, 'Monatsuebersicht-2026-09.xlsx');
  assert.equal(written.options.compression, true);
});

test('XLSX overview selects Monday through Saturday explicitly across a month boundary', () => {
  const ctx = loadScripts(['xlsx-export.js']);
  const XLSX = createXlsxMock();
  const week = [
    { iso: '2026-09-06', date: new Date(2026, 8, 6), weekdayLabel: 'So', inCurrentMonth: true },
    { iso: '2026-08-31', date: new Date(2026, 7, 31), weekdayLabel: 'Mo', inCurrentMonth: false },
    ...Array.from({ length: 5 }, (_, index) => ({
      iso: `2026-09-0${index + 1}`,
      date: new Date(2026, 8, index + 1),
      weekdayLabel: ['Di', 'Mi', 'Do', 'Fr', 'Sa'][index],
      inCurrentMonth: true
    }))
  ];
  const resolvedDates = [];
  const workbook = ctx.buildOverviewXlsxWorkbook({
    XLSX,
    monthTitle: 'September 2026',
    weeks: [week],
    employees: [{ id: 'e1', name: 'Anna' }],
    getWeekSummary: () => ({ usedMinutes: 0, targetMinutes: 2400, differenceMinutes: -2400 }),
    getResolvedEntry(_employee, iso) {
      resolvedDates.push(iso);
      return { label: iso };
    },
    getPlannerCellText: (entry) => entry.label,
    buildDailyStaffing: () => []
  });

  const sheet = workbook.Sheets['Übersicht'];
  assert.equal(sheet.A3.v, 'Woche 31.08.–05.09.');
  assert.deepEqual(resolvedDates, [
    '2026-08-31', '2026-09-01', '2026-09-02',
    '2026-09-03', '2026-09-04', '2026-09-05'
  ]);
  assert.equal(sheet.B5.v, 'Mo 31.08.');
  assert.equal(sheet.G5.v, 'Sa 05.09.');
});
