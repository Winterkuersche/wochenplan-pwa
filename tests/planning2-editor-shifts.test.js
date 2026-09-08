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
