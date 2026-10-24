// Local A4 PDF generation: no browser print headers and no external capture service.
async function buildVacationCalendarPdf(model, holidays) {
  const writer = new MepPdfBlobWriter(model.pages.length);
  const width = 2526, height = 1785; // Three pixels per layout point; sequential pages limit memory.
  for (let index = 0; index < model.pages.length; index++) {
    const svg = WochenplanVacationCalendar.renderSheet(model, index, holidays).replace("<svg ", '<svg width="842" height="595" ');
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const canvas = document.createElement("canvas");
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve; image.onerror = () => reject(new Error("Die Kalenderseite konnte nicht für das PDF geladen werden.")); image.src = url;
      });
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PDF-Erstellung wird auf diesem Gerät nicht unterstützt.");
      context.fillStyle = "#fff"; context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const jpeg = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 1));
      if (!jpeg) throw new Error("Die Kalenderseite konnte nicht als PDF-Bild gespeichert werden.");
      writer.addJpegPage(jpeg, width, height);
    } finally { URL.revokeObjectURL(url); canvas.width = 0; canvas.height = 0; }
  }
  return writer.outputBlob();
}
