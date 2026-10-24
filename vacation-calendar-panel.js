(function () {
  "use strict";
  const api = window.WochenplanVacationCalendar;
  const el = id => document.getElementById(id);
  const form = el("vacationCalendarForm");
  if (!form) return;
  let editingId = null, expected = null, dirty = false;
  const fields = ["vacationRequestEmployee", "vacationRequestFrom", "vacationRequestTo", "vacationRequestPrintName", "vacationCalendarTitle"];
  const signature = () => JSON.stringify(state.vacationCalendar || api.emptyData());
  const say = (text, error = false) => { el("vacationCalendarMessage").textContent = text; el("vacationCalendarMessage").classList.toggle("isError", error); };
  function selectedYear() { return Number(el("vacationCalendarYear").value); }
  function markDirty() {
    if (!dirty) expected = signature();
    dirty = true;
  }
  function reset() {
    dirty = false; expected = null; editingId = null;
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
    return api.buildSheets(state.vacationCalendar, state.employees, selectedYear(), context ? name => context.measureText(name).width : undefined);
  }
  function holidays() { return getHolidaysForStateYear("schleswig-holstein", selectedYear()); }
  function preview() {
    try {
      const sheets = model();
      el("vacationCalendarPreview").innerHTML = sheets.pages.map((_, i) => `<div class="vacationCalendarSheet">${api.renderSheet(sheets, i, holidays())}</div>`).join("");
      el("vacationCalendarPageCount").textContent = `${sheets.pages.length} ${sheets.pages.length === 1 ? "Blatt" : "Blätter"} in A4 quer · Namen werden bei Überschneidungen auf weitere Blätter verteilt.`;
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
    if (!dirty) {
      const selected = el("vacationRequestEmployee").value;
      const select = el("vacationRequestEmployee"); select.replaceChildren();
      for (const employee of state.employees) {
        const option = document.createElement("option"); option.value = employee.id; option.textContent = employee.name; select.append(option);
      }
      if ([...select.options].some(option => option.value === selected)) select.value = selected;
      el("vacationCalendarTitle").value = data.title;
      personName();
    }
    const year = selectedYear();
    const requests = data.requests.filter(item => item.from <= `${year}-12-31` && item.to >= `${year}-01-01`)
      .slice().sort((a, b) => a.from.localeCompare(b.from) || a.employeeName.localeCompare(b.employeeName));
    const list = el("vacationCalendarRequests"); list.replaceChildren();
    if (!requests.length) { const p = document.createElement("p"); p.textContent = `Noch keine Urlaubswünsche für ${year} eingetragen.`; list.append(p); }
    for (const request of requests) {
      const row = document.createElement("li"); row.className = "vacationRequestRow";
      const description = document.createElement("span");
      const name = state.employees.find(person => person.id === request.employeeId)?.name || request.employeeName;
      description.textContent = `${name} · ${formatIsoDateForOverview(request.from)} bis ${formatIsoDateForOverview(request.to)}`;
      row.append(description);
      for (const action of ["Bearbeiten", "Löschen"]) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = action; button.setAttribute("aria-label", `${action}: ${description.textContent}`);
        button.addEventListener("click", () => {
          if (dirty) { say("Bitte zuerst die offene Eingabe speichern oder verwerfen.", true); return; }
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
            editingId = request.id; markDirty();
            el("vacationRequestSave").textContent = "Änderung speichern"; el("vacationRequestCancel").hidden = false;
            form.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        });
        row.append(button);
      }
      list.append(row);
    }
    el("vacationCalendarYearNote").textContent = year === 2027
      ? "Feiertage und Schulferien Schleswig-Holstein (Festland) sind für 2027 markiert. Bewegliche Schultage sind nicht enthalten."
      : "Für dieses Jahr sind keine Schulferien hinterlegt." + (holidays().length ? "" : " Feiertage sind ebenfalls nicht hinterlegt.");
    preview();
  }
  for (const field of fields) el(field).addEventListener("input", () => { markDirty(); el("vacationRequestCancel").hidden = false; });
  el("vacationRequestEmployee").addEventListener("change", personName);
  el("vacationRequestFrom").addEventListener("change", () => { if (!el("vacationRequestTo").value) el("vacationRequestTo").value = el("vacationRequestFrom").value; });
  el("vacationCalendarYear").addEventListener("change", () => {
    if (!Number.isInteger(selectedYear()) || selectedYear() < 1900 || selectedYear() > 2099) { say("Bitte ein Jahr zwischen 1900 und 2099 wählen.", true); return; }
    uiState.vacationCalendarYear = selectedYear(); saveUiState(); render();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    try {
      if (dirty && signature() !== expected) throw new Error("Die Urlaubswünsche wurden inzwischen geändert. Deine Eingabe bleibt erhalten; bitte den aktuellen Stand vergleichen.");
      const employeeId = el("vacationRequestEmployee").value;
      const employee = state.employees.find(person => person.id === employeeId);
      const previous = state.vacationCalendar?.requests.find(item => item.id === editingId);
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
  function print() {
    if (dirty) { say("Bitte die offene Eingabe zuerst speichern oder verwerfen. Gedruckt werden die gespeicherten Urlaubswünsche.", true); return; }
    try {
      const html = api.printDocument(model(), holidays());
      const tab = window.open("", "_blank");
      if (!tab) throw new Error("Bitte das neue Druckfenster im Browser erlauben und erneut auf Drucken tippen.");
      tab.opener = null; tab.document.open(); tab.document.write(html); tab.document.close();
      tab.requestAnimationFrame(() => tab.requestAnimationFrame(() => { tab.focus(); tab.print(); }));
    } catch (error) { say(error.message, true); }
  }
  el("vacationCalendarPrint").addEventListener("click", print);
  window.WochenplanVacationCalendarPanel = { render, print, hasOpenDraft: () => dirty };
  window.addEventListener("beforeunload", event => {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  });
  window.addEventListener("wochenplan:update-waiting", () => say("Ein App-Update ist bereit. Bitte die offene Eingabe zuerst speichern und die App danach neu öffnen."));
  render();
})();
