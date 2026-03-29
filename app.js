function getMobileErrorPanelElements() {
  return {
    panel: document.getElementById("mobileErrorPanel"),
    text: document.getElementById("mobileErrorPanelText")
  };
}

function isMobileDebugPanelEnabled() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("debug") === "1";
  } catch {
    return false;
  }
}

function showMobileRuntimeError(details, options = {}) {
  const { force = false } = options;
  if (!force && !isMobileDebugPanelEnabled()) return;

  const { panel, text } = getMobileErrorPanelElements();
  if (!panel || !text) return;

  const nextMessage = [
    `Zeit: ${new Date().toISOString()}`,
    `Fehler: ${details.message || "Unbekannter Fehler"}`,
    `Datei: ${details.file || "-"}`,
    `Zeile: ${details.line || "-"}`,
    details.column ? `Spalte: ${details.column}` : ""
  ].filter(Boolean).join("\n");

  text.textContent = `${nextMessage}\n\n${text.textContent || ""}`.trim();
  panel.classList.remove("hidden");
}

window.addEventListener("error", (event) => {
  showMobileRuntimeError({
    message: event.message,
    file: event.filename,
    line: event.lineno,
    column: event.colno
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message = typeof reason === "string"
    ? reason
    : reason?.message || JSON.stringify(reason);

  showMobileRuntimeError({
    message,
    file: reason?.fileName || reason?.sourceURL || "",
    line: reason?.line || reason?.lineNumber || ""
  });
});

document.title = `${APP_META.name} ${APP_META.version}`;

const appTitleEl = document.getElementById("app-title");
if (appTitleEl) {
  appTitleEl.textContent = `${APP_META.name} ${APP_META.version}`;
}

const DAYS = [
  { key: "mo", label: "Mo", full: "Montag" },
  { key: "di", label: "Di", full: "Dienstag" },
  { key: "mi", label: "Mi", full: "Mittwoch" },
  { key: "do", label: "Do", full: "Donnerstag" },
  { key: "fr", label: "Fr", full: "Freitag" },
  { key: "sa", label: "Sa", full: "Samstag" },
  { key: "so", label: "So", full: "Sonntag" }
];

const ROLE_OPTIONS = [
  { key: "", label: "-", target: "", contractModel: "" },
  { key: "TL", label: "TL", target: "30:00", contractModel: "VZ30" },
  { key: "TZ30", label: "TZ30", target: "30:00", contractModel: "TZ30" },
  { key: "TZ20", label: "TZ20", target: "20:00", contractModel: "TZ20" },
  { key: "TZ15", label: "TZ15", target: "15:00", contractModel: "TZ15" },
  { key: "GFB", label: "GfB", target: "9:30", contractModel: "" }
];


const MASTER_KEY = "wochenplan_master_v10";
const PLAN_KEY = "wochenplan_plan_v10";
const UI_KEY = "wochenplan_ui_v10";
const BACKUP_INTERNAL_KEY = "wochenplan_import_backup_v1";
const LAST_BACKUP_BEFORE_IMPORT_KEY = "wochenplan_last_backup_before_import_v1";
const BACKUP_META_KEY = "wochenplan_backup_meta_v1";
const BACKUP_MEP_CALIBRATION_KEY = "mep-calibration";
const LAST_SAVED_AT_KEY = "wochenplan_last_saved_at_v1";
const AUTOSAVE_DELAY_MS = 600;
const MAX_WEEKLY_MINUTES = 159 * 60;

let currentDayIndex = 0;
let autoSaveTimerId = null;
let saveStatusTimerId = null;
let saveStatusMessage = "";
let saveStatusHasError = false;
let responsiveViewRefreshTimerIds = [];
let lastMepFitMetricsKey = "";
let lastResponsiveViewRefreshView = "";
let hasTriggeredPageShowResponsiveRefresh = false;
let responsiveRefreshTraceCounter = 0;

function createResponsiveRefreshTraceId() {
  responsiveRefreshTraceCounter += 1;
  return `mep-refresh-${Date.now()}-${responsiveRefreshTraceCounter}`;
}

function logResponsiveRefreshTrace(traceId, stage, payload = {}) {
  console.debug(`[responsive-mep][${traceId}] ${stage}`, payload);
}

function sanitizeCurrentView(view) {
  if (view === "form") return "mep";
  if (["day", "week", "month", "mep"].includes(view)) return view;
  return "week";
}

function sanitizeUiState(rawUi) {
  const mergedUi = { ...defaultUiState(), ...(rawUi || {}) };
  return {
    ...mergedUi,
    currentView: sanitizeCurrentView(mergedUi.currentView),
    mepAnonymized: Boolean(mergedUi.mepAnonymized)
  };
}

function isResponsiveEmbeddedViewActive() {
  const currentView = uiState?.currentView || "week";
  return currentView === "mep";
}

function updateAppViewportHeightVar() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;

  const onePercent = viewportHeight * 0.01;
  document.documentElement.style.setProperty("--app-vh", `${onePercent}px`);
  document.documentElement.style.setProperty("--app-dvh", `${viewportHeight}px`);
}

function updateEmbeddedViewMaxHeightVar(selector, cssVar) {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const targetEl = document.querySelector(selector);

  if (!targetEl || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    document.documentElement.style.removeProperty(cssVar);
    return;
  }

  const rect = targetEl.getBoundingClientRect();
  const topOffset = Math.max(rect.top, 0);
  const availableHeight = Math.max(240, Math.floor(viewportHeight - topOffset - 12));

  document.documentElement.style.setProperty(cssVar, `${availableHeight}px`);
}

function updateResponsiveViewportMetrics() {
  updateAppViewportHeightVar();
  updateEmbeddedViewMaxHeightVar("#mepTemplateView", "--mep-template-view-max-height");
}

function getMepFitMetricsKey() {
  const viewEl = document.getElementById("mepTemplateView");
  const pagesEl = document.getElementById("mepTemplatePages");
  const viewportWidth = Math.round(window.visualViewport?.width || window.innerWidth || 0);
  const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || 0);
  const viewRect = viewEl?.getBoundingClientRect?.() || null;
  const pagesRect = pagesEl?.getBoundingClientRect?.() || null;

  return [
    viewportWidth,
    viewportHeight,
    window.screen?.orientation?.type || window.orientation || "",
    viewRect ? `${Math.round(viewRect.width)}x${Math.round(viewRect.height)}@${Math.round(viewRect.top)}` : "",
    pagesRect ? `${Math.round(pagesRect.width)}x${Math.round(pagesRect.height)}` : "",
    pagesEl?.childElementCount || 0
  ].join("|");
}

function shouldRefreshMepTemplateView(options = {}) {
  const { force = false, traceId = "no-trace" } = options;
  if ((uiState?.currentView || "week") !== "mep") return false;
  if (typeof renderMepTemplateView !== "function") return false;

  const metricsKey = getMepFitMetricsKey();
  const metricsChanged = metricsKey !== lastMepFitMetricsKey;

  logResponsiveRefreshTrace(traceId, "metrics-check", {
    force,
    metricsChanged,
    previousKey: lastMepFitMetricsKey,
    nextKey: metricsKey
  });

  if (!force && !metricsChanged) return false;

  lastMepFitMetricsKey = metricsKey;
  return true;
}

function renderMepTemplateResponsiveView(options = {}) {
  const { traceId = "no-trace" } = options;
  logResponsiveRefreshTrace(traceId, "render-start", { scope: "month" });
  renderMepTemplateView({ scope: "month" });
  logResponsiveRefreshTrace(traceId, "render-end");
}

function runMepPostRenderSync(options = {}) {
  const {
    traceId = "no-trace",
    postRenderSync = null
  } = options;

  if (typeof postRenderSync !== "function") return;
  logResponsiveRefreshTrace(traceId, "post-render-sync-start");
  postRenderSync();
  logResponsiveRefreshTrace(traceId, "post-render-sync-end");
}

function refreshMepTemplateViewIfMetricsChanged(options = {}) {
  const { traceId = "no-trace" } = options;
  if (!shouldRefreshMepTemplateView(options)) {
    logResponsiveRefreshTrace(traceId, "refresh-skip");
    return false;
  }

  renderMepTemplateResponsiveView(options);
  runMepPostRenderSync(options);
  return true;
}

function refreshCurrentResponsiveView(options = {}) {
  const { traceId = "no-trace" } = options;
  const currentView = uiState?.currentView || "week";

  logResponsiveRefreshTrace(traceId, "refresh-current-view", { currentView });
  if (currentView === "mep") {
    return refreshMepTemplateViewIfMetricsChanged(options);
  }

  return false;
}

function waitForAnimationFrames(frameCount = 2) {
  return new Promise((resolve) => {
    const tick = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }

      window.requestAnimationFrame(() => tick(remaining - 1));
    };

    tick(frameCount);
  });
}

function updatePrintButtonLabel() {
  if (!btnPrintEl) return;
  const view = uiState?.currentView || "week";
  btnPrintEl.textContent = view === "mep" ? "Monat als PDF exportieren" : "Drucken / PDF";
}

function buildMepPdfFilename() {
  const monthValue = state.activeMonth || (state.weekFrom || new Date().toISOString().slice(0, 10)).slice(0, 7);
  return `mep-${String(monthValue).replace(/[^0-9-]+/g, "-")}.pdf`;
}

function copyMepLayoutVariablesToNode(targetNode) {
  if (!targetNode) return;

  const sourceStyle = window.getComputedStyle(document.documentElement);
  [
    "--mep-sheet-inner-height",
    "--mep-header-height",
    "--mep-footer-height",
    "--mep-bottom-gap",
    "--mep-table-head-height",
    "--mep-employees-per-sheet",
  ].forEach((varName) => {
    const value = sourceStyle.getPropertyValue(varName).trim();
    if (value) {
      targetNode.style.setProperty(varName, value);
    }
  });
}

function createMepPdfExportRoot() {
  const pagesEl = document.getElementById("mepTemplatePages");
  if (!pagesEl) return null;

  const exportRoot = document.createElement("div");
  Object.assign(exportRoot.style, {
    position: "fixed",
    left: "-200vw",
    top: "0",
    width: "297mm",
    padding: "0",
    margin: "0",
    background: "#fff",
    zIndex: "-1",
    pointerEvents: "none"
  });

  const clonePagesEl = pagesEl.cloneNode(true);
  clonePagesEl.style.display = "block";
  clonePagesEl.style.gap = "0";

  clonePagesEl.querySelectorAll(".mepTplSheet").forEach((sheetEl) => {
    sheetEl.style.margin = "0";
    sheetEl.style.breakAfter = "page";
    sheetEl.style.pageBreakAfter = "always";
  });

  const lastSheetEl = clonePagesEl.querySelector(".mepTplSheet:last-child");
  if (lastSheetEl) {
    lastSheetEl.style.breakAfter = "auto";
    lastSheetEl.style.pageBreakAfter = "auto";
  }

  exportRoot.appendChild(clonePagesEl);
  copyMepLayoutVariablesToNode(exportRoot);
  document.body.appendChild(exportRoot);

  if (typeof syncMepOutsideRunMarkers === "function") {
    syncMepOutsideRunMarkers(clonePagesEl);
  }

  return exportRoot;
}

function isIosLikeDevice() {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchPoints = Number(navigator.maxTouchPoints || 0);

  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && touchPoints > 1);
}

function buildMepExportDebugContext(context = {}) {
  const mergedContext = {
    windowInnerWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    isIosLikeDevice: isIosLikeDevice(),
    ...context
  };

  return {
    ...mergedContext,
    currentExportStep: mergedContext.currentExportStep || "init",
    currentSheetIndex: Number.isFinite(mergedContext.currentSheetIndex) ? mergedContext.currentSheetIndex : -1,
    currentPageNumber: Number.isFinite(mergedContext.currentSheetIndex) ? mergedContext.currentSheetIndex + 1 : null,
    totalSheets: Number.isFinite(mergedContext.totalSheets) ? mergedContext.totalSheets : 0,
    currentScale: mergedContext.currentScale || null
  };
}

function logMepExportError(message, error, context = {}) {
  const debugContext = buildMepExportDebugContext(context);
  console.error(message, {
    error,
    currentExportStep: debugContext.currentExportStep,
    currentPageNumber: debugContext.currentPageNumber,
    currentSheetIndex: debugContext.currentSheetIndex,
    currentScale: debugContext.currentScale,
    windowInnerWidth: debugContext.windowInnerWidth,
    devicePixelRatio: debugContext.devicePixelRatio,
    totalSheets: debugContext.totalSheets,
    isIosLikeDevice: debugContext.isIosLikeDevice,
    deliveryMethod: debugContext.deliveryMethod || null,
    filename: debugContext.filename || null
  });
}

function buildMepExportUserMessage(context = {}) {
  const debugContext = buildMepExportDebugContext(context);
  const failedPageHint = debugContext.currentPageNumber
    ? ` Abbruch bei Seite ${debugContext.currentPageNumber} von ${debugContext.totalSheets || "?"}.`
    : "";
  const mobileHint = debugContext.windowInnerWidth <= 820 || debugContext.isIosLikeDevice
    ? " Auf Mobilgeräten kann der Monats-Export zu groß sein."
    : "";

  return `PDF-Export fehlgeschlagen.${failedPageHint}${mobileHint} Bitte Browser-Druckansicht öffnen oder auf Wochenansicht wechseln und dort exportieren.`;
}

function offerMepExportFallback(context = {}) {
  const message = `${buildMepExportUserMessage(context)}

Fallback jetzt öffnen?`;
  const shouldOpenPrint = window.confirm(message);

  if (shouldOpenPrint) {
    window.print();
    return;
  }

  alert("Tipp: Wechsle zur Wochenansicht und nutze dort 'Drucken / PDF', falls der Monats-Export auf diesem Gerät zu groß ist.");
}

async function shareOrDownloadPdfBlob(blob, filename) {
  const file = new File([blob], filename, { type: "application/pdf" });
  const isIos = isIosLikeDevice();
  const canShareFiles = Boolean(navigator.canShare?.({ files: [file] }));

  console.info("MEP PDF Zustellung gestartet", {
    filename,
    isIosLikeDevice: isIos,
    canShareFiles,
    hasNavigatorShare: typeof navigator.share === "function"
  });

  if (canShareFiles && typeof navigator.share === "function") {
    try {
      await navigator.share({
        files: [file],
        title: "MEP PDF",
        text: "MEP als PDF"
      });
      return { deliveryMethod: "navigator.share" };
    } catch (error) {
      logMepExportError("MEP PDF Teilen via navigator.share fehlgeschlagen", error, {
        currentExportStep: "share:navigator.share",
        filename,
        deliveryMethod: "navigator.share"
      });
    }
  } else if (isIos) {
    console.info("MEP PDF Teilen via navigator.share nicht verfügbar", {
      filename,
      canShareFiles,
      hasNavigatorShare: typeof navigator.share === "function"
    });
  }

  const blobUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);

    try {
      link.click();
      return { deliveryMethod: "link.click" };
    } catch (error) {
      logMepExportError("MEP PDF Download via link.click fehlgeschlagen", error, {
        currentExportStep: "share:link.click",
        filename,
        deliveryMethod: "link.click"
      });
    } finally {
      link.remove();
    }

    const popup = window.open(blobUrl, "_blank", "noopener");
    if (popup) {
      return { deliveryMethod: "window.open" };
    }

    const openError = new Error("window.open hat kein Fenster geöffnet.");
    logMepExportError("MEP PDF Öffnen via window.open fehlgeschlagen", openError, {
      currentExportStep: "share:window.open",
      filename,
      deliveryMethod: "window.open"
    });

    throw openError;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}

async function exportMepTemplatePdf() {
  const jsPdfCtor = window.jspdf?.jsPDF;
  const captureFn = window.html2canvas;

  if (typeof jsPdfCtor !== "function" || typeof captureFn !== "function") {
    alert("PDF-Export ist noch nicht verfügbar. Bitte Seite neu laden und erneut versuchen.");
    return;
  }

  const previousView = uiState?.currentView || "week";
  const restoreView = previousView !== "mep";
  const originalButtonLabel = btnPrintEl?.textContent || "Drucken / PDF";
  let exportRoot = null;
  const exportState = buildMepExportDebugContext({
    currentExportStep: "prepare",
    currentSheetIndex: -1,
    currentScale: null,
    totalSheets: 0,
    filename: buildMepPdfFilename()
  });

  const runExportAttempt = async (sheetEls, scale, attemptLabel) => {
    exportState.currentScale = scale;
    exportState.currentExportStep = `pdf:init:${attemptLabel}`;

    const pdf = new jsPdfCtor({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true
    });

    for (let index = 0; index < sheetEls.length; index += 1) {
      const sheetEl = sheetEls[index];
      exportState.currentSheetIndex = index;
      exportState.currentExportStep = `render:${attemptLabel}`;

      let canvas;
      try {
        canvas = await captureFn(sheetEl, {
          backgroundColor: "#ffffff",
          scale,
          useCORS: true
        });
      } catch (error) {
        logMepExportError(`MEP-Seite ${index + 1} konnte nicht gerendert werden`, error, exportState);
        throw new Error(`Rendern von Seite ${index + 1} fehlgeschlagen.`, { cause: error });
      }

      if (index > 0) {
        pdf.addPage("a4", "landscape");
      }

      exportState.currentExportStep = `pdf.addImage:${attemptLabel}`;
      try {
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 297, 210, undefined, "FAST");
      } catch (error) {
        logMepExportError(`pdf.addImage für Seite ${index + 1} fehlgeschlagen`, error, exportState);
        throw new Error(`PDF-Bild für Seite ${index + 1} konnte nicht eingefügt werden.`, { cause: error });
      }
    }

    exportState.currentExportStep = `pdf.output:${attemptLabel}`;
    let blob;
    try {
      blob = pdf.output("blob");
    } catch (error) {
      logMepExportError("pdf.output('blob') fehlgeschlagen", error, exportState);
      throw new Error("PDF-Datei konnte nicht erzeugt werden.", { cause: error });
    }

    exportState.currentExportStep = `shareOrDownload:${attemptLabel}`;
    try {
      const deliveryResult = await shareOrDownloadPdfBlob(blob, exportState.filename);
      exportState.deliveryMethod = deliveryResult?.deliveryMethod || null;
    } catch (error) {
      logMepExportError("shareOrDownloadPdfBlob fehlgeschlagen", error, exportState);
      throw new Error("PDF wurde erstellt, konnte aber nicht auf dem Gerät geöffnet oder geteilt werden.", {
        cause: error
      });
    }
  };

  try {
    if (btnPrintEl) {
      btnPrintEl.disabled = true;
      btnPrintEl.textContent = "PDF wird erstellt …";
    }

    if (restoreView) {
      uiState.currentView = "mep";
      renderView();
      renderAllViews();
    } else if (typeof renderMepTemplateView === "function") {
      renderMepTemplateView({ scope: "month" });
    }

    await waitForAnimationFrames(3);

    exportState.currentExportStep = "prepare:clone";
    exportRoot = createMepPdfExportRoot();
    if (!exportRoot) {
      throw new Error("MEP-Exportansicht nicht gefunden.");
    }

    await waitForAnimationFrames(2);

    const sheetEls = [...exportRoot.querySelectorAll(".mepTplSheet")];
    exportState.totalSheets = sheetEls.length;
    if (!sheetEls.length) {
      throw new Error("Keine MEP-Seiten zum Export gefunden.");
    }

    const exportScale = 2;
    await runExportAttempt(sheetEls, exportScale, "default");
  } catch (error) {
    logMepExportError("PDF-Export fehlgeschlagen", error, exportState);
    offerMepExportFallback(exportState);
  } finally {
    exportRoot?.remove();

    if (restoreView) {
      uiState.currentView = previousView;
      renderView();
      renderAllViews();
    }

    if (btnPrintEl) {
      btnPrintEl.disabled = false;
      updatePrintButtonLabel();
      if (!restoreView && originalButtonLabel && btnPrintEl.textContent !== originalButtonLabel) {
        updatePrintButtonLabel();
      }
    }
  }
}

function scheduleResponsiveViewRefresh(options = {}) {
  const {
    delays = [120],
    force = false,
    postRenderSync = null,
    traceId = createResponsiveRefreshTraceId()
  } = options;

  responsiveViewRefreshTimerIds.forEach((timerId) => window.clearTimeout(timerId));
  responsiveViewRefreshTimerIds = [];
  let hasRenderedInBatch = false;

  logResponsiveRefreshTrace(traceId, "schedule", { delays, force });

  delays.forEach((delay) => {
    const safeDelay = Number.isFinite(delay) ? Math.max(0, delay) : 0;
    const timerId = window.setTimeout(() => {
      responsiveViewRefreshTimerIds = responsiveViewRefreshTimerIds.filter((id) => id !== timerId);
      if (!isResponsiveEmbeddedViewActive()) {
        logResponsiveRefreshTrace(traceId, "timer-skip-inactive", { delay: safeDelay });
        return;
      }

      // Akzeptanzkriterium: Portrait/Querformat dürfen anders zoomen, aber
      // pro Seite muss der Footer in beiden Modi stabil bleiben (kein Tabellen-Drift nach unten).
      // Deshalb nur auf stabilen Triggern neu fitten und nur bei geänderten Containermaßen rendern.
      const shouldForceFit = force && !hasRenderedInBatch;
      updateResponsiveViewportMetrics();
      const hasRendered = refreshCurrentResponsiveView({
        force: shouldForceFit,
        traceId,
        postRenderSync
      });
      hasRenderedInBatch = hasRenderedInBatch || hasRendered;
      logResponsiveRefreshTrace(traceId, "timer-run", {
        delay: safeDelay,
        force: shouldForceFit,
        hasRendered,
        hasRenderedInBatch
      });
    }, safeDelay);

    responsiveViewRefreshTimerIds.push(timerId);
  });
}

function requestActiveResponsiveViewRefresh(options = {}) {
  const { force = false } = options;
  const currentView = uiState?.currentView || "week";
  const switchedToMep = currentView === "mep" && lastResponsiveViewRefreshView !== "mep";
  lastResponsiveViewRefreshView = currentView;

  if (currentView !== "mep") return;
  if (!force && !switchedToMep) return;

  scheduleResponsiveViewRefresh({ force: true });
}

let warnedUnknownShiftCodes = null;

const startupMutableHelpers = {
  warnedUnknownShiftCodes: null
};

function isStartupSelfTestEnabled() {
  const isDebugFlagEnabled = isMobileDebugPanelEnabled();
  const hostName = (window.location?.hostname || "").toLowerCase();
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(hostName);
  const isLocalFile = window.location?.protocol === "file:";
  return isDebugFlagEnabled || isLocalHost || isLocalFile;
}

function runStartupSelfTest() {
  if (!isStartupSelfTestEnabled()) return;

  const globalChecks = [
    ["getShiftRuleByCode", typeof getShiftRuleByCode === "function"],
    ["normalizeShiftCode", typeof normalizeShiftCode === "function"],
    ["warnedUnknownShiftCodes", "warnedUnknownShiftCodes" in startupMutableHelpers]
  ];

  const failedChecks = globalChecks.filter(([, ok]) => !ok);
  if (!failedChecks.length) return;

  const missingNames = failedChecks.map(([name]) => name).join(", ");
  throw new Error(`Startup-Selbsttest fehlgeschlagen. Fehlende Globals: ${missingNames}`);
}

function getWarnedUnknownShiftCodesSet() {
  if (!(startupMutableHelpers.warnedUnknownShiftCodes instanceof Set)) {
    startupMutableHelpers.warnedUnknownShiftCodes = new Set();
  }
  warnedUnknownShiftCodes = startupMutableHelpers.warnedUnknownShiftCodes;
  return startupMutableHelpers.warnedUnknownShiftCodes;
}

runStartupSelfTest();
const loadedAppState = loadAppState();
let uiState = loadedAppState.ui;
let state = loadedAppState.state;
let lastSavedAt = loadedAppState.lastSavedAt;
state.schedule = state.schedule || {};
state.absences = state.absences || [];

/* ========= PLAN API ========= */

function ensureScheduleDay(isoDate) {
  if (!state.schedule) state.schedule = {};
  if (!state.schedule[isoDate]) state.schedule[isoDate] = {};
  return state.schedule[isoDate];
}

function normalizePlanEntry(entry) {
  // status is unified via status-utils.js
  if (!entry || typeof entry !== "object") return null;

  const entryStatus = getEntryStatus(entry);
  const isExternalHelp = entryStatus === ENTRY_STATUS.EXTERNAL || Boolean(entry.externalHelp);
  const isVacation = entryStatus === ENTRY_STATUS.VACATION;
  const isShiftWork = entryStatus === ENTRY_STATUS.WORK && !isExternalHelp;
  const type = isExternalHelp
    ? "external-help"
    : isVacation
      ? "vacation"
      : entryStatus === ENTRY_STATUS.WORK
        ? "shift"
        : "off";
  const status = entryStatus;

  const start = isValidHHMM(entry.start || "")
    ? normalizePlanTime(entry.start)
    : "";
  const end = isValidHHMM(entry.end || "")
    ? normalizePlanTime(entry.end)
    : "";

  const rawCode = normalizeShiftCode(entry.shiftKey || entry.code || "");
  const explicitRule = getShiftRuleByCode(rawCode);
  const foRule = getShiftRuleByCode("FO");
  const isFoFallbackWindowMatch = isShiftWork
    && !explicitRule
    && start === "08:55"
    && Boolean(end)
    && Array.isArray(foRule?.endPolicy?.options)
    && foRule.endPolicy.options.includes(end);
  const rule = isFoFallbackWindowMatch ? foRule : explicitRule;

  const manualRawPause = Number(entry.pause ?? entry.breakMinutes ?? 0) || 0;
  const isKnownRuleBasedShift = isShiftWork && rule?.entryType === "shift" && rule.code !== "FLEX";
  const isFlexibleShift = isShiftWork && rule?.entryType === "shift" && rule.code === "FLEX";
  const spanMinutes = start && end ? diffMinutesBetweenHHMM(start, end) : 0;
  const hasValidSpan = spanMinutes > 0;

  let rawPause = manualRawPause;
  if (isKnownRuleBasedShift) {
    if (rule.breakPolicy?.type === "checkout-dependent") {
      const hasCheckout = end === "19:10" || Boolean(entry.withCheckout);
      rawPause = hasCheckout
        ? Number(rule.breakPolicy.withCheckout || 0)
        : Number(rule.breakPolicy.withoutCheckout || 0);
    } else {
      rawPause = Number(rule.breakPolicy?.baseMinutes || 0);
    }
  } else if (isFlexibleShift && hasValidSpan) {
    const requiredFlexPause = getBreakMinutesForFlexibleShift(start, end);
    const normalizedManualPause = normalizeBusinessBreakMinutes(manualRawPause);
    const isManualPausePlausible = Number.isFinite(manualRawPause)
      && normalizedManualPause >= requiredFlexPause
      && normalizedManualPause < spanMinutes;
    rawPause = isManualPausePlausible ? normalizedManualPause : requiredFlexPause;
  }

  const pause = isExternalHelp
    ? 0
    : start && end
      ? getBusinessRequiredBreakMinutes(start, end, rawPause, {
        includeBillingBonus: end === "19:10"
      })
      : normalizeBusinessBreakMinutes(rawPause);

  let minutes = 0;
  const hasValidTimeRange = Boolean(start && end);
  const parsedEntryMinutes = typeof entry.minutes === "number"
    ? entry.minutes
    : typeof entry.minutes === "string" && isValidHHMM(entry.minutes)
      ? parseTimeToMinutes(entry.minutes)
      : null;
  const calculatedWorkedMinutes = hasValidTimeRange
    ? normalizeMinutesToQuarterHour(Math.max(0, diffMinutesBetweenHHMM(start, end) - pause))
    : null;

  if (isVacation) {
    minutes = 0;
  } else if (isShiftWork && hasValidTimeRange) {
    minutes = calculatedWorkedMinutes;
  } else if (hasValidTimeRange) {
    minutes = isExternalHelp
      ? normalizeMinutesToQuarterHour(getExternalHelpWorkedMinutes(start, end))
      : calculatedWorkedMinutes;
  } else if (parsedEntryMinutes !== null) {
    minutes = normalizeMinutesToQuarterHour(parsedEntryMinutes);
  }

  if (isShiftWork && calculatedWorkedMinutes !== null) {
    const normalizedStoredMinutes = parsedEntryMinutes !== null
      ? normalizeMinutesToQuarterHour(parsedEntryMinutes)
      : null;
    if (normalizedStoredMinutes !== null && normalizedStoredMinutes !== calculatedWorkedMinutes) {
      minutes = calculatedWorkedMinutes;
    }
  }

  const warnedUnknownCodes = getWarnedUnknownShiftCodesSet();
  if (isShiftWork && rawCode && !explicitRule && !isFoFallbackWindowMatch && !warnedUnknownCodes.has(rawCode)) {
    warnedUnknownCodes.add(rawCode);
    console.warn(`[schedule] Unbekannter Schichtcode '${rawCode}', Eintrag wird als generische Schicht normalisiert.`);
  }

  const derivedShiftKey = isFoFallbackWindowMatch ? "FO" : (rule?.code || rawCode || "");
  const normalizedMode = entry.mode || entry.shiftType || rule?.mode || "";
  const normalizedShiftType = entry.shiftType || entry.mode || rule?.shiftType || "";

  let normalizedCode = isFoFallbackWindowMatch
    ? "FO"
    : (entry.code || derivedShiftKey);
  if (rule?.code === "L" && start) {
    normalizedCode = getLateShiftCodeFromStart(start);
  } else if (rule?.code === "FO") {
    normalizedCode = "FO";
  }

  let normalizedLabel = entry.label || "";
  if (!normalizedLabel && isExternalHelp) {
    normalizedLabel = "AH";
  } else if (!normalizedLabel && isVacation) {
    normalizedLabel = "U";
  } else if (rule?.code === "FLEX") {
    normalizedLabel = `${start || "00:00"}-${end || "00:00"}`;
  } else if (rule?.label) {
    normalizedLabel = rule.label;
  } else if (!normalizedLabel) {
    normalizedLabel = normalizedCode || derivedShiftKey || "";
  }

  return {
    ...entry,
    type,
    status,
    shiftKey: derivedShiftKey,
    shiftType: normalizedShiftType,
    code: normalizedCode,
    mode: normalizedMode,
    start,
    end,
    pause,
    breakMinutes: pause,
    note: entry.note || "",
    branch: entry.branch || "",
    externalHelp: isExternalHelp,
    minutes,
    label: normalizedLabel
  };
}

function isVacationScheduleEntry(entry) {
  return isVacationEntry(entry);
}

function setVacationEntry(employeeId, isoDate, options = {}) {
  if (!employeeId || !isoDate) return null;

  return updateEmployeeDay(
    employeeId,
    isoDate,
    () => ({
      type: "vacation",
      status: ENTRY_STATUS.VACATION,
      label: "U",
      minutes: 0,
      note: options.note || ""
    }),
    { commit: options.commit !== false }
  );
}

function clearVacationEntry(employeeId, isoDate, options = {}) {
  const current = getPlanEntry(employeeId, isoDate);
  if (!isVacationScheduleEntry(current)) return;
  clearPlanEntry(employeeId, isoDate, options);
}

function syncVacationScheduleFromAbsences(employeeId = null) {
  const targetEmployeeIds = employeeId
    ? [employeeId]
    : state.employees.map((emp) => emp.id);

  targetEmployeeIds.forEach((empId) => {
    Object.entries(state.schedule || {}).forEach(([isoDate, dayEntries]) => {
      if (!dayEntries || !dayEntries[empId]) return;
      if (isVacationScheduleEntry(dayEntries[empId])) {
        delete dayEntries[empId];
        cleanupScheduleDay(isoDate);
      }
    });

    (state.absences || [])
      .filter((entry) => entry?.employeeId === empId && entry.type === "vacation")
      .forEach((entry) => {
        let cursor = entry.from;

        while (cursor <= entry.to) {
          setVacationEntry(empId, cursor, { commit: false, note: entry.note || "" });
          cursor = shiftIsoDateByDays(cursor, 1);
        }
      });
  });
}

function getUsedVacationDaysFromScheduleForEmployee(employeeId, year = new Date().getFullYear()) {
  if (!employeeId || !year) return 0;

  return Object.entries(state.schedule || {}).reduce((sum, [isoDate, dayEntries]) => {
    if (!isoDate.startsWith(`${year}-`)) return sum;
    if (!isWorkdayForVacation(isoDate)) return sum;

    const entry = dayEntries?.[employeeId];
    return sum + (isVacationScheduleEntry(entry) ? 1 : 0);
  }, 0);
}

function refreshEmployeeVacationCounters(year = new Date().getFullYear()) {
  state.employees.forEach((emp) => {
    const totalVacationDays = Number(emp.totalVacationDays ?? emp.vacationDays ?? 30) || 0;
    const usedVacationDays = getUsedVacationDaysFromScheduleForEmployee(emp.id, year);
    const remainingVacationDays = totalVacationDays - usedVacationDays;

    emp.totalVacationDays = totalVacationDays;
    emp.vacationDays = totalVacationDays;
    emp.usedVacationDays = usedVacationDays;
    emp.remainingVacationDays = remainingVacationDays;
  });
}

function normalizeSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") return {};

  const normalized = {};

  Object.entries(schedule).forEach(([isoDate, dayEntries]) => {
    if (!dayEntries || typeof dayEntries !== "object") return;

    const nextDay = {};

    Object.entries(dayEntries).forEach(([employeeId, entry]) => {
      const normalizedEntry = normalizePlanEntry(entry);
      if (normalizedEntry) {
        nextDay[employeeId] = normalizedEntry;
      }
    });

    if (Object.keys(nextDay).length > 0) {
      normalized[isoDate] = nextDay;
    }
  });

  return normalized;
}

function validateNormalizedSchedule(schedule, options = {}) {
  const { logWarnings = false } = options;

  if (!schedule || typeof schedule !== "object") {
    return { schedule: {}, report: { correctedEntries: 0 } };
  }

  const report = { correctedEntries: 0 };
  const validatedSchedule = {};

  Object.entries(schedule).forEach(([isoDate, dayEntries]) => {
    if (!dayEntries || typeof dayEntries !== "object") return;

    const nextDay = {};

    Object.entries(dayEntries).forEach(([employeeId, entry]) => {
      if (!entry || typeof entry !== "object") return;

      const nextEntry = { ...entry };
      const start = nextEntry.start;
      const end = nextEntry.end;

      if (start && end) {
        const span = diffMinutesBetweenHHMM(start, end);
        const pauseMinutes = Number(nextEntry.pause ?? nextEntry.breakMinutes ?? 0) || 0;
        const expectedMinutes = normalizeMinutesToQuarterHour(Math.max(0, span - pauseMinutes));
        const parsedStoredMinutes = Number(nextEntry.minutes);
        const storedMinutes = Number.isFinite(parsedStoredMinutes)
          ? normalizeMinutesToQuarterHour(parsedStoredMinutes)
          : 0;

        if (storedMinutes !== expectedMinutes) {
          nextEntry.minutes = expectedMinutes;
          report.correctedEntries += 1;

          if (logWarnings) {
            console.warn(
              `[schedule-validation] korrigiert ${isoDate}/${employeeId}: gespeichert=${storedMinutes}, erwartet=${expectedMinutes}`
            );
          }
        }
      }

      nextDay[employeeId] = nextEntry;
    });

    if (Object.keys(nextDay).length > 0) {
      validatedSchedule[isoDate] = nextDay;
    }
  });

  return {
    schedule: validatedSchedule,
    report
  };
}

function cleanupScheduleDay(isoDate) {
  const day = state.schedule?.[isoDate];
  if (!day) return;

  if (Object.keys(day).length === 0) {
    delete state.schedule[isoDate];
  }
}

function getScheduleEntry(employeeId, isoDate) {
  return getPlanEntry(employeeId, isoDate);
}

function getPlanEntry(employeeId, isoDate) {
  if (!employeeId || !isoDate) return null;
  const entry = state.schedule?.[isoDate]?.[employeeId] || null;
  return normalizePlanEntry(entry);
}

function getScheduleEntrySafe(employeeId, isoDate) {
  return getScheduleEntry(employeeId, isoDate);
}

function getEmployeeDayEntry(employeeId, isoDate) {
  return getScheduleEntrySafe(employeeId, isoDate);
}

function hasEmployeeWorkEntry(employeeId, isoDate) {
  const entry = getEmployeeDayEntry(employeeId, isoDate);
  if (!entry) return false;

  const status = getEntryStatus(entry);
  return status === ENTRY_STATUS.WORK || status === ENTRY_STATUS.EXTERNAL;
}

function updateEmployeeDay(employeeId, isoDate, updater, options = {}) {
  if (!employeeId || !isoDate || typeof updater !== "function") return null;

  const { commit = true } = options;
  const currentEntry = getPlanEntry(employeeId, isoDate);
  const nextEntry = updater(currentEntry ? { ...currentEntry } : null);

  if (nextEntry == null) {
    if (state.schedule?.[isoDate]?.[employeeId]) {
      delete state.schedule[isoDate][employeeId];
      cleanupScheduleDay(isoDate);
    }

    if (commit) {
      commitPlanChange();
    }

    return null;
  }

  const normalizedEntry = normalizePlanEntry(nextEntry);

  if (!normalizedEntry) {
    if (state.schedule?.[isoDate]?.[employeeId]) {
      delete state.schedule[isoDate][employeeId];
      cleanupScheduleDay(isoDate);
    }

    if (commit) {
      commitPlanChange();
    }

    return null;
  }

  const day = ensureScheduleDay(isoDate);
  day[employeeId] = normalizedEntry;

  if (commit) {
    commitPlanChange();
  }

  return day[employeeId];
}

function setScheduleEntry(employeeId, isoDate, entry) {
  return setPlanEntry(employeeId, isoDate, entry);
}

function setPlanEntry(employeeId, isoDate, entry) {
  if (!employeeId || !isoDate || !entry) return;
  return updateEmployeeDay(employeeId, isoDate, () => ({ ...entry }));
}

function clearScheduleEntry(employeeId, isoDate) {
  return clearPlanEntry(employeeId, isoDate);
}

function clearPlanEntry(employeeId, isoDate, options = {}) {
  if (!employeeId || !isoDate) return;
  return updateEmployeeDay(employeeId, isoDate, () => null, options);
}

function setShift(employeeId, isoDate, entryOrShiftKey) {
  let entry = entryOrShiftKey;

  if (typeof entryOrShiftKey === "string") {
    const normalizedShiftKey = normalizeShiftCode(entryOrShiftKey);
    if (normalizedShiftKey === "L") {
      entry = buildLateShiftEntry("13:00", true);
    } else if (normalizedShiftKey === "G") {
      entry = buildFullShiftEntry(true);
    } else {
      entry = buildEarlyShiftEntry(normalizedShiftKey);
    }
  }

  if (!entry || entry.type !== "shift") return;
  setScheduleEntry(employeeId, isoDate, entry);
}

function setExternalHelp(employeeId, isoDate, branch, minutes) {
  const normalizedMinutes = normalizeMinutesToQuarterHour(minutes);

  setPlanEntry(employeeId, isoDate, {
    type: "external-help",
    status: ENTRY_STATUS.EXTERNAL,
    label: "AH",
    branch,
    externalHelp: true,
    minutes: normalizedMinutes,
    pause: 0,
    breakMinutes: 0,
    start: "",
    end: ""
  });
}

function setAbsence(employeeId, from, to, type, note = "", options = {}) {
  const { commit = true } = options;
  const absence = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `abs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    employeeId,
    type,
    from,
    to,
    note
  };

  state.absences.push(absence);
  state.absences = normalizeAbsences(state.absences);

  if (commit) {
    commitPlanChange();
  }

  return absence;
}

function removeAbsence(absenceId) {
  state.absences = state.absences.filter((a) => a.id !== absenceId);

  commitPlanChange();
}
function clearDay(employeeId, isoDate, options = {}) {
  if (!employeeId || !isoDate) return;

  const { commit = true } = options;

 

  clearPlanEntry(employeeId, isoDate, { commit: false });

  removeAbsenceCoverageForEmployee(employeeId, isoDate, isoDate);
  syncVacationScheduleFromAbsences(employeeId);

  if (commit) {
    commitPlanChange();
  }
}
function commitPlanChange() {
  refreshEmployeeVacationCounters();
  saveAppStateDebounced();
  renderAllViews();
}

/* ========= DOM ========= */
const teamListEl = document.getElementById("teamList");
const dayTabsEl = document.getElementById("dayTabs");
const plannerListEl = document.getElementById("plannerList");
const metaDayNameEl = document.getElementById("metaDayName");
const dayWarningsEl = document.getElementById("dayWarnings");
const dayHoursInfoEl = document.getElementById("dayHoursInfo");
const weekTableBodyEl = document.getElementById("weekTableBody");
const weekWarningsEl = document.getElementById("weekWarnings");

const weekFromEl = document.getElementById("weekFrom");
const weekToEl = document.getElementById("weekTo");

const teamSectionEl = document.getElementById("teamSection");
const btnToggleTeamEl = document.getElementById("btnToggleTeam");
const btnAddEmployeeEl = document.getElementById("btnAddEmployee");

const weeklyHoursActualEl = document.getElementById("weeklyHoursActual");
const weeklyHoursRemainingEl = document.getElementById("weeklyHoursRemaining");
const weeklyHoursStatusEl = document.getElementById("weeklyHoursStatus");

const dayViewEl = document.getElementById("dayView");
const weekViewEl = document.getElementById("weekView");
const monthViewEl = document.getElementById("monthView");
const mepTemplateViewEl = document.getElementById("mepTemplateView");

const btnViewDayEl = document.getElementById("btnViewDay");
const btnViewWeekEl = document.getElementById("btnViewWeek");
const btnViewMonthEl = document.getElementById("btnViewMonth");
const btnViewMepEl = document.getElementById("btnViewMep");
const btnPrevWeekEl = document.getElementById("btnPrevWeek");
const btnCurrentWeekEl = document.getElementById("btnCurrentWeek");
const btnNextWeekEl = document.getElementById("btnNextWeek");
const viewMetaLineEl = document.getElementById("viewMetaLine");
const topToolbarEl = document.getElementById("topToolbar");
const btnResetWeekEl = document.getElementById("btnResetWeek");
const btnExportBackupEl = document.getElementById("btnExportBackup");
const btnImportBackupEl = document.getElementById("btnImportBackup");
const backupFileInputEl = document.getElementById("backupFileInput");
const backupInfoEl = document.getElementById("backupInfo");
const saveStatusEl = document.getElementById("saveStatus");
const btnPrintEl = document.getElementById("btnPrint");
const btnMepModeNormalEl = document.getElementById("btnMepModeNormal");
const btnMepModeAnonymEl = document.getElementById("btnMepModeAnonym");
const btnMoreActionsEl = document.getElementById("btnMoreActions");
const mobileMoreMenuPanelEl = document.getElementById("mobileMoreMenuPanel");
const manualMonthDialogOverlayEl = document.getElementById("manualMonthDialogOverlay");
const manualMonthDialogTitleEl = document.getElementById("manualMonthDialogTitle");
const manualMonthRowsEl = document.getElementById("manualMonthRows");
const manualMonthBulkInputEl = document.getElementById("manualMonthBulkInput");
const manualMonthValidationEl = document.getElementById("manualMonthValidation");
const btnManualMonthAddRowEl = document.getElementById("btnManualMonthAddRow");
const btnManualMonthApplyBulkEl = document.getElementById("btnManualMonthApplyBulk");
const btnManualMonthCancelEl = document.getElementById("btnManualMonthCancel");
const btnManualMonthSaveEl = document.getElementById("btnManualMonthSave");
let manualMonthDialogPreviousFocusEl = null;

const mepWeekFromEl = document.getElementById("mepWeekFrom");
const mepWeekToEl = document.getElementById("mepWeekTo");
const mepMonthYearEl = document.getElementById("mepMonthYear");

/* ========= HELPERS ========= */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function hmToMinutes(hm) {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToHM(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatSignedMinutes(min) {
  if (min === 0) return "0:00";
  return `${min > 0 ? "+" : "-"}${minutesToHM(Math.abs(min))}`;
}

function formatHMToQuarterLabel(hmValue) {
  if (typeof hmValue !== "string" || !/^\d{1,2}:\d{2}$/.test(hmValue.trim())) return hmValue || "";

  const [hoursText, minutesText] = hmValue.trim().split(":");
  const hours = String(Number(hoursText));
  const minutes = Number(minutesText);

  if (![0, 15, 30, 45].includes(minutes)) return `${hours}:${minutesText}`;

  const quarterLabelByMinute = {
    0: "00",
    15: "¼",
    30: "½",
    45: "¾"
  };

  return `${hours}:${quarterLabelByMinute[minutes]}`;
}

function formatMonthYear(dateStr) {
  if (!dateStr) return "____________";
  const d = fromIsoDate(dateStr);
  if (!d) return "____________";
  return `${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function roleToTarget(roleKey) {
  const found = ROLE_OPTIONS.find((r) => r.key === roleKey);
  return found?.target || "";
}

function roleToContractModel(roleKey) {
  const found = ROLE_OPTIONS.find((r) => r.key === roleKey);
  return found?.contractModel || "";
}

function normalizeYearMonth(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : "";
}

function isValidYearMonth(value) {
  return Boolean(normalizeYearMonth(value));
}

function normalizeManualMonthActualMinutes(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }

  return Object.entries(rawValue).reduce((acc, [yearMonth, minutes]) => {
    const normalizedYearMonth = normalizeYearMonth(yearMonth);
    const numericMinutes = Number(minutes);
    if (!normalizedYearMonth || !Number.isFinite(numericMinutes) || numericMinutes < 0) {
      return acc;
    }

    acc[normalizedYearMonth] = Math.round(numericMinutes);
    return acc;
  }, {});
}

function normalizeEmployee(employee, index = 0) {
  const roleKey = employee?.roleKey || "";

  return {
    id: employee?.id || `emp_${index + 1}`,
    name: employee?.name || "",
    roleKey,
    target: employee?.target || roleToTarget(roleKey),
    contractModel: employee?.contractModel || roleToContractModel(roleKey),
    contractTargetMinutesPerMonth: Number(employee?.contractTargetMinutesPerMonth) || 0,
    totalVacationDays: Number(employee?.totalVacationDays ?? employee?.vacationDays ?? 30),
    usedVacationDays: Number(employee?.usedVacationDays ?? 0),
    remainingVacationDays: Number(employee?.remainingVacationDays ?? employee?.vacationDays ?? 30),
    vacationDays: Number(employee?.totalVacationDays ?? employee?.vacationDays ?? 30),
    birthDate: employee?.birthDate || "",
    serviceBonus: Boolean(employee?.serviceBonus),
    activeFromMonth: normalizeYearMonth(employee?.activeFromMonth),
    activeToMonth: normalizeYearMonth(employee?.activeToMonth),
    manualMonthActualMinutes: normalizeManualMonthActualMinutes(employee?.manualMonthActualMinutes),
    shifts: {}
  };
}

function isEmployeeActiveInMonth(employee, yearMonth) {
  if (!employee) return false;

  const normalizedYearMonth = normalizeYearMonth(yearMonth);
  if (!normalizedYearMonth) return true;

  const activeFromMonth = normalizeYearMonth(employee.activeFromMonth);
  const activeToMonth = normalizeYearMonth(employee.activeToMonth);

  if (activeFromMonth && normalizedYearMonth < activeFromMonth) return false;
  if (activeToMonth && normalizedYearMonth > activeToMonth) return false;

  return true;
}

/* ========= STORAGE ========= */
function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function defaultUiState() {
  return {
    teamCollapsed: false,
    currentView: "week",
    mepAnonymized: false
  };
}

function loadUiState() {
  const rawUi = loadJson(UI_KEY, defaultUiState());
  const sanitizedUi = sanitizeUiState(rawUi);

  if (JSON.stringify(rawUi || {}) !== JSON.stringify(sanitizedUi)) {
    saveJson(UI_KEY, sanitizedUi);
  }

  return sanitizedUi;
}

function saveUiState() {
  return saveJson(UI_KEY, uiState);
}

function getLastSavedAt() {
  const value = loadJson(LAST_SAVED_AT_KEY, "");
  return typeof value === "string" ? value : "";
}

function updateSaveStatus(message, options = {}) {
  const { isError = false, hideAfterMs = 0 } = options;

  saveStatusMessage = message || "";
  saveStatusHasError = Boolean(isError);

  if (!saveStatusEl) return;

  saveStatusEl.textContent = saveStatusMessage;
  saveStatusEl.classList.toggle("isError", saveStatusHasError);

  if (saveStatusTimerId) {
    clearTimeout(saveStatusTimerId);
    saveStatusTimerId = null;
  }

  if (hideAfterMs > 0) {
    saveStatusTimerId = setTimeout(() => {
      saveStatusMessage = "";
      saveStatusHasError = false;
      saveStatusTimerId = null;
      refreshSaveStatusLabel();
    }, hideAfterMs);
  }
}

function refreshSaveStatusLabel() {
  if (saveStatusMessage) {
    updateSaveStatus(saveStatusMessage, { isError: saveStatusHasError });
    return;
  }

  const savedAt = getLastSavedAt();
  if (savedAt) {
    updateSaveStatus(`Zuletzt gespeichert: ${formatDateTimeForDisplay(savedAt)}`);
  } else {
    updateSaveStatus("Noch nicht gespeichert");
  }
}

function saveMasterData() {
  return saveJson(MASTER_KEY, {
    employees: state.employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      roleKey: emp.roleKey,
      target: emp.target,
      contractModel: emp.contractModel || "",
      contractTargetMinutesPerMonth: Number(emp.contractTargetMinutesPerMonth) || 0,
      totalVacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
      usedVacationDays: Number(emp.usedVacationDays ?? 0),
      remainingVacationDays: Number(emp.remainingVacationDays ?? emp.vacationDays ?? 30),
      vacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
      birthDate: emp.birthDate || "",
      serviceBonus: Boolean(emp.serviceBonus),
      activeFromMonth: normalizeYearMonth(emp.activeFromMonth),
      activeToMonth: normalizeYearMonth(emp.activeToMonth),
      manualMonthActualMinutes: normalizeManualMonthActualMinutes(emp.manualMonthActualMinutes)
    }))
  });
}

function savePlanData() {
  return saveJson(PLAN_KEY, {
    weekFrom: state.weekFrom,
    weekTo: state.weekTo,
    schedule: state.schedule || {},
    absences: state.absences || []
  });
}

function saveAppState() {
  const savedAt = new Date().toISOString();
  const masterSaved = saveMasterData();
  const planSaved = savePlanData();
  const uiSaved = saveUiState();
  const savedAtPersisted = saveJson(LAST_SAVED_AT_KEY, savedAt);

  if (masterSaved && planSaved && uiSaved && savedAtPersisted) {
    lastSavedAt = savedAt;
    updateSaveStatus("Gespeichert", { hideAfterMs: 2500 });
    return true;
  }

  updateSaveStatus("Speichern fehlgeschlagen", { isError: true, hideAfterMs: 4000 });
  return false;
}

function saveAppStateDebounced() {
  if (autoSaveTimerId) {
    clearTimeout(autoSaveTimerId);
  }

  autoSaveTimerId = setTimeout(() => {
    autoSaveTimerId = null;
    saveAppState();
  }, AUTOSAVE_DELAY_MS);
}

function flushPendingAutoSave() {
  if (!autoSaveTimerId) return;
  clearTimeout(autoSaveTimerId);
  autoSaveTimerId = null;
  saveAppState();
}

function loadAppState() {
  const rawPlan = loadJson(PLAN_KEY, defaultPlanState());
  const normalizedSchedule = rawPlan.schedule && typeof rawPlan.schedule === "object"
    ? normalizeSchedule(rawPlan.schedule)
    : {};
  const {
    schedule: validatedSchedule,
    report: scheduleValidationReport
  } = validateNormalizedSchedule(normalizedSchedule, { logWarnings: true });
  const shouldPersistNormalizedSchedule = JSON.stringify(rawPlan.schedule || {}) !== JSON.stringify(validatedSchedule);

  if (shouldPersistNormalizedSchedule) {
    saveJson(PLAN_KEY, {
      ...rawPlan,
      schedule: validatedSchedule
    });
  }

  return {
    ui: loadUiState(),
    state: buildInitialState({
      planOverride: {
        ...rawPlan,
        schedule: validatedSchedule
      }
    }),
    scheduleValidationReport,
    lastSavedAt: getLastSavedAt()
  };
}

/* ========= DEFAULT DATA ========= */
function createDefaultEmployees() {
  return [
    { id: "emp_1", name: "Stephan M", roleKey: "TL", target: "30:00", contractModel: "VZ30", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "", activeFromMonth: "", activeToMonth: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_2", name: "Mitarbeiter 2", roleKey: "TZ30", target: "30:00", contractModel: "TZ30", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "", activeFromMonth: "", activeToMonth: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_3", name: "Mitarbeiter 3", roleKey: "TZ20", target: "20:00", contractModel: "TZ20", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "", activeFromMonth: "", activeToMonth: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_4", name: "Mitarbeiter 4", roleKey: "TZ15", target: "15:00", contractModel: "TZ15", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "", activeFromMonth: "", activeToMonth: "",
  serviceBonus: false, shifts: {} },
    { id: "emp_5", name: "Mitarbeiter 5", roleKey: "TZ20", target: "20:00", contractModel: "TZ20", totalVacationDays: 30, usedVacationDays: 0, remainingVacationDays: 30, vacationDays: 30, birthDate: "", activeFromMonth: "", activeToMonth: "",
  serviceBonus: false, shifts: {} }
  ];
}

function defaultMasterState() {
  return {
    employees: createDefaultEmployees().map((emp) => ({
      id: emp.id,
      name: emp.name,
      roleKey: emp.roleKey,
      target: emp.target,
      contractModel: emp.contractModel || roleToContractModel(emp.roleKey || ""),
      contractTargetMinutesPerMonth: Number(emp.contractTargetMinutesPerMonth) || 0,
      totalVacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
      usedVacationDays: Number(emp.usedVacationDays ?? 0),
      remainingVacationDays: Number(emp.remainingVacationDays ?? emp.vacationDays ?? 30),
      vacationDays: Number(emp.totalVacationDays ?? emp.vacationDays ?? 30),
      birthDate: emp.birthDate,
      serviceBonus: emp.serviceBonus,
      activeFromMonth: normalizeYearMonth(emp.activeFromMonth),
      activeToMonth: normalizeYearMonth(emp.activeToMonth)
    }))
  };
}

function defaultPlanState() {
  return {
    weekFrom: "",
    weekTo: "",
    schedule: {},
    absences: []
  };
}
function buildInitialState(options = {}) {
  const master = loadJson(MASTER_KEY, defaultMasterState());
  const plan = options.planOverride || loadJson(PLAN_KEY, defaultPlanState());

  const baseEmployees = Array.isArray(master.employees)
    ? master.employees
    : defaultMasterState().employees;

 const employees = baseEmployees.map((emp, index) => normalizeEmployee(emp, index));

  const normalizedSchedule = plan.schedule && typeof plan.schedule === "object"
    ? normalizeSchedule(plan.schedule)
    : {};
  const { schedule } = validateNormalizedSchedule(normalizedSchedule);

  const absences = Array.isArray(plan.absences)
    ? normalizeAbsences(plan.absences)
    : [];

    return {
    weekFrom: plan.weekFrom || "",
    weekTo: plan.weekTo || "",
    monthPlan: null,
    activeMonth: (plan.weekFrom || toIsoDate(new Date())).slice(0, 7),
    employees,
    schedule,
    absences
  };
}


/* ========= MONTH ENGINE FALLBACK ========= */
function buildMonthPlanFallback(year, monthIndex) {
  const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);

  const gridStart = cloneDate(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - getMondayBasedDayIndex(firstOfMonth));

  const gridEnd = cloneDate(lastOfMonth);
  gridEnd.setDate(lastOfMonth.getDate() + (6 - getMondayBasedDayIndex(lastOfMonth)));

  const weeks = [];
  let cursor = cloneDate(gridStart);

  while (cursor <= gridEnd) {
    const week = [];

    for (let i = 0; i < 7; i++) {
      week.push({
        date: cloneDate(cursor),
        iso: toIsoDate(cursor),
        weekdayIndex: i,
        weekdayLabel: labels[i],
        inCurrentMonth: cursor.getMonth() === monthIndex,
        isOutsideMonth: cursor.getMonth() !== monthIndex
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push(week);
  }

  return {
    meta: {
      year,
      monthIndex,
      month: monthIndex + 1
    },
    weeks
  };
}

function getMonthPlanSafe(dateStr) {
  if (!dateStr) return null;

  if (typeof getMonthPlanFromDateString === "function") {
    return getMonthPlanFromDateString(dateStr);
  }

  const d = fromIsoDate(dateStr);
  if (!d) return null;

  return buildMonthPlanFallback(d.getFullYear(), d.getMonth());
}

/* ========= ACTIVE WEEK ========= */
function getActiveMonthPlan() {
  const activeMonth = state.activeMonth || (state.weekFrom || toIsoDate(new Date())).slice(0, 7);
  const [year, month] = activeMonth.split("-").map(Number);

  if (!year || !month) return null;

  return buildMonthPlanFallback(year, month - 1);
}

function syncMonthPlanToState() {
  state.monthPlan = getActiveMonthPlan();
  return state.monthPlan;
}

function getCurrentMonthWeeks() {
  return state.monthPlan?.weeks || [];
}

function getActiveWeekDays() {
  const weeks = getCurrentMonthWeeks();
  if (!weeks.length) return [];

  if (state.weekFrom) {
    const found = weeks.find((week) => week.some((day) => day.iso === state.weekFrom));
    if (found) return found;
  }

  return weeks[0];
}

function syncWeekRangeFromActiveWeek() {
  const week = getActiveWeekDays();
  if (!week.length) return;

  state.weekFrom = week[0].iso;
  state.weekTo = week[6].iso;

  if (weekFromEl) weekFromEl.value = state.weekFrom;
  if (weekToEl) weekToEl.value = state.weekTo;
}

function getDayObjectByIndex(index) {
  const week = getActiveWeekDays();
  return week[index] || null;
}

function getCurrentDayObject() {
  return getDayObjectByIndex(currentDayIndex);
}

function getCurrentDayIso() {
  return getCurrentDayObject()?.iso || "";
}

function shiftActiveWeek(days) {
  const date = fromIsoDate(state.weekFrom);
  if (!date) return;

  date.setDate(date.getDate() + days);
  state.weekFrom = toIsoDate(date);
  state.activeMonth = state.weekFrom.slice(0, 7);

  syncMonthPlanToState();
  syncWeekRangeFromActiveWeek();
  commitPlanChange();
}

/* ========= SHIFT HELPERS ========= */
function getShiftByKey(key) {
  const normalizedKey = normalizeShiftCode(key);
  const rule = getShiftRuleByCode(normalizedKey);

  if (!rule || rule.entryType !== "shift") {
    return { key: "-", type: "free" };
  }

  return {
    key: rule.code,
    type: rule.mode || "free"
  };
}

function getShiftClassByKey(key) {
  return getShiftByKey(key).type || "free";
}

function getShiftForEmployeeOnIso(emp, iso) {
  const entry = getEmployeeDayEntry(emp.id, iso);
  if (!entry) return "-";

  if (entry.type !== "shift") return "-";
  return entry.code || "-";
}


function shiftDurationMinutes(shiftKey) {
  const rule = getShiftRuleByCode(shiftKey);
  if (!rule || rule.entryType !== "shift") return 0;

  if (rule.startPolicy?.type !== "fixed" || rule.endPolicy?.type !== "fixed") return 0;

  return hhmmToMinutes(rule.endPolicy.value) - hhmmToMinutes(rule.startPolicy.value);
}

function appliedPauseMinutes(shiftKey) {
  const rule = getShiftRuleByCode(shiftKey);
  if (!rule || rule.entryType !== "shift") return 0;

  if (rule.breakPolicy?.type === "configured") {
    return Number(rule.breakPolicy.baseMinutes || 0);
  }

  return 0;
}

function netMinutesForShift(shiftKey) {
  const duration = shiftDurationMinutes(shiftKey);
  if (!duration) return 0;
  return Math.max(0, duration - appliedPauseMinutes(shiftKey));
}

/* ========= CALCULATIONS ========= */
function getResolvedEntryForEmployeeOnIso(emp, isoDate) {
  return getResolvedDayEntry({
    employee: emp,
    isoDate,
    schedule: state.schedule,
    absences: state.absences,
    stateKey: APP_META.stateKey
  });
}

function getResolvedLabelForEmployeeOnIso(emp, isoDate) {
  return getResolvedEntryForEmployeeOnIso(emp, isoDate).label;
}
function getBlockingTypeForEmployeeOnIso(emp, isoDate) {
  const resolved = getResolvedEntryForEmployeeOnIso(emp, isoDate);

  if (!resolved) return null;
  const status = getResolvedStatus(resolved);

  if (status === ENTRY_STATUS.VACATION) return ENTRY_STATUS.VACATION;
  if (status === ENTRY_STATUS.SICK) return ENTRY_STATUS.SICK;
  if (resolved.type === "holiday") return "holiday";

  return null;
}

function isEmployeeBlockedOnIso(emp, isoDate) {
  return Boolean(getBlockingTypeForEmployeeOnIso(emp, isoDate));
}

function isDayInYearMonth(day, yearMonth) {
  if (!day || typeof day.iso !== "string") return false;
  const normalizedYearMonth = normalizeYearMonthValue(yearMonth);
  if (!normalizedYearMonth) return true;
  return getYearMonthFromIsoDate(day.iso) === normalizedYearMonth;
}

function getDaysInYearMonth(days = [], yearMonth = state.activeMonth) {
  if (!Array.isArray(days)) return [];
  return days.filter((day) => isDayInYearMonth(day, yearMonth));
}

function totalMinutesForEmployeeInWeek(emp, weekDays) {
  return weekDays.reduce((sum, day) => {
    if (!day) return sum;
    return sum + getResolvedEntryForEmployeeOnIso(emp, day.iso).minutesForMonth;
  }, 0);
}

function totalMinutesForEmployee(emp) {
  return totalMinutesForEmployeeInWeek(emp, getActiveWeekDays());
}

function deltaMinutes(emp) {
  return totalMinutesForEmployee(emp) - hmToMinutes(emp.target || "0:00");
}

function isCreditableResolvedWorkEntry(resolvedEntry) {
  const status = getResolvedStatus(resolvedEntry);
  return status === ENTRY_STATUS.WORK || status === ENTRY_STATUS.EXTERNAL;
}

function isCreditableResolvedAccountEntry(resolvedEntry) {
  const status = getResolvedStatus(resolvedEntry);

  if (status === ENTRY_STATUS.WORK || status === ENTRY_STATUS.EXTERNAL || status === ENTRY_STATUS.SICK || status === ENTRY_STATUS.VACATION) {
    return true;
  }

  return resolvedEntry?.type === "holiday";
}

function getEmployeeTargetMinutes(employee) {
  if (!employee) return 0;
  return hmToMinutes(employee.target || "0:00");
}

function isGfbEmployee(employee) {
  if (!employee) return false;
  return String(employee.roleKey || "").trim().toUpperCase() === "GFB";
}

function getEmployeeContractTargetMinutesPerMonth(employee) {
  if (!employee) return 0;

  if (isGfbEmployee(employee)) {
    return 43 * 60;
  }

  const individualTargetMinutes = Number(employee.contractTargetMinutesPerMonth);
  if (Number.isFinite(individualTargetMinutes) && individualTargetMinutes > 0) {
    return Math.round(individualTargetMinutes);
  }

  const contractModelTargetMinutes = getContractModelTargetMinutesPerMonth(employee.contractModel || employee.roleKey || "");
  if (Number.isFinite(contractModelTargetMinutes) && contractModelTargetMinutes > 0) {
    return Math.round(contractModelTargetMinutes);
  }

  const weeklyTargetMinutes = getEmployeeTargetMinutes(employee);
  if (weeklyTargetMinutes > 0) {
    return Math.round((weeklyTargetMinutes * 52) / 12);
  }

  return 0;
}

function getEmployeePlannedMinutesForWeek(employee, weekDays = getActiveWeekDays()) {
  if (!employee || !Array.isArray(weekDays)) return 0;

  return weekDays.reduce((sum, day) => {
    if (!day) return sum;

    const resolved = getResolvedEntryForEmployeeOnIso(employee, day.iso);
    if (!isCreditableResolvedWorkEntry(resolved)) return sum;

    return sum + Math.max(0, resolved.minutesForMonth || 0);
  }, 0);
}

function getEmployeeTargetMinutesForWeek(employee, weekDays = getActiveWeekDays(), yearMonth = state.activeMonth) {
  if (!employee || !Array.isArray(weekDays)) return 0;

  const dailyTargetMinutes = getAbsenceMinutesForEmployee(employee);
  const eligibleWeekDays = getDaysInYearMonth(weekDays, yearMonth);

  return eligibleWeekDays.reduce((sum, day) => {
    if (!day) return sum;
    if (isSundayIsoDate(day.iso)) return sum;
    return sum + dailyTargetMinutes;
  }, 0);
}

function getEmployeeAccountMinutesForWeek(employee, weekDays = getActiveWeekDays(), yearMonth = state.activeMonth) {
  if (!employee || !Array.isArray(weekDays)) return 0;

  const eligibleWeekDays = getDaysInYearMonth(weekDays, yearMonth);

  return eligibleWeekDays.reduce((sum, day) => {
    if (!day) return sum;

    const resolved = getResolvedEntryForEmployeeOnIso(employee, day.iso);
    const status = getResolvedStatus(resolved);

    if (!isCreditableResolvedAccountEntry(resolved)) {
      return sum;
    }

    if (status === ENTRY_STATUS.VACATION) {
      return sum + getAbsenceMinutesForEmployee(employee);
    }

    if (resolved?.type === "holiday") {
      return sum + Math.max(0, resolved.minutesForMonth || getAbsenceMinutesForEmployee(employee));
    }

    return sum + Math.max(0, resolved.minutesForMonth || 0);
  }, 0);
}

function getEmployeeWeekDifferenceMinutes(employee, weekDays = getActiveWeekDays(), yearMonth = state.activeMonth) {
  const accountMinutes = getEmployeeAccountMinutesForWeek(employee, weekDays, yearMonth);

  if (isGfbEmployee(employee)) {
    return Math.max(0, accountMinutes);
  }

  const targetMinutes = getEmployeeTargetMinutesForWeek(employee, weekDays, yearMonth);
  return accountMinutes - targetMinutes;
}

function getEmployeeMinusMinutesForWeek(employee, weekDays = getActiveWeekDays(), yearMonth = state.activeMonth) {
  const difference = getEmployeeWeekDifferenceMinutes(employee, weekDays, yearMonth);
  return difference < 0 ? Math.abs(difference) : 0;
}

function formatMinuteBalance(differenceMinutes) {
  if (differenceMinutes >= 0) return "0:00";
  return `-${minutesToHM(Math.abs(differenceMinutes))}`;
}


function getEmployeeContractTargetMinutesForDays(employee, days = []) {
  if (!employee || !Array.isArray(days)) return 0;

  const dailyTargetMinutes = getAbsenceMinutesForEmployee(employee);

  return days.reduce((sum, day) => {
    if (!day || day.isOutsideMonth) return sum;
    if (isSundayIsoDate(day.iso)) return sum;
    return sum + dailyTargetMinutes;
  }, 0);
}

function getEmployeeContractTargetMinutesForWeeks(employee, weeks = getCurrentMonthWeeks()) {
  if (!employee || !Array.isArray(weeks)) return 0;

  return getEmployeeContractTargetMinutesPerMonth(employee);
}

function getEmployeeAccountMinutesForWeeks(employee, weeks = getCurrentMonthWeeks(), yearMonth = state.activeMonth) {
  if (!employee || !Array.isArray(weeks)) return 0;

  return weeks.reduce((sum, week) => {
    if (!Array.isArray(week) || week.length === 0) return sum;
    return sum + getEmployeeAccountMinutesForWeek(employee, getDaysInYearMonth(week, yearMonth), yearMonth);
  }, 0);
}

function getEmployeeAccountMinutesForMonth(employee, yearMonth = state.activeMonth) {
  if (!employee) return 0;

  const monthWeeks = getWeeksForYearMonth(yearMonth);
  if (!monthWeeks.length) return 0;

  return getEmployeeAccountMinutesForWeeks(employee, monthWeeks, yearMonth);
}

function normalizeYearMonthValue(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!isValidYearMonth(trimmed)) return "";
  return trimmed;
}

function getYearMonthFromIsoDate(isoDate) {
  if (typeof isoDate !== "string" || isoDate.length < 7) return "";
  return normalizeYearMonthValue(isoDate.slice(0, 7));
}

function shiftYearMonthByMonths(yearMonth, offsetMonths = 0) {
  const normalized = normalizeYearMonthValue(yearMonth);
  if (!normalized) return "";

  const [year, month] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return "";

  date.setMonth(date.getMonth() + Number(offsetMonths || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getWeeksForYearMonth(yearMonth) {
  const normalized = normalizeYearMonthValue(yearMonth);
  if (!normalized) return [];

  const [year, month] = normalized.split("-").map(Number);
  if (!year || !month) return [];

  return buildMonthPlanFallback(year, month - 1).weeks || [];
}

// Historische Saldo-Berechnung startet fachlich bewusst ab 2026-01.
const BALANCE_HISTORY_START_MONTH = "2026-01";

function getRelevantYearMonthsUntilActiveMonth(employee = null) {
  const activeYearMonth = normalizeYearMonthValue(state.activeMonth || "") || getYearMonthFromIsoDate(state.weekFrom || "") || getYearMonthFromIsoDate(toIsoDate(new Date()));
  if (!activeYearMonth) return [];

  if (typeof collectRelevantYearMonthsUntilActiveMonthBalance === "function") {
    return collectRelevantYearMonthsUntilActiveMonthBalance({
      activeYearMonth,
      scheduleIsoDates: Object.keys(state.schedule || {}),
      absences: state.absences || [],
      manualMonthActualMinutes: employee?.manualMonthActualMinutes || {},
      historyStartMonth: BALANCE_HISTORY_START_MONTH
    });
  }

  const candidates = [activeYearMonth];

  Object.keys(state.schedule || {}).forEach((isoDate) => {
    const yearMonth = getYearMonthFromIsoDate(isoDate);
    if (yearMonth && yearMonth >= BALANCE_HISTORY_START_MONTH && yearMonth <= activeYearMonth) candidates.push(yearMonth);
  });

  (state.absences || []).forEach((entry) => {
    const fromMonth = getYearMonthFromIsoDate(entry?.from || "");
    const toMonth = getYearMonthFromIsoDate(entry?.to || "");

    if (fromMonth && fromMonth >= BALANCE_HISTORY_START_MONTH && fromMonth <= activeYearMonth) candidates.push(fromMonth);
    if (toMonth && toMonth >= BALANCE_HISTORY_START_MONTH && toMonth <= activeYearMonth) candidates.push(toMonth);
  });

  if (employee?.manualMonthActualMinutes && typeof employee.manualMonthActualMinutes === "object") {
    Object.keys(employee.manualMonthActualMinutes).forEach((yearMonth) => {
      const normalized = normalizeYearMonthValue(yearMonth);
      if (normalized && normalized >= BALANCE_HISTORY_START_MONTH && normalized <= activeYearMonth) {
        candidates.push(normalized);
      }
    });
  }

  const unique = [...new Set(candidates)].sort();
  if (!unique.length) return [activeYearMonth];

  const firstDetectedMonth = unique[0];
  const first = firstDetectedMonth < BALANCE_HISTORY_START_MONTH
    ? BALANCE_HISTORY_START_MONTH
    : firstDetectedMonth;
  const months = [];
  let cursor = first;

  while (cursor && cursor <= activeYearMonth) {
    months.push(cursor);
    cursor = shiftYearMonthByMonths(cursor, 1);
  }

  return months;
}

function getEmployeeRunningBalanceMinutesUntilActiveMonth(employee) {
  if (!employee) return 0;

  return getRelevantYearMonthsUntilActiveMonth(employee).reduce((sum, yearMonth) => {
    const weeks = getWeeksForYearMonth(yearMonth);
    if (!weeks.length) return sum;

    const accountMinutes = getEmployeeActualMinutesForMonth(employee, yearMonth);
    const contractTargetMinutes = getEmployeeContractTargetMinutesPerMonth(employee);

    return sum + (accountMinutes - contractTargetMinutes);
  }, 0);
}

function getEmployeeTotalMinusMinutes(employee) {
  if (!employee) return 0;
  if (isGfbEmployee(employee)) return 0;

  const runningBalanceMinutes = getEmployeeRunningBalanceMinutesUntilActiveMonth(employee);
  return runningBalanceMinutes < 0 ? Math.abs(runningBalanceMinutes) : 0;
}

function getEmployeeMonthDifferenceMinutes(employee, yearMonth = state.activeMonth) {
  if (!employee) return 0;

  const monthWeeks = getWeeksForYearMonth(yearMonth);
  if (!monthWeeks.length) return 0;

  const accountMinutes = getEmployeeActualMinutesForMonth(employee, yearMonth);
  const contractTargetMinutes = getEmployeeContractTargetMinutesPerMonth(employee);

  if (isGfbEmployee(employee)) {
    return Math.max(0, accountMinutes);
  }

  return accountMinutes - contractTargetMinutes;
}

function getEmployeeMonthContingentRemainingMinutes(employee, yearMonth = state.activeMonth) {
  if (!employee) return 0;
  if (!isGfbEmployee(employee)) return 0;

  const accountMinutes = getEmployeeActualMinutesForMonth(employee, yearMonth);
  const contractTargetMinutes = getEmployeeContractTargetMinutesPerMonth(employee);
  return Math.max(0, contractTargetMinutes - accountMinutes);
}

function getEmployeeMonthContingentOveruseMinutes(employee, yearMonth = state.activeMonth) {
  if (!employee) return 0;
  if (!isGfbEmployee(employee)) return 0;

  const accountMinutes = getEmployeeActualMinutesForMonth(employee, yearMonth);
  const contractTargetMinutes = getEmployeeContractTargetMinutesPerMonth(employee);
  return Math.max(0, accountMinutes - contractTargetMinutes);
}

function getManualMonthActualMinutes(employee, yearMonth) {
  if (!employee) return null;
  const normalizedYearMonth = normalizeYearMonthValue(yearMonth);
  if (!normalizedYearMonth) return null;

  const minutes = employee.manualMonthActualMinutes?.[normalizedYearMonth];
  const numericMinutes = Number(minutes);
  if (!Number.isFinite(numericMinutes) || numericMinutes < 0) return null;
  return Math.round(numericMinutes);
}

function setManualMonthActualMinutes(employee, yearMonth, minutes) {
  if (!employee) return false;
  const normalizedYearMonth = normalizeYearMonthValue(yearMonth);
  const numericMinutes = Number(minutes);
  if (!normalizedYearMonth || !Number.isFinite(numericMinutes) || numericMinutes < 0) return false;

  employee.manualMonthActualMinutes = normalizeManualMonthActualMinutes(employee.manualMonthActualMinutes);
  employee.manualMonthActualMinutes[normalizedYearMonth] = Math.round(numericMinutes);
  return true;
}

function removeManualMonthActualMinutes(employee, yearMonth) {
  if (!employee) return false;
  const normalizedYearMonth = normalizeYearMonthValue(yearMonth);
  if (!normalizedYearMonth) return false;
  if (!employee.manualMonthActualMinutes || typeof employee.manualMonthActualMinutes !== "object") {
    employee.manualMonthActualMinutes = {};
    return false;
  }

  const existed = Object.prototype.hasOwnProperty.call(employee.manualMonthActualMinutes, normalizedYearMonth);
  delete employee.manualMonthActualMinutes[normalizedYearMonth];
  return existed;
}

function isMonthActualManual(employee, yearMonth) {
  return getManualMonthActualMinutes(employee, yearMonth) !== null;
}

function getEffectiveMonthActualMinutes(employee, yearMonth = state.activeMonth, plannedMinutes = null) {
  const manualMinutes = getManualMonthActualMinutes(employee, yearMonth);
  if (manualMinutes !== null) return manualMinutes;

  if (Number.isFinite(plannedMinutes) && plannedMinutes >= 0) {
    return Math.round(plannedMinutes);
  }

  return getEmployeeAccountMinutesForMonth(employee, yearMonth);
}

// Public API (derzeit): getEmployeeActualMinutesForMonth.
// TODO (Folgesprint): auf eine einzige zentrale öffentliche Funktion reduzieren,
// damit kein Drift zwischen "effective" und "actual" Benennung entsteht.
function getEmployeeActualMinutesForMonth(employee, yearMonth = state.activeMonth) {
  const plannedMinutes = getEmployeeAccountMinutesForMonth(employee, yearMonth);
  return getEffectiveMonthActualMinutes(employee, yearMonth, plannedMinutes);
}

function parseManualHoursToMinutes(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+):([0-5]\d)$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatManualMonthRows(entries = []) {
  if (!manualMonthRowsEl) return;

  manualMonthRowsEl.innerHTML = "";

  entries.forEach((entry) => {
    const tr = document.createElement("tr");
    tr.className = "manualMonthRow";

    const monthTd = document.createElement("td");
    monthTd.dataset.label = "Monat (YYYY-MM)";
    const monthInput = document.createElement("input");
    monthInput.type = "month";
    monthInput.className = "manualMonthInput";
    monthInput.value = normalizeYearMonth(entry?.yearMonth);
    monthInput.placeholder = "YYYY-MM";
    monthTd.appendChild(monthInput);

    const hoursTd = document.createElement("td");
    hoursTd.dataset.label = "Iststunden (HH:MM)";
    const hoursInput = document.createElement("input");
    hoursInput.type = "text";
    hoursInput.className = "manualMonthInput";
    hoursInput.placeholder = "HH:MM";
    hoursInput.value = typeof entry?.minutes === "number" ? minutesToHM(entry.minutes) : "";
    hoursTd.appendChild(hoursInput);

    const removeTd = document.createElement("td");
    removeTd.dataset.label = "Aktion";
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "manualMonthRemoveBtn";
    removeButton.textContent = "Löschen";
    removeButton.addEventListener("click", () => {
      tr.remove();
      if (!manualMonthRowsEl.querySelector("tr")) {
        addManualMonthDialogRow();
      }
    });
    removeTd.appendChild(removeButton);

    tr.append(monthTd, hoursTd, removeTd);
    manualMonthRowsEl.appendChild(tr);
  });
}

function addManualMonthDialogRow(defaults = {}) {
  if (!manualMonthRowsEl) return;

  const currentRows = [...manualMonthRowsEl.querySelectorAll("tr.manualMonthRow")].map((tr) => ({
    yearMonth: tr.querySelector("td:nth-child(1) input")?.value || "",
    minutes: parseManualHoursToMinutes(tr.querySelector("td:nth-child(2) input")?.value || "")
  }));

  currentRows.push({
    yearMonth: normalizeYearMonth(defaults.yearMonth) || "",
    minutes: typeof defaults.minutes === "number" ? defaults.minutes : null
  });

  formatManualMonthRows(currentRows);
}

function closeManualMonthDialog() {
  if (!manualMonthDialogOverlayEl) return;
  manualMonthDialogOverlayEl.classList.add("hidden");
  manualMonthDialogOverlayEl.setAttribute("aria-hidden", "true");
  manualMonthDialogOverlayEl.dataset.employeeId = "";
  if (manualMonthBulkInputEl) manualMonthBulkInputEl.value = "";
  if (manualMonthValidationEl) manualMonthValidationEl.textContent = "";
  manualMonthDialogPreviousFocusEl?.focus?.();
  manualMonthDialogPreviousFocusEl = null;
}

function applyManualMonthBulkInput() {
  if (!manualMonthBulkInputEl || !manualMonthRowsEl) return;

  const parsed = parseManualMonthBulkInput(manualMonthBulkInputEl.value || "");
  if (parsed.lineErrors?.length) {
    if (manualMonthValidationEl) {
      manualMonthValidationEl.style.color = "";
      manualMonthValidationEl.textContent = parsed.lineErrors[0];
    }
    return;
  }

  const existing = collectAndValidateManualMonthDialogRows();
  if (existing.error) {
    if (manualMonthValidationEl) {
      manualMonthValidationEl.style.color = "";
      manualMonthValidationEl.textContent = existing.error;
    }
    return;
  }

  const merged = {
    ...(existing.value || {}),
    ...(parsed.values || {})
  };
  const entries = Object.entries(merged)
    .map(([yearMonth, minutes]) => ({ yearMonth, minutes }))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  formatManualMonthRows(entries.length ? entries : [{ yearMonth: state.activeMonth, minutes: null }]);

  if (manualMonthValidationEl) {
    manualMonthValidationEl.style.color = "#1f6f3f";
    manualMonthValidationEl.textContent = Object.keys(parsed.values || {}).length
      ? `${Object.keys(parsed.values || {}).length} Monate aus Bulk-Paste übernommen.`
      : "Kein Bulk-Inhalt erkannt.";
  }
}

function collectAndValidateManualMonthDialogRows() {
  const rows = [...manualMonthRowsEl.querySelectorAll("tr.manualMonthRow")];
  const normalizedMap = {};

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const monthValue = row.querySelector("td:nth-child(1) input")?.value || "";
    const hoursValue = row.querySelector("td:nth-child(2) input")?.value || "";
    const isEmptyRow = !monthValue.trim() && !hoursValue.trim();
    if (isEmptyRow) continue;

    if (!isValidYearMonth(monthValue)) {
      return { error: `Zeile ${index + 1}: Monat muss YYYY-MM sein.` };
    }

    const minutes = parseManualHoursToMinutes(hoursValue);
    if (minutes === null || minutes < 0) {
      return { error: `Zeile ${index + 1}: Iststunden müssen im Format HH:MM (>= 0) sein.` };
    }

    normalizedMap[normalizeYearMonth(monthValue)] = minutes;
  }

  return { value: normalizedMap };
}

function saveManualMonthDialog() {
  if (!manualMonthDialogOverlayEl) return;

  const employeeId = manualMonthDialogOverlayEl.dataset.employeeId || "";
  const employee = state.employees.find((emp) => emp.id === employeeId);
  if (!employee) {
    closeManualMonthDialog();
    return;
  }

  const result = collectAndValidateManualMonthDialogRows();
  if (result.error) {
    if (manualMonthValidationEl) {
      manualMonthValidationEl.style.color = "";
      manualMonthValidationEl.textContent = result.error;
    }
    return;
  }

  const existingMonths = Object.keys(employee.manualMonthActualMinutes || {});
  existingMonths.forEach((yearMonth) => {
    removeManualMonthActualMinutes(employee, yearMonth);
  });

  Object.entries(result.value || {}).forEach(([yearMonth, minutes]) => setManualMonthActualMinutes(employee, yearMonth, minutes));

  saveAppStateDebounced();
  renderAllViews();
  renderTeamSetup();
  closeManualMonthDialog();
}

function openManualMonthDialog(employee) {
  if (!employee || !manualMonthDialogOverlayEl || !manualMonthRowsEl) return;

  manualMonthDialogOverlayEl.dataset.employeeId = employee.id || "";
  if (manualMonthDialogTitleEl) {
    manualMonthDialogTitleEl.textContent = `Monats-Iststunden für ${employee.name || "Mitarbeiter"}`;
  }
  if (manualMonthValidationEl) {
    manualMonthValidationEl.textContent = "";
    manualMonthValidationEl.style.color = "";
  }
  if (manualMonthBulkInputEl) manualMonthBulkInputEl.value = "";

  const entries = Object.entries(employee.manualMonthActualMinutes || {})
    .map(([yearMonth, minutes]) => ({
      yearMonth,
      minutes: Number(minutes)
    }))
    .filter((entry) => isValidYearMonth(entry.yearMonth) && Number.isFinite(entry.minutes) && entry.minutes >= 0)
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  formatManualMonthRows(entries.length ? entries : [{ yearMonth: state.activeMonth, minutes: null }]);
  const isHtmlEl = typeof HTMLElement !== "undefined" && document.activeElement instanceof HTMLElement;
  manualMonthDialogPreviousFocusEl = isHtmlEl ? document.activeElement : null;
  manualMonthDialogOverlayEl.classList.remove("hidden");
  manualMonthDialogOverlayEl.setAttribute("aria-hidden", "false");
  const firstInput = manualMonthRowsEl.querySelector("input");
  firstInput?.focus();
}

function totalMinutesForDayIso(iso) {
  return state.employees.reduce((sum, emp) => {
    return sum + getResolvedEntryForEmployeeOnIso(emp, iso).minutesForBranch;
  }, 0);
}

function totalMinutesForWeek() {
  const week = getActiveWeekDays();
  return week.reduce((sum, day) => {
    if (!day) return sum;
    return sum + totalMinutesForDayIso(day.iso);
  }, 0);
}

function formatIsoDateForFileName(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateTimeForDisplay(isoString) {
  if (!isoString) return "-";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function updateBackupInfoLabel() {
  if (!backupInfoEl) return;

  const meta = loadJson(BACKUP_META_KEY, {});
  if (meta?.lastExportAt) {
    backupInfoEl.textContent = `Letzte Sicherung: ${formatDateTimeForDisplay(meta.lastExportAt)}`;
  } else {
    backupInfoEl.textContent = "";
  }
}

function collectFullBackupSnapshot() {
  return {
    backupVersion: 1,
    app: {
      name: APP_META.name,
      version: APP_META.version
    },
    createdAt: new Date().toISOString(),
    storage: {
      [MASTER_KEY]: loadJson(MASTER_KEY, defaultMasterState()),
      [PLAN_KEY]: loadJson(PLAN_KEY, defaultPlanState()),
      [UI_KEY]: loadUiState(),
      ["wochenplan_dark"]: localStorage.getItem("wochenplan_dark"),
      [BACKUP_MEP_CALIBRATION_KEY]: loadJson(BACKUP_MEP_CALIBRATION_KEY, null)
    }
  };
}

function triggerBackupDownload(snapshot) {
  const payload = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `wochenplan-backup-${formatIsoDateForFileName()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function exportBackup() {
  try {
    saveAppState();

    const snapshot = collectFullBackupSnapshot();
    triggerBackupDownload(snapshot);

    saveJson(BACKUP_META_KEY, {
      lastExportAt: snapshot.createdAt
    });
    updateBackupInfoLabel();

    alert("Sicherung wurde exportiert.");
  } catch (_error) {
    alert("Sicherung konnte nicht exportiert werden.");
  }
}

function importBackupFromObject(backupData) {
  const validationResult = validateAndNormalizeBackupData(backupData);
  if (validationResult.error || !validationResult.backup) {
    throw new Error(validationResult.error || "Die Sicherungsdatei ist ungültig.");
  }

  const normalizedBackup = validationResult.backup;
  const storage = normalizedBackup.storage;
  const normalizedMaster = {
    ...defaultMasterState(),
    ...storage[MASTER_KEY],
    employees: (Array.isArray(storage[MASTER_KEY]?.employees)
      ? storage[MASTER_KEY].employees
      : []).map((employee, index) => normalizeEmployee(employee, index))
  };
  const normalizedPlanInput = {
    ...defaultPlanState(),
    ...storage[PLAN_KEY]
  };
  const normalizedPlanSchedule = normalizeSchedule(normalizedPlanInput.schedule || {});
  const { schedule: validatedSchedule } = validateNormalizedSchedule(normalizedPlanSchedule);
  const normalizedPlan = {
    ...normalizedPlanInput,
    schedule: validatedSchedule,
    absences: normalizeAbsences(normalizedPlanInput.absences || [])
  };
  const normalizedUi = sanitizeUiState(storage[UI_KEY]);

  const preImportSnapshot = {
    savedAt: new Date().toISOString(),
    source: "pre-import",
    storage: {
      [MASTER_KEY]: loadJson(MASTER_KEY, defaultMasterState()),
      [PLAN_KEY]: loadJson(PLAN_KEY, defaultPlanState()),
      [UI_KEY]: loadUiState(),
      ["wochenplan_dark"]: localStorage.getItem("wochenplan_dark"),
      [BACKUP_MEP_CALIBRATION_KEY]: loadJson(BACKUP_MEP_CALIBRATION_KEY, null)
    }
  };

  saveJson(BACKUP_INTERNAL_KEY, preImportSnapshot);
  saveJson(LAST_BACKUP_BEFORE_IMPORT_KEY, preImportSnapshot);

  const masterSaved = saveJson(MASTER_KEY, normalizedMaster);
  const planSaved = saveJson(PLAN_KEY, normalizedPlan);
  const uiSaved = saveJson(UI_KEY, normalizedUi);

  try {
    if (storage["wochenplan_dark"] === "true" || storage["wochenplan_dark"] === "false") {
      localStorage.setItem("wochenplan_dark", storage["wochenplan_dark"]);
    } else {
      localStorage.removeItem("wochenplan_dark");
    }

    if (storage[BACKUP_MEP_CALIBRATION_KEY] && typeof storage[BACKUP_MEP_CALIBRATION_KEY] === "object") {
      saveJson(BACKUP_MEP_CALIBRATION_KEY, storage[BACKUP_MEP_CALIBRATION_KEY]);
    } else {
      localStorage.removeItem(BACKUP_MEP_CALIBRATION_KEY);
    }
  } catch {
    // continue: core backup data is already restored as far as possible
  }

  if (!masterSaved || !planSaved || !uiSaved) {
    throw new Error("Die Sicherungsdaten konnten nicht vollständig gespeichert werden.");
  }

  saveJson(BACKUP_META_KEY, {
    lastExportAt: normalizedBackup.createdAt || new Date().toISOString(),
    lastImportAt: new Date().toISOString()
  });

  window.location.reload();
}

function handleBackupImportFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = JSON.parse(text);

      importBackupFromObject(parsed);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Die Sicherungsdatei konnte nicht importiert werden.";
      alert(`Import fehlgeschlagen: ${message}`);
    }
  };

  reader.onerror = () => {
    alert("Die ausgewählte Datei konnte nicht gelesen werden.");
  };

  reader.readAsText(file);
}

/* ========= WARNINGS ========= */
function isClosingResolvedEntry(entry) {
  if (!entry || entry.type !== "shift") return false;
  return ["G1", "L1", "L2", "L3", "L4"].includes(entry.code);
}

function getClosingWorkersForIso(iso) {
  const yearMonth = String(iso || "").slice(0, 7);

  return state.employees.filter((emp) => {
    if (!isEmployeeActiveInMonth(emp, yearMonth)) return false;
    const entry = getScheduleEntry(emp.id, iso);
    return isClosingResolvedEntry(entry);
  });
}

function getDayWarningsByIndex(index) {
  const week = getActiveWeekDays();
  const day = week[index];
  if (!day) return [];

  const warnings = [];
  const closers = getClosingWorkersForIso(day.iso);

  if (closers.length > 2) {
    warnings.push(`⚠ ${day.weekdayLabel}: ${closers.length} Personen bis 19:10. Maximal 2 erlaubt.`);
  }

  return warnings;
}

function getWeekWarnings() {
  const week = getActiveWeekDays();
  return week.slice(0, 6).flatMap((_, index) => getDayWarningsByIndex(index));
}

/* ========= FORM / ORIGINAL HELPERS ========= */
function getFormPauseText(shiftKey) {
  switch (shiftKey) {
    case "G1":
      return "14:00-15:10";
    case "L1":
    case "L2":
      return "16:00-16:10";
    case "L3":
    case "L4":
      return "17:00-17:10";
    default:
      return "";
  }
}

function getFormDataForShift(shiftKey) {
  const shift = getShiftByKey(shiftKey);

  if (!shift.start || !shift.end) {
    return {
      start: "",
      end: "",
      pause: "",
      sum: ""
    };
  }

  return {
    start: shift.start,
    end: shift.end,
    pause: getFormPauseText(shiftKey),
    sum: minutesToHM(netMinutesForShift(shiftKey))
  };
}

/* ========= RENDER BASICS ========= */
function renderTeamSectionVisibility() {
  teamSectionEl.classList.toggle("hidden", !!uiState.teamCollapsed);
  btnToggleTeamEl.textContent = uiState.teamCollapsed ? "Team einblenden" : "Team ausblenden";
}

function isWeekViewActive() {
  return (uiState.currentView || "week") === "week";
}

function renderTopbarVisibility() {
  const isWeek = isWeekViewActive();
  const isMep = (uiState?.currentView || "week") === "mep";

  if (viewMetaLineEl) {
    viewMetaLineEl.classList.toggle("hidden", !isWeek);
  }

  if (btnResetWeekEl) {
    btnResetWeekEl.classList.toggle("hidden", !isWeek);
  }

  if (btnMepModeNormalEl) {
    btnMepModeNormalEl.classList.toggle("hidden", !isMep);
    btnMepModeNormalEl.classList.toggle("active", !uiState.mepAnonymized);
  }

  if (btnMepModeAnonymEl) {
    btnMepModeAnonymEl.classList.toggle("hidden", !isMep);
    btnMepModeAnonymEl.classList.toggle("active", !!uiState.mepAnonymized);
  }

  syncMobileMoreMenuState();
}

function closeMobileMoreMenu({ restoreFocus = false } = {}) {
  if (!btnMoreActionsEl || !mobileMoreMenuPanelEl) return;
  btnMoreActionsEl.setAttribute("aria-expanded", "false");
  mobileMoreMenuPanelEl.classList.add("hidden");
  if (restoreFocus && typeof btnMoreActionsEl.focus === "function") {
    btnMoreActionsEl.focus();
  }
}

function openMobileMoreMenu() {
  if (!btnMoreActionsEl || !mobileMoreMenuPanelEl) return;
  btnMoreActionsEl.setAttribute("aria-expanded", "true");
  mobileMoreMenuPanelEl.classList.remove("hidden");
  const firstVisibleAction = mobileMoreMenuPanelEl.querySelector("button:not(.hidden):not(:disabled)");
  firstVisibleAction?.focus();
}

function syncMobileMoreMenuState() {
  if (!mobileMoreMenuPanelEl) return;
  const menuItems = mobileMoreMenuPanelEl.querySelectorAll("[data-forward-target]");
  menuItems.forEach((item) => {
    const targetId = item.getAttribute("data-forward-target");
    if (!targetId) return;
    const targetButton = document.getElementById(targetId);
    const shouldHide = !targetButton || targetButton.classList.contains("hidden");
    item.classList.toggle("hidden", shouldHide);
    item.disabled = !!targetButton?.disabled;
  });
}

function renderView() {
  const view = uiState.currentView || "week";

  document.body.dataset.currentView = view;

  dayViewEl.classList.toggle("hidden", view !== "day");
  weekViewEl.classList.toggle("hidden", view !== "week");
  monthViewEl.classList.toggle("hidden", view !== "month");
  mepTemplateViewEl.classList.toggle("hidden", view !== "mep");

  btnViewDayEl.classList.toggle("active", view === "day");
  btnViewWeekEl.classList.toggle("active", view === "week");
  btnViewMonthEl.classList.toggle("active", view === "month");
  btnViewMepEl.classList.toggle("active", view === "mep");

  renderTopbarVisibility();
  updatePrintButtonLabel();
  requestActiveResponsiveViewRefresh();
}

function renderTeamSetup() {
  if (!teamListEl) return;

  teamListEl.innerHTML = "";

  state.employees.forEach((emp, idx) => {
    const row = document.createElement("div");
    row.className = "teamRow";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = `Mitarbeiter ${idx + 1}`;
    nameInput.value = emp.name;
    nameInput.addEventListener("change", () => {
      emp.name = nameInput.value;
      saveAppStateDebounced();
      renderAllViews();
    });

    const roleSel = document.createElement("select");
    ROLE_OPTIONS.forEach((role) => {
      const opt = document.createElement("option");
      opt.value = role.key;
      opt.textContent = role.label;
      roleSel.appendChild(opt);
    });
    roleSel.value = emp.roleKey;
    roleSel.addEventListener("change", () => {
      emp.roleKey = roleSel.value;
      emp.target = roleToTarget(emp.roleKey);
      emp.contractModel = roleToContractModel(emp.roleKey);
      saveAppStateDebounced();
      renderAllViews();
    });

    const targetInput = document.createElement("input");
    targetInput.type = "text";
    targetInput.placeholder = "Soll";
    targetInput.value = emp.target || "";
    targetInput.addEventListener("change", () => {
      emp.target = targetInput.value;
      saveAppStateDebounced();
      renderAllViews();
    });

    const vacationInput = document.createElement("input");
vacationInput.type = "number";
vacationInput.min = "0";
vacationInput.max = "36";
vacationInput.placeholder = "Urlaub";
vacationInput.value = Number(emp.totalVacationDays ?? emp.vacationDays ?? 30);

vacationInput.addEventListener("change", () => {
  const raw = Number(vacationInput.value || 0);
  const clamped = Math.max(0, Math.min(36, raw));

  emp.totalVacationDays = clamped;
  emp.vacationDays = clamped;
  emp.remainingVacationDays = clamped - Number(emp.usedVacationDays ?? 0);
  vacationInput.value = clamped;

  saveAppStateDebounced();
  renderAllViews();
});

    const usedVacationInfo = document.createElement("input");
    usedVacationInfo.type = "text";
    usedVacationInfo.value = String(Number(emp.usedVacationDays ?? 0));
    usedVacationInfo.title = "Genommene Urlaubstage (ohne Sonntage und Feiertage)";
    usedVacationInfo.readOnly = true;

    const remainingVacationInfo = document.createElement("input");
    remainingVacationInfo.type = "text";
    remainingVacationInfo.value = String(Number(emp.remainingVacationDays ?? 0));
    remainingVacationInfo.title = "Resturlaub";
    remainingVacationInfo.readOnly = true;
    

    const birthDateInput = document.createElement("input");
    birthDateInput.type = "date";
    birthDateInput.value = emp.birthDate || "";
    birthDateInput.addEventListener("change", () => {
      emp.birthDate = birthDateInput.value;
      saveAppStateDebounced();
      renderAllViews();
    });
    const serviceBonusInput = document.createElement("input");
serviceBonusInput.type = "checkbox";
serviceBonusInput.checked = Boolean(emp.serviceBonus);
serviceBonusInput.title = "10 Jahre Betriebszugehörigkeit";

serviceBonusInput.addEventListener("change", () => {
  emp.serviceBonus = serviceBonusInput.checked;
  saveAppStateDebounced();
  renderAllViews();
});

    const activeFromInput = document.createElement("input");
    activeFromInput.type = "month";
    activeFromInput.value = normalizeYearMonth(emp.activeFromMonth);
    activeFromInput.placeholder = "YYYY-MM";
    activeFromInput.title = "Ab diesem Monat im Plan sichtbar";
    activeFromInput.addEventListener("change", () => {
      emp.activeFromMonth = normalizeYearMonth(activeFromInput.value);

      if (emp.activeFromMonth && emp.activeToMonth && emp.activeToMonth < emp.activeFromMonth) {
        emp.activeToMonth = emp.activeFromMonth;
        activeToInput.value = emp.activeToMonth;
      }

      saveAppStateDebounced();
      renderAllViews();
    });

    const activeFromField = document.createElement("div");
    activeFromField.className = "teamField";
    const activeFromLabel = document.createElement("label");
    activeFromLabel.className = "teamFieldLabel";
    activeFromLabel.textContent = "Eintritt";
    activeFromField.append(activeFromLabel, activeFromInput);

    const activeToInput = document.createElement("input");
    activeToInput.type = "month";
    activeToInput.value = normalizeYearMonth(emp.activeToMonth);
    activeToInput.placeholder = "YYYY-MM";
    activeToInput.title = "Ab Folgemonat nicht mehr sichtbar";
    activeToInput.addEventListener("change", () => {
      emp.activeToMonth = normalizeYearMonth(activeToInput.value);

      if (emp.activeFromMonth && emp.activeToMonth && emp.activeToMonth < emp.activeFromMonth) {
        emp.activeFromMonth = emp.activeToMonth;
        activeFromInput.value = emp.activeFromMonth;
      }

      saveAppStateDebounced();
      renderAllViews();
    });

    const activeToField = document.createElement("div");
    activeToField.className = "teamField";
    const activeToLabel = document.createElement("label");
    activeToLabel.className = "teamFieldLabel";
    activeToLabel.textContent = "Austritt";
    activeToField.append(activeToLabel, activeToInput);
    const removeEmployeeButton = document.createElement("button");
    removeEmployeeButton.type = "button";
    removeEmployeeButton.textContent = "Mitarbeiter entfernen";
    removeEmployeeButton.title = "Mitarbeiter entfernen";
    removeEmployeeButton.addEventListener("click", () => {
      const employeeLabel = (emp.name || `Mitarbeiter ${idx + 1}`).trim();
      const shouldRemoveEmployee = confirm(`"${employeeLabel}" wirklich entfernen?`);
      if (!shouldRemoveEmployee) return;

      const shouldCleanupPlanData = confirm("Zugehörige Plan- und Absenzdaten ebenfalls löschen?\nOK = Ja, Abbrechen = Nein (nur Stammdaten entfernen)");
      removeEmployee(emp.id, { cleanupPlanData: shouldCleanupPlanData });
    });
    const manualMonthButton = document.createElement("button");
    manualMonthButton.type = "button";
    manualMonthButton.textContent = "Monats-Iststunden";
    manualMonthButton.title = "Monats-Iststunden";
    manualMonthButton.addEventListener("click", () => {
      openManualMonthDialog(emp);
    });

    row.appendChild(nameInput);
    row.appendChild(roleSel);
    row.appendChild(targetInput);
    row.appendChild(activeFromField);
    row.appendChild(activeToField);
    row.appendChild(vacationInput);
    row.appendChild(usedVacationInfo);
    row.appendChild(remainingVacationInfo);
    row.appendChild(birthDateInput);
    row.appendChild(serviceBonusInput);
    row.appendChild(manualMonthButton);
    row.appendChild(removeEmployeeButton);

    teamListEl.appendChild(row);
    });
}

btnManualMonthAddRowEl?.addEventListener("click", () => {
  if (manualMonthValidationEl) {
    manualMonthValidationEl.textContent = "";
    manualMonthValidationEl.style.color = "";
  }
  addManualMonthDialogRow();
});

btnManualMonthApplyBulkEl?.addEventListener("click", () => {
  if (manualMonthValidationEl) {
    manualMonthValidationEl.textContent = "";
    manualMonthValidationEl.style.color = "";
  }
  applyManualMonthBulkInput();
});

btnManualMonthCancelEl?.addEventListener("click", () => {
  closeManualMonthDialog();
});

btnManualMonthSaveEl?.addEventListener("click", () => {
  saveManualMonthDialog();
});

manualMonthDialogOverlayEl?.addEventListener("click", (event) => {
  if (event.target === manualMonthDialogOverlayEl) {
    closeManualMonthDialog();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (manualMonthDialogOverlayEl?.classList.contains("hidden")) return;
  event.preventDefault();
  closeManualMonthDialog();
});

function getNextEmployeeId() {
  const maxEmployeeNumber = state.employees.reduce((maxValue, employee) => {
    const match = String(employee?.id || "").match(/^emp_(\d+)$/);
    if (!match) return maxValue;
    return Math.max(maxValue, Number(match[1]) || 0);
  }, 0);

  return `emp_${maxEmployeeNumber + 1}`;
}

function createEmptyEmployee() {
  return normalizeEmployee({
    id: getNextEmployeeId(),
    name: "",
    roleKey: "",
    target: "",
    contractModel: "",
    totalVacationDays: 30,
    usedVacationDays: 0,
    remainingVacationDays: 30,
    vacationDays: 30,
    birthDate: "",
    activeFromMonth: "",
    activeToMonth: "",
    serviceBonus: false
  }, state.employees.length);
}

function removeEmployee(employeeId, options = {}) {
  if (!employeeId) return;
  const { cleanupPlanData = true } = options;

  state.employees = (state.employees || []).filter((employee) => employee?.id !== employeeId);

  if (cleanupPlanData) {
    Object.keys(state.schedule || {}).forEach((isoDate) => {
      if (!state.schedule?.[isoDate]) return;
      delete state.schedule[isoDate][employeeId];
      if (!Object.keys(state.schedule[isoDate]).length) {
        delete state.schedule[isoDate];
      }
    });

    state.absences = (state.absences || []).filter((entry) => entry?.employeeId !== employeeId);
  }

  commitPlanChange();
  renderTeamSetup();
}
function renderSummary() {
  const totalWeek = totalMinutesForWeek();
  const rest = MAX_WEEKLY_MINUTES - totalWeek;

  weeklyHoursActualEl.textContent = minutesToHM(totalWeek);
  weeklyHoursRemainingEl.textContent = minutesToHM(Math.abs(rest));
  weeklyHoursStatusEl.textContent = rest >= 0 ? "Noch frei" : "Überplant";

  if (mepWeekFromEl) mepWeekFromEl.textContent = state.weekFrom || "____________";
  if (mepWeekToEl) mepWeekToEl.textContent = state.weekTo || "____________";
  if (mepMonthYearEl) mepMonthYearEl.textContent = formatMonthYear(state.weekFrom);
}

function renderAllViews() {
  renderSummary();

  if (typeof renderDayView === "function") renderDayView();
  if (typeof renderWeekView === "function") renderWeekView();
  if (typeof renderMonthView === "function") renderMonthView();
  if (typeof renderMepTemplateView === "function") renderMepTemplateView();
}

function renderAll() {
  syncMonthPlanToState();
  syncWeekRangeFromActiveWeek();
  renderTeamSectionVisibility();
  renderView();
  renderTeamSetup();
  renderAllViews();
  updateResponsiveViewportMetrics();
}

function showStartupFailureMessage(error) {
  const message = error?.message || "Unbekannter Startfehler";
  const fallbackText = `⚠️ App-Start fehlgeschlagen. Bitte Seite neu laden. Details: ${message}`;
  const fallbackId = "startupFailureBanner";
  let banner = document.getElementById(fallbackId);

  if (!banner) {
    banner = document.createElement("div");
    banner.id = fallbackId;
    banner.setAttribute("role", "alert");
    banner.style.cssText = "margin:8px;padding:10px;border-radius:8px;background:#b00020;color:#fff;font-weight:600;white-space:pre-wrap;";
    document.body?.prepend(banner);
  }

  banner.textContent = fallbackText;
}

function bootstrapApp() {
  window.__APP_BOOT_OK__ = false;

  try {
    updateResponsiveViewportMetrics();

    if (!state.weekFrom) {
      const today = new Date();
      state.weekFrom = toIsoDate(today);
    }

    if (!state.activeMonth) {
      state.activeMonth = (state.weekFrom || toIsoDate(new Date())).slice(0, 7);
    }

    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem("wochenplan_dark");
    } catch {
      savedTheme = null;
    }

    if (savedTheme === "true") {
      document.body.classList.add("dark");
    } else if (savedTheme === "false") {
      document.body.classList.remove("dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.body.classList.add("dark");
    }

    updateDarkModeButton();
    updateBackupInfoLabel();
    refreshSaveStatusLabel();

    if (typeof bindMonthNavigation === "function") {
      bindMonthNavigation();
    }

    if (typeof bindMepMonthNavigation === "function") {
      bindMepMonthNavigation();
    }

    syncVacationScheduleFromAbsences();
    refreshEmployeeVacationCounters();
    syncMonthPlanToState();
    syncWeekRangeFromActiveWeek();

    renderAll();
    window.__APP_BOOT_OK__ = true;
    console.info("startup: render-complete");
  } catch (err) {
    console.error("startup-failed", err);
    showStartupFailureMessage(err);

    if (isMobileDebugPanelEnabled()) {
      showMobileRuntimeError({
        message: err?.message || "Startup fehlgeschlagen",
        file: "bootstrapApp",
        line: "-"
      }, { force: true });
    }
  }
}

/* ========= EVENTS ========= */
console.info("startup: begin");

const btnCloseMobileErrorPanelEl = document.getElementById("btnCloseMobileErrorPanel");
btnCloseMobileErrorPanelEl?.addEventListener("click", () => {
  document.getElementById("mobileErrorPanel")?.classList.add("hidden");
});

if (btnPrevWeekEl) {
  btnPrevWeekEl.addEventListener("click", () => {
    shiftActiveWeek(-7);
  });
}

if (btnNextWeekEl) {
  btnNextWeekEl.addEventListener("click", () => {
    shiftActiveWeek(7);
  });
}

if (btnCurrentWeekEl) {
  btnCurrentWeekEl.addEventListener("click", () => {
    const today = new Date();
    state.weekFrom = toIsoDate(today);
    state.activeMonth = state.weekFrom.slice(0, 7);

    syncMonthPlanToState();
    syncWeekRangeFromActiveWeek();
    commitPlanChange();
  });
}
if (weekFromEl) {
  weekFromEl.addEventListener("change", () => {
    state.weekFrom = weekFromEl.value;
    syncMonthPlanToState();
    syncWeekRangeFromActiveWeek();
    saveAppStateDebounced();
    renderAllViews();
  });
}

if (weekToEl) {
  weekToEl.addEventListener("change", () => {
    state.weekTo = weekToEl.value;
    saveAppStateDebounced();
    renderAllViews();
  });
}

if (btnToggleTeamEl) {
  btnToggleTeamEl.addEventListener("click", () => {
    uiState.teamCollapsed = !uiState.teamCollapsed;
    saveAppStateDebounced();
    renderTeamSectionVisibility();
  });
}

if (btnAddEmployeeEl) {
  btnAddEmployeeEl.addEventListener("click", () => {
    state.employees.push(createEmptyEmployee());
    saveAppStateDebounced();
    renderTeamSetup();
    renderAllViews();
  });
}

if (btnViewDayEl) {
  btnViewDayEl.addEventListener("click", () => {
    uiState.currentView = "day";
    saveAppStateDebounced();
    renderView();
    renderAllViews();
  });
}

if (btnViewMonthEl) {
  btnViewMonthEl.addEventListener("click", () => {
    uiState.currentView = "month";
    saveAppStateDebounced();
    renderView();
    renderAllViews();
  });
}

if (btnViewWeekEl) {
  btnViewWeekEl.addEventListener("click", () => {
    uiState.currentView = "week";
    saveAppStateDebounced();
    renderView();
    renderAllViews();
  });
}

if (btnViewMepEl) {
  btnViewMepEl.addEventListener("click", () => {
    uiState.currentView = "mep";
    saveAppStateDebounced();
    renderView();
    renderAllViews();
  });
}

btnMepModeNormalEl?.addEventListener("click", () => {
  if (!uiState.mepAnonymized) return;
  uiState.mepAnonymized = false;
  saveAppStateDebounced();
  renderTopbarVisibility();
  renderMepTemplateView({ scope: "month" });
});

btnMepModeAnonymEl?.addEventListener("click", () => {
  if (uiState.mepAnonymized) return;
  uiState.mepAnonymized = true;
  saveAppStateDebounced();
  renderTopbarVisibility();
  renderMepTemplateView({ scope: "month" });
});

document.getElementById("btnSaveMaster")?.addEventListener("click", () => {
  const ok = saveAppState();
  alert(ok ? "Stammdaten gespeichert." : "Speichern fehlgeschlagen.");
});
document.getElementById("btnResetWeek")?.addEventListener("click", () => {
  const weekDays = getActiveWeekDays();
  if (!weekDays.length) return;

  if (!confirm("Aktuell ausgewählte Woche leeren? Stammdaten bleiben erhalten.")) return;

  const weekIsos = weekDays.map((day) => day.iso);
  const weekStart = weekIsos[0];
  const weekEnd = weekIsos[weekIsos.length - 1];

  weekIsos.forEach((isoDate) => {
    delete state.schedule[isoDate];
  });

  state.absences = (state.absences || []).flatMap((entry) => {
    if (!entry) return [];

    const hasOverlap = !(entry.to < weekStart || entry.from > weekEnd);
    if (!hasOverlap) return [entry];

    return subtractRangeFromAbsenceEntry(entry, weekStart, weekEnd);
  });

  commitPlanChange();
  renderAll();
});
btnPrintEl?.addEventListener("click", async () => {
  if ((uiState?.currentView || "week") === "mep") {
    await exportMepTemplatePdf();
    return;
  }

  window.print();
});

btnExportBackupEl?.addEventListener("click", () => {
  exportBackup();
});

btnImportBackupEl?.addEventListener("click", () => {
  if (!backupFileInputEl) return;

  flushPendingAutoSave();
  saveAppState();

  if (!confirm("Der aktuelle Stand wird überschrieben. Import jetzt durchführen?")) {
    return;
  }

  backupFileInputEl.value = "";
  backupFileInputEl.click();
});

backupFileInputEl?.addEventListener("change", () => {
  const file = backupFileInputEl.files?.[0];
  if (!file) return;

  handleBackupImportFile(file);
});


/* ========= DARK MODE ========= */

const btnDarkMode = document.getElementById("btnDarkMode");

function updateDarkModeButton() {
  if (!btnDarkMode) return;
  btnDarkMode.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

btnDarkMode?.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  try {
    localStorage.setItem(
      "wochenplan_dark",
      document.body.classList.contains("dark")
    );
  } catch {
    updateSaveStatus("Theme konnte nicht gespeichert werden", { isError: true, hideAfterMs: 3000 });
  }

  updateDarkModeButton();
});

btnMoreActionsEl?.addEventListener("click", () => {
  if (!mobileMoreMenuPanelEl) return;
  const isOpen = btnMoreActionsEl.getAttribute("aria-expanded") === "true";
  if (isOpen) {
    closeMobileMoreMenu();
    return;
  }
  syncMobileMoreMenuState();
  openMobileMoreMenu();
});

mobileMoreMenuPanelEl?.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const triggerButton = event.target.closest("[data-forward-target]");
  if (!triggerButton) return;
  const targetId = triggerButton.getAttribute("data-forward-target");
  if (!targetId) return;
  const targetButton = document.getElementById(targetId);
  closeMobileMoreMenu({ restoreFocus: true });
  targetButton?.click();
});

document.addEventListener("click", (event) => {
  if (!btnMoreActionsEl || !mobileMoreMenuPanelEl) return;
  const clickTarget = event.target;
  if (!(clickTarget instanceof Node)) return;
  const clickedInsideMenu = mobileMoreMenuPanelEl.contains(clickTarget) || btnMoreActionsEl.contains(clickTarget);
  if (!clickedInsideMenu) {
    closeMobileMoreMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (!btnMoreActionsEl || !mobileMoreMenuPanelEl) return;
  const isMenuOpen = btnMoreActionsEl.getAttribute("aria-expanded") === "true";
  if (!isMenuOpen) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeMobileMoreMenu({ restoreFocus: true });
  }
});

const mobileToolbarMediaQuery = window.matchMedia("(max-width: 640px)");
const handleMobileToolbarBreakpointChange = (event) => {
  if (!event.matches) {
    closeMobileMoreMenu();
  }
};

if (typeof mobileToolbarMediaQuery.addEventListener === "function") {
  mobileToolbarMediaQuery.addEventListener("change", handleMobileToolbarBreakpointChange);
} else if (typeof mobileToolbarMediaQuery.addListener === "function") {
  mobileToolbarMediaQuery.addListener(handleMobileToolbarBreakpointChange);
}

console.info("startup: handlers-bound");

/* ========= INIT ========= */
window.addEventListener("load", () => {
  if (!isMobileDebugPanelEnabled()) {
    document.getElementById("mobileErrorPanel")?.classList.add("hidden");
  }

  bootstrapApp();
});

window.addEventListener("orientationchange", () => {
  scheduleResponsiveViewRefresh({
    delays: [180, 420],
    force: true
  });
}, { passive: true });
window.addEventListener("pageshow", () => {
  if (hasTriggeredPageShowResponsiveRefresh) return;
  hasTriggeredPageShowResponsiveRefresh = true;
  scheduleResponsiveViewRefresh({ force: true });
}, { passive: true });
window.addEventListener("beforeunload", () => {
  flushPendingAutoSave();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushPendingAutoSave();
  }
});

// DEBUG toggle with key "D"
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "d") {
    const root = document.documentElement;
    const active = root.getAttribute("data-debug") === "1";
    root.setAttribute("data-debug", active ? "0" : "1");
  }
});
