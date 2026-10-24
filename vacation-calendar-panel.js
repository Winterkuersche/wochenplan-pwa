(function () {
  "use strict";
  const api = window.WochenplanVacationCalendar;
  const el = id => document.getElementById(id);
  const form = el("vacationCalendarForm");
  if (!form) return;
  let distribution = null;
  let editingId = null, expected = null, dirty = false, endFollowsStart = true, renderedYear = null;
  const fields = ["vacationRequestEmployee", "vacationRequestFrom", "vacationRequestTo", "vacationRequestPrintName", "vacationCalendarTitle"];
  const signature = () => JSON.stringify(state.vacationCalendar || api.emptyData());
  const say = (text, error = false) => { el("vacationCalendarMessage").textContent = text; el("vacationCalendarMessage").classList.toggle("isError", error); };
  function selectedYear() { return Number(el("vacationCalendarYear").value); }
  const holidaysForYear = year => getHolidaysForStateYear("schleswig-holstein", year);
  const dayLabel = count => count.days === null ? `Keine verlässliche Tagezahl: Feiertage für ${count.missingYears.join(", ")} fehlen` : `${count.days} ${count.days === 1 ? "Urlaubstag" : "Urlaubstage"}`;
  function defaultDates() {
    const first = `${selectedYear()}-01-01`;
    el("vacationRequestFrom").value = first; el("vacationRequestTo").value = first;
    endFollowsStart = true;
  }
  function draftCount() {
    const request = { id: "draft", employeeId: el("vacationRequestEmployee").value || "draft", employeeName: "Eingabe", from: el("vacationRequestFrom").value, to: el("vacationRequestTo").value };
    el("vacationRequestDayCount").textContent = api.validateRequest(request) ? "Bitte einen gültigen Zeitraum wählen." : `Dieser Zeitraum: ${dayLabel(api.countVacationDays([request], holidaysForYear))}.`;
  }
  function markDirty() {
    if (!dirty) expected = signature();
    dirty = true;
  }
  function reset() {
    dirty = false; expected = null; editingId = null; endFollowsStart = true;
    el("vacationRequestFrom").value = ""; el("vacationRequestTo").value = "";
    el("vacationRequestSave").textContent = "Urlaubswunsch speichern";
    el("vacationRequestCancel").hidden = true;
    render();
  }
  function personName() {
    const id = el("vacationRequestEmployee").value;
    el("vacationRequestPrintName").value = state.vacationCalendar?.printNames?.[id] || "";
  }
  function commit(data) {
    flushPendingAutoSave();
    if (localDataStore.blocked || !localDataStore.isCurrent()) throw new Error("Der gespeicherte Plan wurde inzwischen geändert. Bitte die Eingabe sichern und die App neu laden.");
    const before = state.vacationCalendar;
    state.vacationCalendar = data;
    if (!saveAppState()) { state.vacationCalendar = before; throw new Error(saveStatusMessage || "Speichern fehlgeschlagen. Die Eingabe bleibt erhalten."); }
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  function model() {
    if (context) context.font = `${api.layout.font}px Arial`;
    return api.buildExportModel(state.vacationCalendar, state.employees, selectedYear(), context ? name => context.measureText(name).width : undefined, holidaysForYear,
      context ? (value, font) => { context.font = `${font}px Arial`; return context.measureText(value).width; } : undefined);
  }
  function holidays() { return getHolidaysForStateYear("schleswig-holstein", selectedYear()); }
  function preview() {
    try {
      const sheets = model();
      el("vacationCalendarPreview").innerHTML = sheets.pages.map((_, i) => `<div class="vacationCalendarSheet">${api.renderSheet(sheets, i, holidays())}</div>`).join("");
      el("vacationCalendarPageCount").textContent = `${sheets.pages.length} ${sheets.pages.length === 1 ? "Blatt" : "Blätter"} in A4 quer, einschließlich einer Teamübersicht mit allen Mitarbeitern · Bis zu drei Namenszeilen pro Tagesfeld; weitere Kalenderblätter bei Bedarf.`;
      el("vacationCalendarPrint").disabled = false;
    } catch (error) {
      el("vacationCalendarPreview").replaceChildren();
      el("vacationCalendarPageCount").textContent = error.message;
      el("vacationCalendarPrint").disabled = true;
    }
  }
  function render() {
    const data = state.vacationCalendar || api.emptyData();
    if (!el("vacationCalendarYear").value) el("vacationCalendarYear").value = uiState.vacationCalendarYear || Math.min(2099, new Date().getFullYear() + 1);
    const year = selectedYear();
    if (!dirty) {
      const selected = el("vacationRequestEmployee").value;
      const select = el("vacationRequestEmployee"); select.replaceChildren();
      for (const employee of api.peopleForYear(state.employees, year)) {
        const option = document.createElement("option"); option.value = employee.id; option.textContent = employee.name; select.append(option);
      }
      if ([...select.options].some(option => option.value === selected)) select.value = selected;
      el("vacationCalendarTitle").value = data.title;
      personName();
    }
    renderedYear = year;
    if (!dirty && !el("vacationRequestFrom").value && !el("vacationRequestTo").value) defaultDates();
    const labels = api.personLabels(data, state.employees);
    const totalsById = new Map(api.totalsByPerson(data, state.employees, year, holidaysForYear).map(person => [person.id, person]));
    const requests = data.requests.filter(item => item.from <= `${year}-12-31` && item.to >= `${year}-01-01`)
      .slice().sort((a, b) => a.from.localeCompare(b.from) || a.employeeName.localeCompare(b.employeeName));
    const list = el("vacationCalendarRequests");
    const openPeople = new Set([...list.querySelectorAll("details[open]")].map(node => node.dataset.employeeId));
    list.replaceChildren();
    const groups = new Map();
    for (const id of [...new Set(requests.map(request => request.employeeId))].sort((a, b) => labels.get(a).localeCompare(labels.get(b), "de"))) {
      const item = document.createElement("li"), details = document.createElement("details"), summary = document.createElement("summary"), entries = document.createElement("ul");
      details.className = "vacationPerson"; details.dataset.employeeId = id; details.open = openPeople.has(id);
      const number = requests.filter(request => request.employeeId === id).length;
      summary.textContent = `${labels.get(id)} · ${number} ${number === 1 ? "Zeitraum" : "Zeiträume"} · ${dayLabel(totalsById.get(id))}`;
      entries.className = "vacationPersonRequests";
      details.append(summary, entries); item.append(details); list.append(item); groups.set(id, entries);
    }
    el("vacationCalendarExpand").disabled = !requests.length; el("vacationCalendarCollapse").disabled = !requests.length;
    if (!requests.length) { const p = document.createElement("p"); p.textContent = `Noch keine Urlaubswünsche für ${year} eingetragen.`; list.append(p); }
    for (const request of requests) {
      const row = document.createElement("li"); row.className = "vacationRequestRow";
      const description = document.createElement("span");
      const name = state.employees.find(person => person.id === request.employeeId)?.name || request.employeeName;
      description.textContent = `${formatIsoDateForOverview(request.from)} bis ${formatIsoDateForOverview(request.to)}`;
      const count = document.createElement("small"); count.className = "vacationRequestCount";
      count.textContent = dayLabel(api.countVacationDays([request], holidaysForYear));
      if (request.from.slice(0, 4) !== request.to.slice(0, 4)) count.textContent += ` · davon ${dayLabel(api.countVacationDays([request], holidaysForYear, year))} in ${year}`;
      description.append(count);
      row.append(description);
      for (const action of ["Bearbeiten", "Löschen"]) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = action; button.setAttribute("aria-label", `${action}: ${name} · ${description.textContent}`);
        button.addEventListener("click", () => {
          if (dirty || distribution) { say("Bitte zuerst die offene Eingabe oder Urlaubsverteilung abschließen oder verwerfen.", true); return; }
          if (action === "Löschen") {
            if (!confirm(`Urlaubswunsch von ${name} löschen?`)) return;
            try { const next = api.copyData(state.vacationCalendar); next.requests = next.requests.filter(item => item.id !== request.id); commit(next); render(); say("Urlaubswunsch gelöscht."); }
            catch (error) { say(error.message, true); }
          } else {
            if (![...el("vacationRequestEmployee").options].some(option => option.value === request.employeeId)) {
              const option = document.createElement("option"); option.value = request.employeeId; option.textContent = request.employeeName; el("vacationRequestEmployee").append(option);
            }
            el("vacationRequestEmployee").value = request.employeeId; personName();
            el("vacationRequestFrom").value = request.from; el("vacationRequestTo").value = request.to;
            editingId = request.id; endFollowsStart = false; markDirty(); draftCount();
            el("vacationRequestSave").textContent = "Änderung speichern"; el("vacationRequestCancel").hidden = false;
            form.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        });
        row.append(button);
      }
      groups.get(request.employeeId).append(row);
    }
    const totals = el("vacationCalendarTotals"); totals.replaceChildren();
    const heading = document.createElement("h3"); heading.textContent = `Eingetragene Urlaubstage ${year}`; totals.append(heading);
    for (const person of api.totalsByPerson(data, state.employees, year, holidaysForYear)) {
      const p = document.createElement("p"); p.textContent = `${labels.get(person.id)}: ${dayLabel(person)}`; totals.append(p);
    }
    if (!requests.length) { const p = document.createElement("p"); p.textContent = "Noch keine Urlaubstage eingetragen."; totals.append(p); }
    el("vacationCalendarYearNote").textContent = year === 2027
      ? "Feiertage und Schulferien Schleswig-Holstein (Festland) sind für 2027 markiert. Bewegliche Schultage sind nicht enthalten."
      : "Für dieses Jahr sind keine Schulferien hinterlegt." + (holidays().length ? "" : " Feiertage sind ebenfalls nicht hinterlegt.");
    draftCount(); preview();
  }
  for (const [id, open] of [["vacationCalendarExpand", true], ["vacationCalendarCollapse", false]]) el(id).addEventListener("click", () => {
    for (const details of el("vacationCalendarRequests").querySelectorAll("details")) details.open = open;
  });
  for (const field of fields) el(field).addEventListener("input", () => { markDirty(); el("vacationRequestCancel").hidden = false; });
  el("vacationRequestEmployee").addEventListener("change", personName);
  el("vacationRequestFrom").addEventListener("input", () => {
    if (endFollowsStart || !el("vacationRequestTo").value) el("vacationRequestTo").value = el("vacationRequestFrom").value;
    draftCount();
  });
  el("vacationRequestTo").addEventListener("input", () => { endFollowsStart = false; draftCount(); });
  for (const field of ["vacationRequestFrom", "vacationRequestTo"]) el(field).addEventListener("focus", () => {
    if (!el(field).value) { el(field).value = (field === "vacationRequestTo" && el("vacationRequestFrom").value) || `${selectedYear()}-01-01`; draftCount(); }
  });
  el("vacationCalendarYear").addEventListener("change", () => {
    if (!Number.isInteger(selectedYear()) || selectedYear() < 1900 || selectedYear() > 2099) { say("Bitte ein Jahr zwischen 1900 und 2099 wählen.", true); return; }
    if (dirty || distribution) { el("vacationCalendarYear").value = renderedYear; say("Bitte die offene Eingabe oder Urlaubsverteilung zuerst abschließen oder verwerfen, bevor du das Kalenderjahr wechselst.", true); return; }
    uiState.vacationCalendarYear = selectedYear(); saveUiState(); defaultDates(); render();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    try {
      if (distribution) throw new Error("Bitte die Urlaubsverteilung zuerst übernehmen oder verwerfen.");
      if (dirty && signature() !== expected) throw new Error("Die Urlaubswünsche wurden inzwischen geändert. Deine Eingabe bleibt erhalten; bitte den aktuellen Stand vergleichen.");
      const employeeId = el("vacationRequestEmployee").value;
      const employee = state.employees.find(person => person.id === employeeId);
      const previous = state.vacationCalendar?.requests.find(item => item.id === editingId);
      if (!editingId && !api.peopleForYear(state.employees, selectedYear()).some(person => person.id === employeeId)) throw new Error("Bitte eine im Planungsjahr aktive Person auswählen.");
      const next = api.saveRequest(state.vacationCalendar, {
        id: editingId || crypto.randomUUID(), employeeId, employeeName: employee?.name || previous?.employeeName || "",
        from: el("vacationRequestFrom").value, to: el("vacationRequestTo").value
      }, el("vacationRequestPrintName").value);
      next.title = el("vacationCalendarTitle").value.trim();
      const error = api.validateData(next); if (error) throw new Error(error);
      commit(next); reset(); say("Urlaubswunsch gespeichert. Der Wochenplan bleibt unverändert.");
    } catch (error) { say(error.message, true); }
  });
  el("vacationRequestCancel").addEventListener("click", () => { reset(); say("Eingabe verworfen."); });
  let exporting = false;
  async function print() {
    if (exporting) return;
    if (dirty || distribution) { say("Bitte die offene Eingabe oder Urlaubsverteilung zuerst speichern oder verwerfen. Exportiert werden die gespeicherten Urlaubswünsche.", true); return; }
    exporting = true; el("vacationCalendarPrint").disabled = true;
    try {
      const sheets = model();
      say("PDF wird erstellt …");
      const blob = await buildVacationCalendarPdf(sheets, holidays());
      await shareOrDownloadPdfBlob(blob, `Urlaubsplanung-${sheets.year}.pdf`);
      say("PDF erstellt: A4 quer, ohne Browser-Adresse oder Datum in der Fußzeile.");
    } catch (error) { say(error.message, true); }
    finally { exporting = false; preview(); }
  }
  el("vacationCalendarPrint").addEventListener("click", print);
  const distributor = window.WochenplanVacationDistribution;
  // Use the same status resolver as the planner, including directly entered U/K cells.
  const distributionAbsences = () => [...(state.absences || []), ...Object.entries(state.schedule || {}).flatMap(([iso, entries]) =>
    Object.entries(entries || {}).flatMap(([employeeId, entry]) => {
      const type = getEntryStatus(entry);
      return type === "vacation" || type === "sick" ? [{ employeeId, type, from: iso, to: iso }] : [];
    }))];
  const distributionSignature = () => JSON.stringify([state.vacationCalendar || api.emptyData(), state.employees, distributionAbsences()]);
  const distributionMessage = (message, error = false) => {
    el("vacationDistributionMessage").textContent = message;
    el("vacationDistributionMessage").classList.toggle("isError", error);
  };
  function distributionOptions() {
    return { data: state.vacationCalendar, employees: state.employees, absences: distributionAbsences(), year: distribution.year,
      holidaysForYear, budgets: distribution.budgets, selectedIds: distribution.selectedIds, notBefore: distribution.notBefore, proposals: distribution.proposals };
  }
  function checkDistributionSource() {
    if (dirty) throw new Error("Bitte die offene manuelle Eingabe zuerst speichern oder verwerfen.");
    if (distributionSignature() !== distribution.expected) throw new Error("Team, Urlaubswünsche oder Abwesenheiten wurden inzwischen geändert. Bitte die Vorschau verwerfen und neu berechnen.");
  }
  function distributionReport() {
    try {
      checkDistributionSource();
      const report = distributor.assess(distributionOptions());
      for (const person of report.people) {
        const summary = el("vacationDistributionPreview").querySelector(`[data-distribution-summary="${CSS.escape(person.id)}"]`);
        if (summary) summary.textContent = `${person.name}: ${person.total} / ${person.budget} Tage (${person.existing} vorhanden, ${person.added} neu) · bis 30. Juni: ${person.firstHalf} / ${person.target} · längster Block: ${person.longest} Tage · gleichzeitig maximal ${Number.isFinite(person.maxConcurrentMinutes) ? Math.floor(person.maxConcurrentMinutes / 60) + ":" + String(person.maxConcurrentMinutes % 60).padStart(2, "0") + " / 50:00 Wochenstunden" : "unbekannte Wochenstunden"}. ${person.warnings.join(" ")}`;
      }
      for (const row of el("vacationDistributionPreview").querySelectorAll("[data-proposal-id]")) {
        const proposal = distribution.proposals.find(item => item.id === row.dataset.proposalId);
        row.querySelector("small").textContent = api.validateRequest(proposal) ? "Bitte gültige Daten eingeben." : dayLabel(api.countVacationDays([proposal], holidaysForYear));
      }
      distributionMessage([...report.errors, ...report.notices, "Die Schichtbesetzung bitte anschließend prüfen. Offene Ziele sind oben je Person angegeben."].join(" "), !!report.errors.length);
      el("vacationDistributionAdopt").disabled = !!report.errors.length || !distribution.proposals.length;
    } catch (error) { distributionMessage(error.message, true); el("vacationDistributionAdopt").disabled = true; }
  }
  function showDistributionPreview() {
    const preview = el("vacationDistributionPreview"); preview.replaceChildren();
    for (const id of distribution.selectedIds) {
      const details = document.createElement("details"), summary = document.createElement("summary");
      details.className = "vacationDistributionPerson"; details.open = true;
      summary.dataset.distributionSummary = id; details.append(summary);
      for (const proposal of distribution.proposals.filter(item => item.employeeId === id)) {
        const row = document.createElement("div"); row.className = "vacationDistributionRow"; row.dataset.proposalId = proposal.id;
        for (const [key, label] of [["from", "Von"], ["to", "Bis einschließlich"]]) {
          const field = document.createElement("label"), input = document.createElement("input");
          field.textContent = label; input.type = "date"; input.value = proposal[key];
          input.min = `${distribution.year}-01-01`; input.max = `${distribution.year}-12-31`;
          input.addEventListener("input", () => { proposal[key] = input.value; distributionReport(); }); field.append(input); row.append(field);
        }
        const count = document.createElement("small"), remove = document.createElement("button");
        remove.type = "button"; remove.textContent = "Vorschlag verwerfen";
        remove.addEventListener("click", () => { distribution.proposals = distribution.proposals.filter(item => item !== proposal); row.remove(); distributionReport(); });
        row.append(count, remove); details.append(row);
      }
      preview.append(details);
    }
    distributionReport();
  }
  el("vacationDistributionOpen").addEventListener("click", () => {
    if (distribution) return;
    if (dirty) { say("Bitte die offene Eingabe zuerst speichern oder verwerfen.", true); return; }
    try {
      flushPendingAutoSave();
      const year = selectedYear(), today = new Date();
      const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const notBefore = localDate > `${year}-01-01` ? localDate : `${year}-01-01`;
      const people = distributor.eligiblePeople(state.vacationCalendar, state.employees, year, notBefore);
      distribution = { year, expected: distributionSignature(), budgets: {}, selectedIds: [], proposals: [], notBefore };
      el("vacationDistribution").hidden = false; el("vacationDistributionOpen").disabled = true;
      el("vacationDistributionStart").value = notBefore; el("vacationDistributionStart").min = notBefore; el("vacationDistributionStart").max = `${year}-12-31`;
      const list = el("vacationDistributionPeople"); list.replaceChildren();
      for (const person of people) {
        const row = document.createElement("div"); row.className = "vacationDistributionChoice"; row.dataset.employeeId = person.id;
        const label = document.createElement("label"), check = document.createElement("input"), name = document.createElement("span");
        check.type = "checkbox"; check.checked = true;
        name.textContent = `${person.name} · Wochen-Soll ${person.target || "fehlt"}`;
        label.append(check, name);
        const budgetLabel = document.createElement("label"), budget = document.createElement("input");
        budgetLabel.textContent = `Jahreskontingent ${year}`; budget.type = "number"; budget.min = "0"; budget.max = "366"; budget.step = "1";
        budget.value = person.totalVacationDays ?? person.vacationDays ?? 30; budgetLabel.append(budget); row.append(label, budgetLabel); list.append(row);
      }
      el("vacationDistributionGenerate").disabled = !people.length;
      distributionMessage(people.length ? "Personen und Kontingente prüfen. Noch nichts gespeichert." : `Keine aktiven Mitarbeiter ohne Urlaubswünsche für ${year} gefunden.`);
    } catch (error) { say(error.message, true); }
  });
  el("vacationDistributionGenerate").addEventListener("click", () => {
    try {
      checkDistributionSource();
      distribution.selectedIds = []; distribution.budgets = {};
      for (const row of el("vacationDistributionPeople").children) {
        if (!row.querySelector('input[type="checkbox"]').checked) continue;
        const input = row.querySelector('input[type="number"]');
        if (!input.value || !input.checkValidity()) throw new Error("Bitte gültige ganze Jahreskontingente eingeben.");
        distribution.selectedIds.push(row.dataset.employeeId); distribution.budgets[row.dataset.employeeId] = Number(input.value);
      }
      if (!distribution.selectedIds.length) throw new Error("Bitte mindestens eine Person auswählen.");
      const start = el("vacationDistributionStart");
      if (!start.value || !start.checkValidity()) throw new Error("Bitte einen gültigen frühesten Beginn im Planungsjahr wählen.");
      distribution.notBefore = start.value;
      distribution.proposals = distributor.propose(distributionOptions()).proposals;
      el("vacationDistributionSettings").hidden = true;
      el("vacationDistributionBack").hidden = false; el("vacationDistributionAdopt").hidden = false;
      showDistributionPreview();
    } catch (error) { distributionMessage(error.message, true); }
  });
  el("vacationDistributionBack").addEventListener("click", () => {
    distribution.proposals = []; el("vacationDistributionPreview").replaceChildren();
    el("vacationDistributionSettings").hidden = false; el("vacationDistributionBack").hidden = true; el("vacationDistributionAdopt").hidden = true;
    distributionMessage("Vorschläge verworfen. Einstellungen anpassen und neu berechnen.");
  });
  function closeDistribution() {
    distribution = null; el("vacationDistribution").hidden = true; el("vacationDistributionOpen").disabled = false;
    el("vacationDistributionPreview").replaceChildren(); el("vacationDistributionSettings").hidden = false;
    el("vacationDistributionBack").hidden = true; el("vacationDistributionAdopt").hidden = true;
  }
  el("vacationDistributionCancel").addEventListener("click", closeDistribution);
  el("vacationDistributionAdopt").addEventListener("click", () => {
    try {
      checkDistributionSource();
      if (!distribution.proposals.length) throw new Error("Keine Vorschläge zum Übernehmen vorhanden.");
      const next = distributor.adopt(distributionOptions(), () => crypto.randomUUID());
      commit(next); closeDistribution(); render();
      say("Vorschläge als Urlaubswünsche gespeichert. Jeder Zeitraum bleibt über Bearbeiten und Löschen änderbar; keine Genehmigung oder Änderung der Schichten.");
    } catch (error) { distributionMessage(error.message, true); }
  });
  window.WochenplanVacationCalendarPanel = { render, print, hasOpenDraft: () => dirty || !!distribution };
  window.addEventListener("beforeunload", event => {
    if (dirty || distribution) { event.preventDefault(); event.returnValue = ""; }
  });
  window.addEventListener("wochenplan:update-waiting", () => say("Ein App-Update ist bereit. Bitte die offene Eingabe zuerst speichern und die App danach neu öffnen."));
  render();
})();
