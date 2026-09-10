const DRIVE_UPLOAD_CONFIG = Object.freeze({
  folderId: window.WOCHENPLAN_DRIVE_CONFIG?.folderId || "",
  clientId: window.WOCHENPLAN_DRIVE_CONFIG?.clientId || "",
  scope: window.WOCHENPLAN_DRIVE_CONFIG?.scope || "https://www.googleapis.com/auth/drive",
  enabled: Boolean(window.WOCHENPLAN_DRIVE_CONFIG?.enabled)
});

let driveTokenClient = null;
let driveAccessToken = "";

// =============================================================================
// Lokaler PDF-Exportpfad (Capture + PDF-Erzeugung)
// Ziel: export-ready Daten (Canvas) -> PDF-Blob, ohne Cloud-Abhängigkeit.
// =============================================================================

function buildMepPdfFilename() {
  const monthValue = state.activeMonth || (state.weekFrom || new Date().toISOString().slice(0, 10)).slice(0, 7);
  return `mep-${String(monthValue).replace(/[^0-9-]+/g, "-")}.pdf`;
}

function buildOverviewPdfFilename() {
  const monthValue = state.activeMonth || (state.weekFrom || new Date().toISOString().slice(0, 10)).slice(0, 7);
  return `uebersicht-${String(monthValue).replace(/[^0-9-]+/g, "-")}.pdf`;
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
    // Der Export erfasst jede fertige Seite einzeln. Druck-Umbruchregeln auf
    // dem Capture-Ziel würden hier eine zweite, konkurrierende Pagination
    // einführen und gehören ausschließlich in den Browser-Druckpfad.
    sheetEl.style.breakAfter = "auto";
    sheetEl.style.pageBreakAfter = "auto";
  });

  exportRoot.appendChild(clonePagesEl);
  copyMepLayoutVariablesToNode(exportRoot);
  document.body.appendChild(exportRoot);

  if (typeof syncMepOutsideRunMarkers === "function") {
    syncMepOutsideRunMarkers(clonePagesEl);
  }

  return exportRoot;
}

function removeMepPdfExportRoot(exportRoot) {
  exportRoot?.remove();
}

class MepPdfExportError extends Error {
  constructor(stage, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "MepPdfExportError";
    this.stage = stage;
    this.pageIndex = Number.isFinite(options.pageIndex) ? options.pageIndex : null;
  }
}

function throwMepPdfStageError(stage, message, error, pageIndex = null) {
  if (error instanceof MepPdfExportError) throw error;
  throw new MepPdfExportError(stage, message, { cause: error, pageIndex });
}

function waitForBrowserYield() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    if (typeof canvas?.toBlob !== "function") {
      reject(new Error("Canvas.toBlob ist nicht verfügbar."));
      return;
    }
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas.toBlob hat keine Bilddaten geliefert."));
      }, type, quality);
    } catch (error) {
      reject(error);
    }
  });
}

async function blobToUint8Array(blob) {
  if (typeof blob?.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Bild-Blob konnte nicht gelesen werden."));
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.readAsArrayBuffer(blob);
  });
}

async function canvasToMepPdfImage(canvas, options = {}) {
  const mimeType = options.mimeType || "image/jpeg";
  const quality = options.quality ?? 0.9;
  if (typeof canvas?.toBlob === "function") {
    const imageBlob = await canvasToBlob(canvas, mimeType, quality);
    return { data: await blobToUint8Array(imageBlob), format: "JPEG" };
  }

  // Kompatibilitätsweg für ältere Browser/Test-Doubles. Moderne Safari-Versionen
  // benutzen toBlob und erzeugen damit keinen großen Base64-/UTF-16-String.
  return { data: canvas.toDataURL("image/jpeg", quality), format: "JPEG" };
}

async function buildMepPdfBlobFromSheets(sheetEls, options = {}) {
  const captureFn = options.captureFn || window.html2canvas;
  const jsPdfCtor = options.jsPdfCtor || window.jspdf?.jsPDF;
  const scale = options.scale || (isIosLikeDevice() ? 1.25 : 2);
  if (typeof captureFn !== "function" || typeof jsPdfCtor !== "function") {
    throw new Error("PDF-Export ist noch nicht verfügbar.");
  }

  const preparedSheetEls = Array.from(sheetEls || []);
  if (!preparedSheetEls.length) {
    throw new Error("Keine MEP-Seiten zum Export gefunden.");
  }

  const pdf = new jsPdfCtor({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true
  });

  for (let index = 0; index < preparedSheetEls.length; index += 1) {
    options.onCaptureStart?.(index);
    let canvas = null;
    let imageData = null;
    try {
      try {
        canvas = await captureFn(preparedSheetEls[index], {
          backgroundColor: "#ffffff",
          scale,
          useCORS: true,
          removeContainer: true
        });
      } catch (error) {
        throwMepPdfStageError("html2canvas", `MEP-Seite ${index + 1} konnte nicht erfasst werden.`, error, index);
      }
      options.onStage?.("image.convert", index);
      try {
        imageData = await canvasToMepPdfImage(canvas, options);
      } catch (error) {
        throwMepPdfStageError("image.convert", `Bildkonvertierung für MEP-Seite ${index + 1} ist fehlgeschlagen.`, error, index);
      }
      if (index > 0) {
        pdf.addPage("a4", "landscape");
      }
      options.onStage?.("jspdf.addImage", index);
      try {
        pdf.addImage(imageData.data, imageData.format, 0, 0, 297, 210, undefined, "FAST");
      } catch (error) {
        throwMepPdfStageError("jspdf.addImage", `MEP-Seite ${index + 1} konnte nicht in das PDF eingefügt werden.`, error, index);
      }
    } finally {
      // Safari hält den backing store eines Canvas sonst auch nach dem nächsten
      // await fest. Pro Durchlauf darf nur die aktuelle MEP-Seite leben.
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      imageData = null;
      canvas = null;
    }
    if (options.yieldBetweenPages ?? isIosLikeDevice()) {
      await (options.yieldFn || waitForBrowserYield)();
    }
  }
  options.onStage?.("jspdf.output", preparedSheetEls.length - 1);
  try {
    return pdf.output("blob");
  } catch (error) {
    throwMepPdfStageError("jspdf.output", "Der PDF-Blob konnte nicht erzeugt werden.", error);
  }
}

function isIosLikeDevice() {
  const currentNavigator = typeof navigator === "undefined" ? {} : navigator;
  const userAgent = currentNavigator.userAgent || "";
  const platform = currentNavigator.platform || "";
  const touchPoints = Number(currentNavigator.maxTouchPoints || 0);

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

async function waitForMepCaptureResources(root) {
  try {
    await document.fonts?.ready;
  } catch (error) {
    console.warn("MEP-Schriften konnten vor dem Export nicht vollständig bestätigt werden.", error);
  }

  const images = [...(root?.querySelectorAll?.("img") || [])];
  await Promise.all(images.map(async (imageEl) => {
    if (imageEl.complete) return;
    if (typeof imageEl.decode === "function") {
      try {
        await imageEl.decode();
        return;
      } catch (_) {
        // load/error wartet unten auch bei nicht dekodierbaren Bildern zuverlässig ab.
      }
    }
    await new Promise((resolve) => {
      imageEl.addEventListener("load", resolve, { once: true });
      imageEl.addEventListener("error", resolve, { once: true });
    });
  }));
}

// =============================================================================
// Optionale Delivery-/Integrationspfade
// (Teilen/Download lokal + optionaler Drive-Upload bestehender Funktionalität)
// =============================================================================

async function shareOrDownloadPdfBlob(blob, filename, options = {}) {
  const shareTitle = options.shareTitle || "PDF";
  const shareText = options.shareText || "PDF exportiert";
  let file;
  try {
    file = new File([blob], filename, { type: "application/pdf" });
  } catch (error) {
    throwMepPdfStageError("delivery.file", "Die PDF-Datei konnte nicht für die Zustellung vorbereitet werden.", error);
  }
  const isIos = isIosLikeDevice();
  let canShareFiles = false;
  try {
    canShareFiles = Boolean(navigator.canShare?.({ files: [file] }));
  } catch (error) {
    logMepExportError("navigator.canShare konnte nicht ausgeführt werden", error, {
      currentExportStep: "share:navigator.canShare",
      filename
    });
  }

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
        title: shareTitle,
        text: shareText
      });
      return { deliveryMethod: "navigator.share" };
    } catch (error) {
      logMepExportError("MEP PDF Teilen via navigator.share fehlgeschlagen", error, {
        currentExportStep: "share:navigator.share",
        filename,
        deliveryMethod: "navigator.share"
      });

      // Der native Share-Dialog ist bereits der Zustellversuch für diese
      // Benutzeraktion. Der bisherige Fall-through zum Link-Download startete
      // nach einer Ablehnung des Share-Promises einen zweiten PDF-Vorgang. Das
      // betrifft insbesondere Browser, die das Promise nach Übergabe an eine
      // Druck-/PDF-App ablehnen. Ein Download bleibt der eigenständige Fallback,
      // wenn File Sharing von vornherein nicht verfügbar ist.
      if (error?.name === "AbortError") {
        return { deliveryMethod: "navigator.share", cancelled: true };
      }
      throwMepPdfStageError("delivery.navigator.share", "Der native Teilen-Dialog ist fehlgeschlagen.", error);
    }
  } else if (isIos) {
    console.info("MEP PDF Teilen via navigator.share nicht verfügbar", {
      filename,
      canShareFiles,
      hasNavigatorShare: typeof navigator.share === "function"
    });
  }

  let blobUrl;
  try {
    blobUrl = URL.createObjectURL(blob);
  } catch (error) {
    throwMepPdfStageError("delivery.objectUrl", "Für die PDF konnte keine Download-Adresse erzeugt werden.", error);
  }
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

    throw new MepPdfExportError("delivery.fallback", "Download und Öffnen der PDF sind fehlgeschlagen.", {
      cause: openError
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}

function ensureDriveUploadConfigured() {
  if (!DRIVE_UPLOAD_CONFIG.enabled) {
    throw new Error("Drive-Upload ist nicht aktiviert.");
  }
  if (!DRIVE_UPLOAD_CONFIG.folderId) {
    throw new Error("Drive-Upload ist nicht konfiguriert: folderId fehlt.");
  }
  if (!DRIVE_UPLOAD_CONFIG.clientId) {
    throw new Error("Drive-Upload ist nicht konfiguriert: clientId fehlt.");
  }
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services sind nicht geladen.");
  }
}

function createDriveMultipartBody(metadata, fileBlob) {
  const boundary = `wochenplan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const metadataPart = new Blob(
    [`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`],
    { type: "application/json" }
  );
  const filePartHeader = new Blob([`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`], { type: "text/plain" });
  const closingPart = new Blob([`\r\n--${boundary}--`], { type: "text/plain" });

  return {
    boundary,
    body: new Blob([metadataPart, filePartHeader, fileBlob, closingPart], {
      type: `multipart/related; boundary=${boundary}`
    })
  };
}

function getDriveAccessToken() {
  ensureDriveUploadConfigured();

  if (driveAccessToken) {
    return Promise.resolve(driveAccessToken);
  }

  if (!driveTokenClient) {
    driveTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_UPLOAD_CONFIG.clientId,
      scope: DRIVE_UPLOAD_CONFIG.scope,
      callback: () => {}
    });
  }

  return new Promise((resolve, reject) => {
    driveTokenClient.callback = (response) => {
      if (response?.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      if (!response?.access_token) {
        reject(new Error("Kein Access-Token von Google erhalten."));
        return;
      }
      driveAccessToken = response.access_token;
      resolve(driveAccessToken);
    };

    driveTokenClient.requestAccessToken({ prompt: driveAccessToken ? "" : "consent" });
  });
}

async function driveRequestJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive API Fehler (${response.status}): ${errorText || response.statusText}`);
  }

  return response.json();
}

async function findDriveFileByNameInFolder(token, folderId, filename) {
  const query = [
    `'${folderId}' in parents`,
    `name='${String(filename).replace(/'/g, "\\'")}'`,
    "trashed=false",
    "mimeType='application/pdf'"
  ].join(" and ");
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name)",
    pageSize: "1",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true"
  });

  const result = await driveRequestJson(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, token);
  return result?.files?.[0] || null;
}

async function uploadOverviewPdfToGoogleDrive(pdfBlob, filename) {
  ensureDriveUploadConfigured();
  const token = await getDriveAccessToken();
  const folderId = DRIVE_UPLOAD_CONFIG.folderId;
  const existingFile = await findDriveFileByNameInFolder(token, folderId, filename);

  const metadata = existingFile
    ? { name: filename }
    : { name: filename, parents: [folderId] };
  const { boundary, body } = createDriveMultipartBody(metadata, pdfBlob);
  const uploadUrl = existingFile
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart&supportsAllDrives=true`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true";

  const uploadedFile = await driveRequestJson(uploadUrl, token, {
    method: existingFile ? "PATCH" : "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });

  return {
    action: existingFile ? "updated" : "created",
    fileId: uploadedFile?.id || existingFile?.id || "",
    filename
  };
}

// =============================================================================
// Lokaler PDF-Exportpfad (DOM-Capture -> reine PDF-Builder)
// =============================================================================

function formatOverviewPdfTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildOverviewPdfStatusText(monthTitle, createdAt = new Date()) {
  return `${String(monthTitle || "Monatsübersicht").trim()} · Stand ${formatOverviewPdfTimestamp(createdAt)}`;
}

function createOverviewPdfExportRoot(options = {}) {
  const overviewView = document.getElementById("overviewView");
  const overviewContent = document.getElementById("overviewMonthContent");
  if (!overviewView || !overviewContent) return null;

  const exportRoot = document.createElement("div");
  exportRoot.className = "overviewPdfExportRoot";

  const clonedView = overviewView.cloneNode(true);
  clonedView.classList.remove("hidden", "no-print");
  clonedView.classList.add("overviewPdfExportView");

  clonedView.querySelectorAll("button").forEach((buttonEl) => buttonEl.remove());
  clonedView.querySelectorAll(".internalOnly, .noExport").forEach((el) => el.remove());
  const monthTitle = clonedView.querySelector("#overviewMonthTitle")?.textContent?.trim() || "Monatsübersicht";
  const statusText = buildOverviewPdfStatusText(monthTitle, options.createdAt);
  clonedView.querySelectorAll(".overviewWeekSection").forEach((sectionEl) => {
    const metaEl = document.createElement("div");
    metaEl.className = "overviewPdfPageMeta";
    metaEl.textContent = statusText;
    sectionEl.prepend(metaEl);
  });
  const clonedWrapEls = clonedView.querySelectorAll(".tableWrap, .compactTableWrap, .overviewWeekTableWrap");
  clonedWrapEls.forEach((wrapEl) => {
    wrapEl.style.overflow = "visible";
    wrapEl.style.maxHeight = "none";
    wrapEl.style.height = "auto";
  });

  exportRoot.appendChild(clonedView);
  document.body.appendChild(exportRoot);
  return exportRoot;
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
    exportState.currentExportStep = `capture:init:${attemptLabel}`;
    let blob;
    try {
      blob = await buildMepPdfBlobFromSheets(sheetEls, {
        captureFn,
        jsPdfCtor,
        scale,
        onCaptureStart(index) {
          exportState.currentSheetIndex = index;
          exportState.currentExportStep = `capture:${attemptLabel}`;
        },
        onStage(stage, index) {
          exportState.currentSheetIndex = index;
          exportState.currentExportStep = `${stage}:${attemptLabel}`;
        }
      });
    } catch (error) {
      if (error instanceof MepPdfExportError) {
        exportState.currentExportStep = `${error.stage}:${attemptLabel}`;
        if (Number.isFinite(error.pageIndex)) exportState.currentSheetIndex = error.pageIndex;
      }
      logMepExportError(error.message || "MEP-PDF-Erzeugung fehlgeschlagen", error, exportState);
      throw error;
    }

    exportState.currentExportStep = `shareOrDownload:${attemptLabel}`;
    try {
      const deliveryResult = await shareOrDownloadPdfBlob(blob, exportState.filename);
      exportState.deliveryMethod = deliveryResult?.deliveryMethod || null;
    } catch (error) {
      if (error instanceof MepPdfExportError) {
        exportState.currentExportStep = error.stage;
      }
      logMepExportError("shareOrDownloadPdfBlob fehlgeschlagen", error, exportState);
      throw error;
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
      throw new MepPdfExportError("prepare.root", "MEP-Exportansicht konnte nicht erzeugt werden.");
    }

    exportState.currentExportStep = "prepare.resources";
    await waitForMepCaptureResources(exportRoot);
    await waitForAnimationFrames(2);

    // Nur die fertig gerenderten, direkten Druckseiten erfassen. Unterelemente
    // einer Seite dürfen nie als zusätzliche Capture-Blöcke interpretiert werden.
    const sheetEls = [...exportRoot.querySelectorAll(".mepTplPages > .mepTplSheet")];
    exportState.totalSheets = sheetEls.length;
    if (!sheetEls.length) {
      throw new MepPdfExportError("prepare.sheets", "Keine MEP-Seiten zum Export gefunden.");
    }

    const exportScale = isIosLikeDevice() ? 1.25 : 2;
    await runExportAttempt(sheetEls, exportScale, "default");
  } catch (error) {
    logMepExportError("PDF-Export fehlgeschlagen", error, exportState);
    offerMepExportFallback(exportState);
  } finally {
    removeMepPdfExportRoot(exportRoot);

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

function buildMepPdfBlobFromCanvases(pageCanvases, options = {}) {
  const jsPdfCtor = options.jsPdfCtor || window.jspdf?.jsPDF;
  if (typeof jsPdfCtor !== "function") {
    throw new Error("PDF-Export ist noch nicht verfügbar.");
  }

  if (!Array.isArray(pageCanvases) || !pageCanvases.length) {
    throw new Error("Keine MEP-Canvas-Seiten zum Export vorhanden.");
  }

  const pdf = new jsPdfCtor({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true
  });

  pageCanvases.forEach((canvas, index) => {
    if (!canvas) {
      throw new Error(`MEP-Canvas für Seite ${index + 1} fehlt.`);
    }
    if (index > 0) {
      pdf.addPage("a4", "landscape");
    }
    // Anders als die Wochenblöcke der Übersicht ist jeder MEP-Canvas bereits
    // eine vollständig paginierte Druckseite. Seine Pixelhöhe darf deshalb
    // keine weitere Seite und keinen Canvas-Ausschnitt erzeugen.
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 297, 210, undefined, "FAST");
  });

  return pdf.output("blob");
}

async function exportOverviewPdf() {
  const jsPdfCtor = window.jspdf?.jsPDF;
  const captureFn = window.html2canvas;
  if (typeof jsPdfCtor !== "function" || typeof captureFn !== "function") {
    alert("PDF-Export ist noch nicht verfügbar. Bitte Seite neu laden und erneut versuchen.");
    return;
  }

  const originalButtonLabel = btnPrintEl?.textContent || "Drucken / PDF";

  try {
    if (btnPrintEl) {
      btnPrintEl.disabled = true;
      btnPrintEl.textContent = "Übersicht wird exportiert …";
    }

    const blob = await buildOverviewPdfBlob({ jsPdfCtor, captureFn });
    const overviewFilename = buildOverviewPdfFilename();
    await shareOrDownloadPdfBlob(blob, overviewFilename, {
      shareTitle: "Monatsübersicht PDF",
      shareText: "Übersicht als PDF"
    });
  } catch (error) {
    console.error("Übersichts-Export fehlgeschlagen", error);
    alert("Der Export der Übersicht ist fehlgeschlagen. Bitte erneut versuchen.");
  } finally {
    if (btnPrintEl) {
      btnPrintEl.disabled = false;
      updatePrintButtonLabel();
      if (originalButtonLabel && btnPrintEl.textContent !== originalButtonLabel) {
        updatePrintButtonLabel();
      }
    }
  }
}

async function buildOverviewPdfBlob(options = {}) {
  const jsPdfCtor = options.jsPdfCtor || window.jspdf?.jsPDF;
  const captureFn = options.captureFn || window.html2canvas;
  if (typeof jsPdfCtor !== "function" || typeof captureFn !== "function") {
    throw new Error("PDF-Export ist noch nicht verfügbar.");
  }

  let exportRoot = null;
  try {
    renderOverviewView();
    await waitForAnimationFrames(2);

    exportRoot = createOverviewPdfExportRoot({ createdAt: options.createdAt || new Date() });
    if (!exportRoot) {
      throw new Error("Übersicht konnte nicht für den Export vorbereitet werden.");
    }

    await waitForAnimationFrames(2);

    const exportViewEl = exportRoot.querySelector(".overviewPdfExportView");
    const exportBlocks = [...exportRoot.querySelectorAll(".overviewPdfExportView .overviewWeekSection")];
    if (!exportViewEl || !exportBlocks.length) {
      throw new Error("Keine Wochenblöcke für den Export gefunden.");
    }

    const scale = 2;
    const blockCanvases = [];

    for (const blockEl of exportBlocks) {
      const canvas = await captureFn(blockEl, {
        backgroundColor: "#ffffff",
        scale,
        useCORS: true
      });
      blockCanvases.push(canvas);
    }

    return buildOverviewPdfBlobFromCanvases(blockCanvases, { jsPdfCtor });
  } finally {
    exportRoot?.remove();
  }
}

function buildOverviewPdfBlobFromCanvases(blockCanvases, options = {}) {
  const jsPdfCtor = options.jsPdfCtor || window.jspdf?.jsPDF;
  if (typeof jsPdfCtor !== "function") {
    throw new Error("PDF-Export ist noch nicht verfügbar.");
  }
  if (!Array.isArray(blockCanvases) || !blockCanvases.length) {
    throw new Error("Keine Übersichts-Blöcke zum Export gefunden.");
  }

  const pdf = new jsPdfCtor({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const contentWidthMm = pageWidth - margin * 2;
  const contentHeightMm = pageHeight - margin * 2;
  let pageCount = 0;

  blockCanvases.forEach((canvas, index) => {
    if (!canvas || !canvas.width || !canvas.height) {
      throw new Error(`Ungültiger Canvas-Block für Übersicht an Position ${index + 1}.`);
    }

    const widthScale = contentWidthMm / canvas.width;
    const maxSliceHeightPx = Math.max(1, Math.floor(contentHeightMm / widthScale));
    const sliceCount = Math.ceil(canvas.height / maxSliceHeightPx);

    for (let sliceIndex = 0; sliceIndex < sliceCount; sliceIndex += 1) {
      if (pageCount > 0) {
        pdf.addPage("a4", "portrait");
      }

      const sourceY = sliceIndex * maxSliceHeightPx;
      const sourceHeight = Math.min(maxSliceHeightPx, canvas.height - sourceY);
      let pageCanvas = canvas;

      if (sliceCount > 1) {
        const canvasFactory = options.canvasFactory || (() => document.createElement("canvas"));
        pageCanvas = canvasFactory();
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const pageContext = pageCanvas.getContext("2d");
        if (!pageContext) {
          throw new Error(`Canvas-Ausschnitt für Übersicht an Position ${index + 1} konnte nicht erstellt werden.`);
        }
        pageContext.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceHeight,
          0,
          0,
          canvas.width,
          sourceHeight
        );
      }

      const renderedHeightMm = sourceHeight * widthScale;
      pdf.addImage(
        pageCanvas.toDataURL("image/png"),
        "PNG",
        margin,
        margin,
        contentWidthMm,
        renderedHeightMm,
        undefined,
        "FAST"
      );
      pageCount += 1;
    }
  });

  return pdf.output("blob");
}

async function uploadOverviewPdf() {
  const originalLabel = btnOverviewUploadEl?.textContent || "Übersicht hochladen";
  const filename = buildOverviewPdfFilename();
  try {
    if (btnOverviewUploadEl) {
      btnOverviewUploadEl.disabled = true;
      btnOverviewUploadEl.textContent = "Übersicht wird hochgeladen …";
    }

    // Immer aus der aktuell gerenderten zentralen Planung erzeugen. Ein zuvor
    // exportierter Monats-Blob darf nach Planänderungen nicht erneut hochgeladen werden.
    const blob = await buildOverviewPdfBlob();

    const uploadResult = await uploadOverviewPdfToGoogleDrive(blob, filename);
    const actionLabel = uploadResult.action === "updated" ? "aktualisiert" : "neu hochgeladen";
    alert(`Drive-Upload erfolgreich: ${uploadResult.filename} wurde im Zielordner ${actionLabel}.`);
  } catch (driveError) {
    console.error("Drive-Upload fehlgeschlagen", driveError);
    alert(`Drive-Upload fehlgeschlagen: ${driveError.message || driveError}`);
  } finally {
    if (btnOverviewUploadEl) {
      btnOverviewUploadEl.disabled = false;
      btnOverviewUploadEl.textContent = originalLabel;
    }
  }
}

// Hinweis:
// `uploadOverviewPdf`/Drive-Helfer sind bewusst optional und nutzen den bereits
// erzeugten lokalen PDF-Blob. Neue Cloud-/API-Funktionalität wird hier nicht
// eingeführt; der lokale Exportpfad bleibt unabhängig nutzbar.
