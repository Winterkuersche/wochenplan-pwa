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
    return {
      type,
      options: this.options,
      actions: this.actions
    };
  }
}

function createCanvas(width, height, label) {
  return {
    width,
    height,
    toDataURL() {
      return `data:image/png;base64,${label}`;
    }
  };
}

const ctx = loadScripts(['pdf-export.js'], {
  window: {
    WOCHENPLAN_DRIVE_CONFIG: {},
    jspdf: { jsPDF: MockPdf }
  }
});

test('buildMepPdfBlobFromCanvases creates one PDF page per canvas', () => {
  const pageOne = createCanvas(1000, 700, 'page-1');
  const pageTwo = createCanvas(1000, 700, 'page-2');

  const result = ctx.buildMepPdfBlobFromCanvases([pageOne, pageTwo], { jsPdfCtor: MockPdf });

  assert.equal(result.type, 'blob');
  assert.equal(result.options.orientation, 'landscape');
  assert.equal(result.options.unit, 'mm');
  assert.equal(result.options.format, 'a4');
  assert.equal(result.options.compress, true);

  const actionTypes = result.actions.map((action) => action.type);
  assert.deepEqual(actionTypes, ['addImage', 'addPage', 'addImage']);
  assert.equal(result.actions[0].width, 297);
  assert.equal(result.actions[0].height, 210);
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
      userAgent: '',
      platform: '',
      maxTouchPoints: 0,
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
    /Native share handoff failed/
  );
  assert.equal(shareCalls, 1);
  assert.equal(downloadUrlCalls, 0);
});
