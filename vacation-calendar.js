// Annual requests are separate from approved absences. No vacation counters change.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.WochenplanVacationCalendar = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  // SH mainland, state holiday ordinance; school-specific movable days excluded.
  const schoolHolidays2027 = [
    ["2027-01-01", "2027-01-06"], ["2027-03-30", "2027-04-10"],
    ["2027-05-07", "2027-05-07"], ["2027-07-03", "2027-08-14"],
    ["2027-10-11", "2027-10-23"], ["2027-12-23", "2027-12-31"]
  ];
  const layout = { width: 842, height: 595, x: 18, y: 38, tableWidth: 806, header: 22, row: 16.1, font: 6.4, line: 7.1, nameWidth: 48 };
  const record = value => value && typeof value === "object" && !Array.isArray(value);
  const text = value => typeof value === "string" && value.trim().length > 0;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function validDate(iso) {
    if (typeof iso !== "string" || !/^(19|20)\d{2}-\d{2}-\d{2}$/.test(iso)) return false;
    const value = new Date(iso + "T12:00:00Z");
    return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === iso;
  }
  function validateRequest(request) {
    if (!record(request) || !text(request.id) || !text(request.employeeId) || !text(request.employeeName) || request.employeeName.length > 100) return "Bitte eine Person aus dem Team auswählen.";
    if (!validDate(request.from) || !validDate(request.to)) return "Bitte gültige Daten zwischen 1900 und 2099 eingeben.";
    if (request.to < request.from) return "Das Enddatum muss am oder nach dem Anfangsdatum liegen.";
    if (Number(request.to.slice(0, 4)) - Number(request.from.slice(0, 4)) > 1) return "Ein Urlaubszeitraum darf höchstens zwei Kalenderjahre berühren.";
    return "";
  }
  function emptyData() { return { title: "", requests: [], printNames: {} }; }
  function validateData(data) {
    if (data === undefined) return ""; // Existing backups have no calendar yet.
    if (!record(data) || typeof data.title !== "string" || data.title.length > 100 || !Array.isArray(data.requests) || !record(data.printNames)) return "Die Urlaubswünsche in den Planungsdaten sind ungültig.";
    const ids = new Set();
    for (const request of data.requests) {
      if (validateRequest(request) || ids.has(request.id)) return "Die Urlaubswünsche enthalten einen ungültigen oder doppelten Eintrag.";
      ids.add(request.id);
    }
    if (Object.values(data.printNames).some(name => !text(name) || name.length > 100)) return "Die Drucknamen in den Urlaubswünschen sind ungültig.";
    return "";
  }
  function copyData(data) {
    const error = validateData(data);
    if (error) throw new Error(error);
    return data === undefined ? emptyData() : JSON.parse(JSON.stringify(data));
  }
  function saveRequest(data, request, printName) {
    const error = validateRequest(request);
    if (error) throw new Error(error);
    const next = copyData(data);
    if (next.requests.some(item => item.id !== request.id && item.employeeId === request.employeeId && item.from <= request.to && item.to >= request.from)) {
      throw new Error("Für diese Person gibt es bereits einen überlappenden Urlaubswunsch. Bitte den vorhandenen Zeitraum bearbeiten.");
    }
    const index = next.requests.findIndex(item => item.id === request.id);
    if (index < 0) next.requests.push({ ...request }); else next.requests[index] = { ...request };
    const label = String(printName || "").trim();
    if (label) next.printNames = { ...next.printNames, [request.employeeId]: label }; else delete next.printNames[request.employeeId];
    const problem = validateData(next);
    if (problem) throw new Error(problem);
    return next;
  }
  function datesForYear(year) {
    if (!Number.isInteger(year) || year < 1900 || year > 2099) throw new Error("Bitte ein Jahr zwischen 1900 und 2099 wählen.");
    const dates = [];
    for (let month = 0; month < 12; month++) {
      const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      for (let day = 1; day <= count; day++) {
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const weekday = new Date(iso + "T12:00:00Z").getUTCDay();
        dates.push({ iso, month, day, weekend: weekday === 0 || weekday === 6 });
      }
    }
    return dates;
  }
  // Count each person's requested date only once, in UTC (including across DST).
  // Empty holiday data means unknown, never a verified zero-holiday year.
  function countVacationDays(requests, holidaysForYear, year) {
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2099)) throw new Error("Bitte ein Jahr zwischen 1900 und 2099 wählen.");
    const dates = new Map(), holidaySets = new Map(), missingYears = new Set();
    for (const request of requests) {
      const error = validateRequest(request); if (error) throw new Error(error);
      const from = year === undefined ? request.from : (request.from < `${year}-01-01` ? `${year}-01-01` : request.from);
      const to = year === undefined ? request.to : (request.to > `${year}-12-31` ? `${year}-12-31` : request.to);
      for (let time = Date.parse(from + "T12:00:00Z"); time <= Date.parse(to + "T12:00:00Z"); time += 86400000) {
        const date = new Date(time), iso = date.toISOString().slice(0, 10);
        dates.set(JSON.stringify([request.employeeId, iso]), { iso, year: date.getUTCFullYear(), weekday: date.getUTCDay() });
      }
    }
    let days = 0, sundays = 0, holidays = 0;
    for (const date of dates.values()) {
      if (!holidaySets.has(date.year)) {
        const entries = holidaysForYear(date.year);
        if (!entries?.length) missingYears.add(date.year);
        holidaySets.set(date.year, new Set((entries || []).map(entry => entry.date)));
      }
      if (date.weekday === 0) sundays++;
      else if (holidaySets.get(date.year).has(date.iso)) holidays++;
      else days++;
    }
    return { days: missingYears.size ? null : days, sundays, holidays, missingYears: [...missingYears].sort() };
  }
  function totalsByPerson(data, employees, year, holidaysForYear) {
    data = copyData(data);
    const team = new Map((employees || []).map(person => [person.id, person.name]));
    const people = new Map();
    for (const request of data.requests) {
      if (request.from > `${year}-12-31` || request.to < `${year}-01-01`) continue;
      if (!people.has(request.employeeId)) people.set(request.employeeId, { id: request.employeeId, name: team.get(request.employeeId) || request.employeeName, requests: [] });
      people.get(request.employeeId).requests.push(request);
    }
    return [...people.values()].map(person => ({ id: person.id, name: person.name, ...countVacationDays(person.requests, holidaysForYear, year) }));
  }
  function wrapName(name, measure = value => Array.from(value).length * layout.font * 0.58) {
    const lines = [];
    let line = "";
    for (const word of String(name).trim().split(/\s+/)) {
      const next = line ? line + " " + word : word;
      if (measure(next) <= layout.nameWidth) { line = next; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) {
        if (line && measure(line + character) > layout.nameWidth) { lines.push(line); line = ""; }
        line += character;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }
  // Display only; IDs and stored names remain unchanged. Include archived people
  // from requests so a shared first name can never silently become ambiguous.
  function personLabels(data, employees) {
    const people = new Map();
    for (const request of data?.requests || []) people.set(request.employeeId, request.employeeName.trim());
    for (const person of employees || []) people.set(person.id, person.name.trim());
    const firstName = name => name.includes(",") ? name.slice(name.indexOf(",") + 1).trim() || name : name.split(/\s+/)[0];
    const key = name => name.normalize("NFC").toLocaleLowerCase("de-DE");
    const counts = new Map();
    for (const name of people.values()) { const first = key(firstName(name)); counts.set(first, (counts.get(first) || 0) + 1); }
    return new Map([...people].map(([id, name]) => [id, counts.get(key(firstName(name))) > 1 ? name : firstName(name)]));
  }
  function buildSheets(data, employees, year, measure) {
    data = copyData(data);
    const dates = datesForYear(year);
    const from = `${year}-01-01`, to = `${year}-12-31`;
    const requests = data.requests.filter(item => item.from <= to && item.to >= from);
    const labels = personLabels(data, employees);
    const people = new Map();
    for (const request of requests) {
      if (!people.has(request.employeeId)) {
        const name = Object.hasOwn(data.printNames, request.employeeId) ? data.printNames[request.employeeId] : labels.get(request.employeeId);
        const lines = wrapName(name, measure);
        if (lines.length > 2) throw new Error(`Der Druckname „${name}“ ist zu lang. Bitte im Eingabefeld einen kürzeren Drucknamen eintragen.`);
        people.set(request.employeeId, { id: request.employeeId, name, lines, dates: new Set() });
      }
      const person = people.get(request.employeeId);
      for (const date of dates) if (request.from <= date.iso && date.iso <= request.to) person.dates.add(date.iso);
    }
    const order = new Map((employees || []).map((employee, index) => [employee.id, index]));
    const sorted = [...people.values()].sort((a, b) => (order.get(a.id) ?? 99999) - (order.get(b.id) ?? 99999));
    const pages = [];
    for (const person of sorted) {
      let page = pages.find(candidate => [...person.dates].every(iso => (candidate.used.get(iso) || 0) + person.lines.length <= 2));
      if (!page) { page = { people: [], used: new Map() }; pages.push(page); }
      page.people.push(person);
      for (const iso of person.dates) page.used.set(iso, (page.used.get(iso) || 0) + person.lines.length);
    }
    if (!pages.length) pages.push({ people: [], used: new Map() });
    return { year, title: data.title, pages, dates };
  }
  function renderSheet(model, pageIndex, holidays = []) {
    const page = model.pages[pageIndex], l = layout, col = l.tableWidth / 12;
    const byIso = new Map(model.dates.map(date => [date.iso, date]));
    const holidayMap = new Map(holidays.map(holiday => [holiday.date, holiday.name]));
    const rect = (x, y, w, h, fill, stroke = "none") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width=".35"/>`;
    const label = (x, y, value, size = 8, extra = "") => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escape(value)}</text>`;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l.width} ${l.height}" role="img" aria-label="Urlaubswünsche ${model.year}, Blatt ${pageIndex + 1}" font-family="Arial, sans-serif" fill="#111">`;
    svg += rect(0, 0, l.width, l.height, "#fff");
    const heading = `Urlaubsplanung ${model.year}${model.title ? " · " + model.title : ""}`;
    svg += label(l.x, 23, heading, 15, 'font-weight="bold"' + (heading.length > 80 ? ' textLength="710" lengthAdjust="spacingAndGlyphs"' : ""));
    svg += label(824, 23, `Blatt ${pageIndex + 1} / ${model.pages.length}`, 8, 'text-anchor="end"');
    for (let month = 0; month < 12; month++) {
      const x = l.x + month * col;
      svg += rect(x, l.y, col, l.header, "#ededed", "#777");
      svg += label(x + col / 2, l.y + 14, months[month], 8.4, 'text-anchor="middle" font-weight="bold"');
      for (let day = 1; day <= 31; day++) {
        const y = l.y + l.header + (day - 1) * l.row;
        const iso = `${model.year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const date = byIso.get(iso);
        svg += rect(x, y, col, l.row, !date ? "#e1e1e1" : date.weekend ? "#f0f0f0" : "#fff", "#999");
        if (!date) continue;
        const school = model.year === 2027 && schoolHolidays2027.some(([from, to]) => iso >= from && iso <= to);
        if (school || holidayMap.has(iso)) svg += rect(x + .4, y + .4, 12.5, l.row - .8, holidayMap.has(iso) ? "#fff57b" : "#f9bfd7");
        svg += label(x + 2.3, y + 10.5, day, 8, 'font-weight="bold"');
        const lines = page.people.filter(person => person.dates.has(iso)).flatMap(person => person.lines);
        lines.forEach((line, index) => { svg += label(x + 15.5, y + (lines.length === 1 ? 10.2 : 6.5 + index * l.line), line, l.font, `data-vacation-name="true" data-cell-right="${x + col - 1}"`); });
        if (!lines.length && holidayMap.has(iso)) svg += label(x + 15.5, y + 9.6, holidayMap.get(iso), 4.2, 'textLength="46" lengthAdjust="spacingAndGlyphs"');
      }
    }
    svg += label(18, 576, "Urlaubswünsche · noch keine Genehmigung", 7);
    svg += rect(258, 568, 9, 9, "#fff57b") + label(271, 575, "Feiertag SH", 6.8);
    if (model.year === 2027) svg += rect(345, 568, 9, 9, "#f9bfd7") + label(358, 575, "Schulferien SH (Festland; ohne bewegliche Tage)", 6.8);
    svg += label(824, 576, `${page.people.length} Personen`, 7, 'text-anchor="end"');
    return svg + "</svg>";
  }
  function printDocument(model, holidays) {
    const pages = model.pages.map((_, index) => `<section class="sheet">${renderSheet(model, index, holidays)}</section>`).join("");
    return `<!doctype html><html lang="de"><meta charset="utf-8"><title>Urlaubsplanung ${model.year}</title><style>
      @page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#e8e8e8}.sheet{width:297mm;height:210mm;background:white;margin:12px auto;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}.sheet svg{display:block;width:100%;height:100%}button{display:block;margin:12px auto;padding:12px 24px;font:16px Arial}@media print{body{background:white}button{display:none}.sheet{margin:0;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style><button type="button" onclick="window.print()">Drucken / als PDF sichern</button>${pages}</html>`;
  }
  return { emptyData, validateData, validateRequest, copyData, saveRequest, datesForYear, countVacationDays, totalsByPerson, personLabels, wrapName, buildSheets, renderSheet, printDocument, layout };
});
