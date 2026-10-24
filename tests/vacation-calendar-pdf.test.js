const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');
function setup(fail) {
  const canvases = [], revoked = [], pages = [];
  const context = loadScripts(['vacation-calendar-pdf.js'], {
    Blob,
    WochenplanVacationCalendar: { renderSheet: () => '<svg viewBox="0 0 842 595"></svg>' },
    MepPdfBlobWriter: class {
      constructor(count) { this.count = count; }
      addJpegPage(blob, width, height) { pages.push({ blob, width, height }); }
      outputBlob() { assert.equal(pages.length, this.count); return new Blob(['pdf'], { type: 'application/pdf' }); }
    },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: url => revoked.push(url) },
    Image: class { set src(value) { if (fail) this.onerror(); else this.onload(); } },
    document: { createElement: () => {
      const canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: callback => callback(new Blob(['jpeg'], { type: 'image/jpeg' })) };
      canvases.push(canvas); return canvas;
    } }
  });
  return { context, canvases, revoked, pages };
}
test('calendar PDF creates one full-size image per page and releases temporary resources', async () => {
  const { context, canvases, revoked, pages } = setup(false);
  const result = await context.buildVacationCalendarPdf({ pages: [{}, {}] }, []);
  assert.equal(result.type, 'application/pdf'); assert.equal(pages.length, 2);
  assert.ok(pages.every(page => page.width === 2526 && page.height === 1785));
  assert.equal(revoked.length, 2); assert.ok(canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
});
test('failed image conversion rejects the export and still releases resources', async () => {
  const { context, revoked, canvases, pages } = setup(true);
  await assert.rejects(() => context.buildVacationCalendarPdf({ pages: [{}] }, []), /Kalenderseite/);
  assert.equal(revoked.length, 1); assert.equal(pages.length, 0); assert.equal(canvases[0].width, 0);
});
