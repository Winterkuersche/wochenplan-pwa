const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadScripts } = require('./test-helpers');

class MockPdf {
  constructor(options) {
    this.options = options;
    this.actions = [];
  }

  addPage(format, orientation) {
    this.actions.push({ type: 'addPage', format, orientation });
  }

  addImage(dataUrl, imageType, x, y, width, height, alias, compression) {
    this.actions.push({
      type: 'addImage',
      dataUrl,
      imageType,
      x,
      y,
      width,
      height,
      alias,
      compression
    });
  }

  output(type) {
    assert.equal(type, 'blob');
    return Object.assign(new Blob(['%PDF-mock'], { type: 'application/pdf' }), {
      options: this.options,
      actions: this.actions
    });
  }
}

function createCanvas(width, height, label) {
  return {
    width,
    height,
    toBlob(callback, type) {
      callback(new Blob([`jpeg:${label}`], { type }));
    },
    toDataURL() {
      return `data:image/png;base64,${label}`;
    }
  };
}

async function pdfText(blob) {
  return new TextDecoder('latin1').decode(await blob.arrayBuffer());
}

function countPdfPages(text) {
  return (text.match(/\/Type \/Page\b/g) || []).length;
}

function assertValidPdfXref(text) {
  const xrefOffset = Number(text.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
  assert.ok(Number.isInteger(xrefOffset));
  assert.equal(text.slice(xrefOffset, xrefOffset + 4), 'xref');
  const [, objectCountText, entriesText] = text.slice(xrefOffset)
    .match(/^xref\n0 (\d+)\n([\s\S]*?)trailer\n/);
  const objectCount = Number(objectCountText);
  const entries = entriesText.trimEnd().split('\n');
  assert.equal(entries.length, objectCount);
  entries.slice(1).forEach((entry, index) => {
    const offset = Number(entry.slice(0, 10));
    assert.equal(text.slice(offset, offset + String(index + 1).length + 6), `${index + 1} 0 obj`);
  });
}

const ctx = loadScripts(['pdf-export.js'], {
  Blob,
  window: {
    WOCHENPLAN_DRIVE_CONFIG: {}
  }
});

function buildMepModelContext(employeeCount, weekCount) {
  const employees = Array.from({ length: employeeCount }, (_, index) => ({ id: `employee-${index + 1}` }));
  const weeks = Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => ({
      iso: `2026-09-${String(weekIndex * 7 + dayIndex + 1).padStart(2, '0')}`,
      inCurrentMonth: true
    }))
  );
  return loadScripts(['mep-view.js'], {
    state: { activeMonth: '2026-09', employees, monthPlan: { weeks } },
    isEmployeeActiveInMonth: () => true
  });
}

test('MEP sheet models keep nine employees on one page and split eighteen across two pages of the same week', () => {
  const nineEmployeePages = buildMepModelContext(9, 1).getMepTemplateSheetModelsForMonth();
  const eighteenEmployeePages = buildMepModelContext(18, 1).getMepTemplateSheetModelsForMonth();

  assert.equal(nineEmployeePages.length, 1);
  assert.equal(nineEmployeePages[0].employees.length, 9);
  assert.equal(eighteenEmployeePages.length, 2);
  assert.deepEqual(eighteenEmployeePages.map((page) => page.weekIndex), [0, 0]);
  assert.deepEqual(eighteenEmployeePages.map((page) => page.employees.length), [9, 9]);
});

test('MEP sheet models create ten finished sheets for five weeks with eighteen employees', () => {
  const pages = buildMepModelContext(18, 5).getMepTemplateSheetModelsForMonth();

  assert.equal(pages.length, 10);
  assert.deepEqual(pages.map((page) => page.weekIndex), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('MEP export processes five weeks with two pages sequentially into ten PDF pages', async () => {
  const preparedPages = Array.from({ length: 5 }, (_, weekIndex) =>
    Array.from({ length: 2 }, (_, pageIndex) => ({ weekIndex, pageIndex }))
  ).flat();
  const capturedCanvases = [];

  const result = await ctx.buildMepPdfBlobFromSheets(preparedPages, {
    scale: 2,
    captureFn: async (page, captureOptions) => {
      assert.ok(capturedCanvases.every(({ canvas }) => canvas.width === 0 && canvas.height === 0));
      const canvas = createCanvas(1000, 1600, `week-${page.weekIndex + 1}-page-${page.pageIndex + 1}`);
      capturedCanvases.push({ page, captureOptions, canvas });
      return canvas;
    }
  });

  assert.equal(preparedPages.length, 10);
  assert.equal(capturedCanvases.length, 10);
  assert.deepEqual(capturedCanvases.map(({ page }) => page), preparedPages);
  assert.ok(capturedCanvases.every(({ captureOptions }) =>
    captureOptions.scale === 2 && captureOptions.backgroundColor === '#ffffff' &&
    captureOptions.useCORS === true && captureOptions.removeContainer === true
  ));
  assert.ok(capturedCanvases.every(({ canvas }) => canvas.width === 0 && canvas.height === 0));
  const text = await pdfText(result);
  assertValidPdfXref(text);
  assert.equal(countPdfPages(text), 10);
  assert.equal((text.match(/\/Subtype \/Image/g) || []).length, 10);
  const labels = preparedPages.map((page) => `jpeg:week-${page.weekIndex + 1}-page-${page.pageIndex + 1}`);
  assert.ok(labels.every((label, index) => text.indexOf(label) > (index ? text.indexOf(labels[index - 1]) : -1)));
});

test('one MEP sheet creates one PDF page exactly once', async () => {
  const result = await ctx.buildMepPdfBlobFromSheets([{}], {
    captureFn: async () => createCanvas(1000, 707, 'only-page'),
    yieldBetweenPages: false
  });
  assert.equal(countPdfPages(await pdfText(result)), 1);
});

test('two MEP sheets create exactly two ordered A4 landscape pages without a blank page', async () => {
  const sheets = [{ id: 'first' }, { id: 'second' }];
  const result = await ctx.buildMepPdfBlobFromSheets(sheets, {
    captureFn: async (sheet) => createCanvas(1200, 849, sheet.id),
    yieldBetweenPages: false
  });

  const text = await pdfText(result);
  assert.equal(countPdfPages(text), 2);
  assert.equal((text.match(/\/MediaBox \[0 0 841\.889764 595\.275591\]/g) || []).length, 2);
  assert.ok(text.indexOf('jpeg:first') < text.indexOf('jpeg:second'));
});

test('iOS-like devices use the reduced default capture scale and yield between pages', async () => {
  let capturedScale;
  let yields = 0;
  const iosContext = loadScripts(['pdf-export.js'], {
    Blob,
    navigator: { userAgent: 'Mozilla/5.0 (iPhone)', platform: 'iPhone', maxTouchPoints: 5 },
    window: { WOCHENPLAN_DRIVE_CONFIG: {}, setTimeout },
  });
  await iosContext.buildMepPdfBlobFromSheets([{}], {
    captureFn: async (_, options) => {
      capturedScale = options.scale;
      return createCanvas(1000, 707, 'ios-page');
    },
    yieldFn: async () => { yields += 1; }
  });
  assert.equal(capturedScale, 1.25);
  assert.equal(yields, 1);
});

test('MEP PDF embeds the JPEG Blob directly without Uint8Array/base64 conversion', async () => {
  let dataUrlCalls = 0;
  const canvas = {
    width: 1000,
    height: 707,
    toBlob(callback, type, quality) {
      assert.equal(type, 'image/jpeg');
      assert.equal(quality, 0.9);
      callback(new Blob([new Uint8Array([1, 2, 3])], { type }));
    },
    toDataURL() { dataUrlCalls += 1; throw new Error('must not run'); }
  };
  const result = await ctx.buildMepPdfBlobFromSheets([{}], {
    captureFn: async () => canvas,
    yieldBetweenPages: false
  });
  assert.equal(dataUrlCalls, 0);
  const bytes = new Uint8Array(await result.arrayBuffer());
  assert.ok(bytes.some((value, index) => value === 1 && bytes[index + 1] === 2 && bytes[index + 2] === 3));
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test('MEP PDF reports prepare, capture, image conversion, addImage and output failures separately', async () => {
  await assert.rejects(
    ctx.buildMepPdfBlobFromSheets([{}], {
      captureFn: async () => createCanvas(1, 1, 'x'),
      pdfWriterFactory: () => { throw new Error('prepare'); }
    }),
    (error) => error.stage === 'prepare'
  );
  await assert.rejects(
    ctx.buildMepPdfBlobFromSheets([{}], { captureFn: async () => { throw new Error('capture'); } }),
    (error) => error.stage === 'capture' && error.pageIndex === 0
  );
  await assert.rejects(
    ctx.buildMepPdfBlobFromSheets([{}], {
        captureFn: async () => ({ width: 1, height: 1, toDataURL() { throw new Error('convert'); } })
    }),
    (error) => error.stage === 'image.convert'
  );
  await assert.rejects(
    ctx.buildMepPdfBlobFromSheets([{}], {
      captureFn: async () => createCanvas(1, 1, 'x'),
      pdfWriterFactory: () => ({ addJpegPage() { throw new Error('addImage'); } })
    }),
    (error) => error.stage === 'pdf.addImage'
  );
  await assert.rejects(
    ctx.buildMepPdfBlobFromSheets([{}], {
      captureFn: async () => createCanvas(1, 1, 'x'),
      pdfWriterFactory: () => ({ addJpegPage() {}, outputBlob() { throw new Error('output'); } })
    }),
    (error) => error.stage === 'pdf.output'
  );
});

test('MEP export root cleanup is null-safe and removes an existing root', () => {
  let removals = 0;
  ctx.removeMepPdfExportRoot(null);
  ctx.removeMepPdfExportRoot({ remove() { removals += 1; } });
  assert.equal(removals, 1);
});

test('MEP print CSS uses each complete finished sheet as the exact A4 landscape page boundary', () => {
  const styles = fs.readFileSync('styles.css', 'utf8');
  const mepPrintStart = styles.indexOf('@media print {', styles.indexOf('MEP-TABELLENANSICHT'));
  const mepPrintCss = styles.slice(mepPrintStart);

  assert.match(mepPrintCss, /\.mepTplSheet\s*\{[\s\S]*width:\s*var\(--mep-page-w\)/);
  assert.match(mepPrintCss, /\.mepTplSheet\s*\{[\s\S]*min-width:\s*var\(--mep-page-w\)/);
  assert.match(mepPrintCss, /\.mepTplSheet\s*\{[\s\S]*max-width:\s*var\(--mep-page-w\)/);
  assert.match(mepPrintCss, /\.mepTplSheet\s*\{[\s\S]*height:\s*var\(--mep-page-h\)/);
  assert.match(mepPrintCss, /\.mepTplSheet\s*\{[\s\S]*min-height:\s*var\(--mep-page-h\)/);
  assert.match(mepPrintCss, /\.mepTplSheet\s*\{[\s\S]*max-height:\s*var\(--mep-page-h\)/);
  assert.match(mepPrintCss, /\.mepTplSheet\s*\{[\s\S]*box-sizing:\s*border-box/);
  assert.match(mepPrintCss, /\.mepTplSheet\s*\{[\s\S]*break-inside:\s*avoid-page/);
  assert.match(mepPrintCss, /\.mepTplSheet\s*\{[\s\S]*break-after:\s*page/);
  assert.doesNotMatch(mepPrintCss, /\.mepTplSheet\s*\{[^}]*break-inside:\s*auto/);
  assert.doesNotMatch(mepPrintCss, /\.mepTplSheet\s*\{[^}]*(?:width|height):\s*calc\([^;]*-\s*1mm/);
});

test('buildOverviewPdfBlobFromCanvases uses the full page width without height-based shrinking', () => {
  const firstBlock = createCanvas(1000, 1200, 'block-1');
  const secondBlock = createCanvas(1000, 1000, 'block-2');

  const result = ctx.buildOverviewPdfBlobFromCanvases([firstBlock, secondBlock], { jsPdfCtor: MockPdf });
  const actionTypes = result.actions.map((action) => action.type);

  assert.deepEqual(actionTypes, ['addImage', 'addPage', 'addImage']);
  assert.equal(result.actions[0].x, 8);
  assert.equal(result.actions[0].y, 8);
  assert.equal(result.actions[1].orientation, 'portrait');
  assert.equal(result.actions[0].width, 194);
  assert.equal(result.actions[0].height, 232.8);
  assert.equal(result.actions[2].width, 194);
  assert.equal(result.actions[2].height, 194);
});

test('buildOverviewPdfBlobFromCanvases continues an exceptionally tall week at readable width', () => {
  const tallBlock = createCanvas(1000, 1500, 'tall-week');
  const crops = [];
  const canvasFactory = () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (...args) => crops.push(args.slice(1, 5))
    }),
    toDataURL() {
      return `data:image/png;base64,slice-${this.height}`;
    }
  });

  const result = ctx.buildOverviewPdfBlobFromCanvases([tallBlock], { jsPdfCtor: MockPdf, canvasFactory });

  assert.deepEqual(result.actions.map((action) => action.type), ['addImage', 'addPage', 'addImage']);
  assert.equal(result.actions[0].width, 194);
  assert.ok(result.actions[0].height <= 281);
  assert.equal(result.actions[2].width, 194);
  assert.deepEqual(crops, [
    [0, 0, 1000, 1448],
    [0, 1448, 1000, 52]
  ]);
});

test('formatOverviewPdfTimestamp records the PDF creation time for page metadata', () => {
  const createdAt = new Date(2026, 8, 9, 8, 4);

  assert.equal(ctx.formatOverviewPdfTimestamp(createdAt), '09.09.2026 08:04');
  assert.equal(
    ctx.buildOverviewPdfStatusText('September 2026', createdAt),
    'September 2026 · Stand 09.09.2026 08:04'
  );
});

test('overview PDF and Drive upload are rebuilt from the current overview without a persistent snapshot', () => {
  const source = fs.readFileSync('pdf-export.js', 'utf8');
  const uploadStart = source.indexOf('async function uploadOverviewPdf()');
  const uploadSource = source.slice(uploadStart);

  assert.match(uploadSource, /const blob = await buildOverviewPdfBlob\(\)/);
  assert.doesNotMatch(source, /lastOverviewPdfCache|cacheLastOverviewPdf|getCachedOverviewPdf/);
});

test('shareOrDownloadPdfBlob does not start a download after native sharing was attempted', async () => {
  let shareCalls = 0;
  let downloadUrlCalls = 0;
  const shareError = new Error('Native share handoff failed');
  const deliveryContext = loadScripts(['pdf-export.js'], {
    Blob,
    File,
    navigator: {
      userAgent: 'iPhone',
      platform: 'iPhone',
      maxTouchPoints: 5,
      canShare: () => true,
      share: async () => {
        shareCalls += 1;
        throw shareError;
      }
    },
    URL: {
      createObjectURL: () => {
        downloadUrlCalls += 1;
        return 'blob:test';
      },
      revokeObjectURL() {}
    },
    window: {
      WOCHENPLAN_DRIVE_CONFIG: {},
      innerWidth: 1024,
      devicePixelRatio: 1
    }
  });

  await assert.rejects(
    deliveryContext.shareOrDownloadPdfBlob(new Blob(['pdf']), 'uebersicht-2026-09.pdf'),
    (error) => error.stage === 'delivery.share' && error.cause === shareError
  );
  assert.equal(shareCalls, 1);
  assert.equal(downloadUrlCalls, 0);
});

test('successful native sharing returns without starting the download fallback', async () => {
  let shareCalls = 0;
  let objectUrlCalls = 0;
  const deliveryContext = loadScripts(['pdf-export.js'], {
    Blob, File,
    navigator: {
      userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5,
      canShare: () => true,
      share: async () => { shareCalls += 1; }
    },
    URL: { createObjectURL: () => { objectUrlCalls += 1; }, revokeObjectURL() {} },
    window: { WOCHENPLAN_DRIVE_CONFIG: {}, innerWidth: 390, devicePixelRatio: 3 }
  });
  const result = await deliveryContext.shareOrDownloadPdfBlob(new Blob(['pdf']), 'mep.pdf');
  assert.deepEqual({ ...result }, { deliveryMethod: 'navigator.share' });
  assert.equal(shareCalls, 1);
  assert.equal(objectUrlCalls, 0);
});

test('AbortError from the share sheet is cancellation, not an export failure', async () => {
  let objectUrlCalls = 0;
  const abortError = new Error('cancelled');
  abortError.name = 'AbortError';
  const deliveryContext = loadScripts(['pdf-export.js'], {
    Blob, File,
    navigator: {
      userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5,
      canShare: () => true,
      share: async () => { throw abortError; }
    },
    URL: { createObjectURL: () => { objectUrlCalls += 1; }, revokeObjectURL() {} },
    window: { WOCHENPLAN_DRIVE_CONFIG: {}, innerWidth: 390, devicePixelRatio: 3 }
  });
  const result = await deliveryContext.shareOrDownloadPdfBlob(new Blob(['pdf']), 'mep.pdf');
  assert.equal(result.deliveryMethod, 'navigator.share');
  assert.equal(result.cancelled, true);
  assert.equal(objectUrlCalls, 0);
});

test('desktop delivery downloads the PDF Blob through an Object URL even when Web Share exists', async () => {
  let shared = 0;
  let clicked = 0;
  let appendedFile;
  let revokedUrl;
  const deliveryContext = loadScripts(['pdf-export.js'], {
    Blob, File,
    navigator: {
      userAgent: 'Desktop Browser', platform: 'Linux', maxTouchPoints: 0,
      canShare: () => true,
      share: async () => { shared += 1; }
    },
    URL: {
      createObjectURL(blob) {
        assert.equal(blob.type, 'application/pdf');
        return 'blob:pdf-download';
      },
      revokeObjectURL(url) { revokedUrl = url; }
    },
    document: {
      createElement: () => ({ click() { clicked += 1; }, remove() {} }),
      body: { appendChild(link) { appendedFile = link; } }
    },
    window: {
      WOCHENPLAN_DRIVE_CONFIG: {}, innerWidth: 1280, devicePixelRatio: 1,
      setTimeout(callback) { callback(); }
    }
  });

  const result = await deliveryContext.shareOrDownloadPdfBlob(
    new Blob(['pdf'], { type: 'application/pdf' }),
    'mep-2026-09.pdf'
  );
  assert.equal(shared, 0);
  assert.equal(clicked, 1);
  assert.equal(appendedFile.href, 'blob:pdf-download');
  assert.equal(appendedFile.download, 'mep-2026-09.pdf');
  assert.equal(revokedUrl, 'blob:pdf-download');
  assert.deepEqual({ ...result }, { deliveryMethod: 'link.click' });
});

test('MEP export has no print fallback and always removes its capture root in finally', () => {
  const source = fs.readFileSync('pdf-export.js', 'utf8');
  const start = source.indexOf('async function exportMepTemplatePdf()');
  const end = source.indexOf('async function exportOverviewPdf()', start);
  const exportSource = source.slice(start, end);

  assert.doesNotMatch(source, /offerMepExportFallback/);
  assert.doesNotMatch(exportSource, /window\.print\s*\(/);
  assert.match(exportSource, /finally\s*\{[\s\S]*removeMepPdfExportRoot\(exportRoot\)/);
});
