const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {};
vm.createContext(context);
for (const file of ['time-utils.js', 'shift-rules.js', 'shift-utils.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

test('Planning-2 duration builder applies the central six-hour boundary', () => {
  const withoutBreak = context.buildWorkDurationShiftEntry('09:00', 360);
  const withBreak = context.buildWorkDurationShiftEntry('09:00', 360, { withBreakAtSix: true });
  const aboveBoundary = context.buildWorkDurationShiftEntry('09:00', 375);
  assert.deepEqual([withoutBreak.end, withoutBreak.pause, withoutBreak.minutes], ['15:00', 0, 360]);
  assert.deepEqual([withBreak.end, withBreak.pause, withBreak.minutes], ['16:00', 60, 360]);
  assert.deepEqual([aboveBoundary.end, aboveBoundary.pause, aboveBoundary.minutes], ['16:15', 60, 375]);
});

test('Late shortcuts express credited hours through the central late builder', () => {
  for (const hours of [3, 4, 5, 6]) {
    const regular = context.buildLateShiftEntryForWorkedMinutes(hours * 60, false);
    const checkout = context.buildLateShiftEntryForWorkedMinutes(hours * 60, true);
    assert.equal(regular.code, `L${hours}`);
    assert.equal(regular.end, '19:00');
    assert.equal(regular.minutes, hours * 60);
    assert.equal(checkout.end, '19:10');
    assert.equal(checkout.minutes, hours * 60);
  }
});

test('Planning-2 editor offers grouped shortcuts, ranges and duration wheels without FÖ', () => {
  const html = fs.readFileSync('planung2-preview.html', 'utf8');
  assert.match(html, /<summary class="quick">F<\/summary>/);
  assert.match(html, /data-quick="L3"[^]*data-quick="L6"/);
  assert.doesNotMatch(html, /data-quick="FO"|<option value="FO">/);
  assert.match(html, /id="editAbsenceFrom"[^]*id="editAbsenceTo"/);
  assert.match(html, /id="editWorkHours"[^]*id="editWorkMinutes"/);
  assert.match(html, /ohne Pause[^]*mit Pause/);
  assert.match(html, /data-quick="LAST"/);
});

test('Planning-2 keeps month-bounded employee activity for rendering and autofixes', () => {
  const live = fs.readFileSync('planning2-live.js', 'utf8');
  assert.match(live, /function planning2EmployeeActiveInMonth\(emp,ym\)/);
  assert.match(live, /activeFromMonth[^]*activeToMonth/);
  assert.match(live, /filter\(employee=>planning2EmployeeActiveInMonth\(employee,String\(editing\?\.dayIso/);
  assert.doesNotMatch(live, /function active\(e\)\{return e\?\.active!==false\}/);
});

test('Planning-2 AH cells show attendance, AH, target branch and credited work', () => {
  const live = fs.readFileSync('planning2-live.js', 'utf8');
  const start = live.indexOf('function cell(resolved)');
  let depth = 0;
  let source = '';
  for (let index = live.indexOf('{', start); index < live.length; index += 1) {
    if (live[index] === '{') depth += 1;
    if (live[index] === '}' && --depth === 0) { source = live.slice(start, index + 1); break; }
  }
  const cellContext = { resolvedShiftTimes: () => null, hm: minutes => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` };
  vm.createContext(cellContext);
  vm.runInContext(`${source};this.cell=cell`, cellContext);
  const result = cellContext.cell({ type: 'external-help', minutesForMonth: 360, sourceEntry: { start: '09:00', end: '16:00', branch: 'Kiel', minutes: 360 } });
  assert.deepEqual(Array.from(result), ['09:00–16:00', 'AH · Kiel · 6:00 h', 'abs']);
});
