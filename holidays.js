if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const message = event?.message || "Unbekannter JavaScript-Fehler";
    const source = event?.filename ? `\n${event.filename}:${event.lineno || "?"}:${event.colno || "?"}` : "";
    const show = () => {
      let box = document.getElementById("planung2RuntimeError");
      if (!box) {
        box = document.createElement("div");
        box.id = "planung2RuntimeError";
        box.style.cssText = "margin:10px;padding:10px;border:1px solid #d92d20;border-radius:10px;background:#3b1111;color:#ffd5d2;font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:pre-wrap";
        const app = document.querySelector(".app") || document.body;
        app.prepend(box);
      }
      box.textContent = `Planung-2 JavaScript-Fehler:\n${message}${source}`;
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show, { once: true });
    else show();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message = reason?.stack || reason?.message || String(reason || "Unbekannter Promise-Fehler");
    const show = () => {
      let box = document.getElementById("planung2RuntimeError");
      if (!box) {
        box = document.createElement("div");
        box.id = "planung2RuntimeError";
        box.style.cssText = "margin:10px;padding:10px;border:1px solid #d92d20;border-radius:10px;background:#3b1111;color:#ffd5d2;font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:pre-wrap";
        const app = document.querySelector(".app") || document.body;
        app.prepend(box);
      }
      box.textContent = `Planung-2 Promise-Fehler:\n${message}`;
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show, { once: true });
    else show();
  });
}

const HOLIDAYS_BY_STATE = {
  "schleswig-holstein": {
    2026: [
      { date: "2026-01-01", name: "Neujahr", code: "H" },
      { date: "2026-04-03", name: "Karfreitag", code: "H" },
      { date: "2026-04-06", name: "Ostermontag", code: "H" },
      { date: "2026-05-01", name: "Tag der Arbeit", code: "H" },
      { date: "2026-05-14", name: "Christi Himmelfahrt", code: "H" },
      { date: "2026-05-25", name: "Pfingstmontag", code: "H" },
      { date: "2026-10-03", name: "Tag der Deutschen Einheit", code: "H" },
      { date: "2026-10-31", name: "Reformationstag", code: "H" },
      { date: "2026-12-25", name: "1. Weihnachtstag", code: "H" },
      { date: "2026-12-26", name: "2. Weihnachtstag", code: "H" }
    ]
  }
};

function getHolidaysForStateYear(stateKey, year) {
  return HOLIDAYS_BY_STATE[stateKey]?.[year] || [];
}

function getHolidayByDate(stateKey, isoDate) {
  if (!isoDate) return null;

  const year = Number(String(isoDate).slice(0, 4));
  if (Number.isNaN(year)) return null;

  const holidays = getHolidaysForStateYear(stateKey, year);
  return holidays.find((holiday) => holiday.date === isoDate) || null;
}

function isHolidayDate(stateKey, isoDate) {
  return !!getHolidayByDate(stateKey, isoDate);
}
