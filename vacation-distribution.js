// Pure, local proposals. Existing wishes/approved absences are never mutated.
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./vacation-calendar") : root.WochenplanVacationCalendar);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.WochenplanVacationDistribution = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (calendar) {
  "use strict";
  const DAY = 86400000;
  const shift = (iso, days) => new Date(Date.parse(iso + "T12:00:00Z") + days * DAY).toISOString().slice(0, 10);
  const intersects = (range, from, to) => range.from <= to && range.to >= from;
  const covers = (ranges, iso) => ranges.some(range => range.from <= iso && range.to >= iso);
  function weeklyMinutes(person) {
    const match = /^(\d{1,3}):([0-5]\d)$/.exec(String(person?.target || "").trim());
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }
  function capacity(people, ids) {
    let minutes = 0;
    for (const id of ids) {
      const value = weeklyMinutes(people.find(person => person.id === id));
      if (value === null) return Infinity; // Unknown hours must not become free capacity.
      minutes += value;
    }
    return minutes;
  }
  function yearDays(year, holidaysForYear) {
    const days = calendar.datesForYear(year), holidays = holidaysForYear(year);
    if (!holidays?.length) throw new Error(`Keine Verteilung: Feiertage für ${year} fehlen.`);
    const excluded = new Set(holidays.map(item => item.date));
    return days.map(day => ({ ...day, countable: new Date(day.iso + "T12:00:00Z").getUTCDay() !== 0 && !excluded.has(day.iso) }));
  }
  function bounds(person, year, notBefore = `${year}-01-01`) {
    const start = person.activeFromMonth ? person.activeFromMonth + "-01" : `${year}-01-01`;
    const end = person.activeToMonth ? shift(shift(person.activeToMonth + "-01", 32).slice(0, 7) + "-01", -1) : `${year}-12-31`;
    return { from: [start, `${year}-01-01`, notBefore].sort().at(-1), to: [end, `${year}-12-31`].sort()[0] };
  }
  function eligiblePeople(data, employees, year, notBefore) {
    calendar.datesForYear(year); data = calendar.copyData(data);
    return employees.filter(person => {
      const limit = bounds(person, year, notBefore);
      return limit.from <= limit.to && !data.requests.some(item => item.employeeId === person.id && intersects(item, `${year}-01-01`, `${year}-12-31`));
    });
  }
  function knownRanges(data, absences) {
    return [...calendar.copyData(data).requests, ...(absences || []).filter(item => item.type === "vacation")];
  }
  function statistics(days, ranges) {
    let total = 0, firstHalf = 0, run = 0, longest = 0;
    for (const day of days) {
      if (!day.countable) continue; // A Sunday/holiday does not interrupt a block.
      if (covers(ranges, day.iso)) { total++; if (day.month < 6) firstHalf++; longest = Math.max(longest, ++run); }
      else run = 0;
    }
    return { total, firstHalf, longest };
  }
  function occupancy(days, ranges) {
    return new Map(days.map(day => [day.iso, new Set(ranges.filter(item => covers([item], day.iso)).map(item => item.employeeId))]));
  }
  function budgetFor(person, budgets) {
    const value = Number(budgets?.[person.id] ?? person.totalVacationDays ?? person.vacationDays ?? 30);
    if (!Number.isInteger(value) || value < 0 || value > 366) throw new Error(`Bitte für ${person.name} ein Jahreskontingent zwischen 0 und 366 ganzen Tagen angeben.`);
    return value;
  }
  function assess({ data, employees, absences = [], year, budgets, proposals = [], holidaysForYear, notBefore, selectedIds }) {
    const days = yearDays(year, holidaysForYear), known = knownRanges(data, absences);
    const eligible = new Set(eligiblePeople(data, employees, year, notBefore).filter(person => !selectedIds || selectedIds.includes(person.id)).map(person => person.id));
    const all = [...known, ...proposals], used = occupancy(days, all), errors = [];
    const blockedDates = days.filter(day => capacity(employees, used.get(day.iso)) > 3000).map(day => day.iso);
    const ids = new Set();
    for (const proposal of proposals) {
      const problem = calendar.validateRequest(proposal), person = employees.find(item => item.id === proposal.employeeId);
      if (problem) { errors.push(problem); continue; }
      if (ids.has(proposal.id)) errors.push("Ein Vorschlag ist doppelt vorhanden."); ids.add(proposal.id);
      if (!person || !eligible.has(proposal.employeeId)) { errors.push("Eine ausgewählte Person hat inzwischen Wünsche oder ist nicht mehr aktiv."); continue; }
      const limit = bounds(person, year, notBefore);
      if (weeklyMinutes(person) === null) errors.push(`${person.name}: Wochen-Sollstunden fehlen oder sind ungültig.`);
      const tooFull = blockedDates.find(iso => covers([proposal], iso));
      if (tooFull) errors.push(`${person.name}: Grenze von 50 Wochen-Sollstunden gleichzeitig im Urlaub am ${tooFull} überschritten oder fremde Sollstunden unbekannt.`);
      if (proposal.from < limit.from || proposal.to > limit.to) errors.push(`${person.name}: Zeitraum liegt außerhalb des Planungsjahrs, des Beschäftigungszeitraums oder vor dem frühesten Beginn.`);
      if (all.some(other => other !== proposal && other.employeeId === person.id && intersects(other, proposal.from, proposal.to))) errors.push(`${person.name}: Eigene Urlaubszeiträume überschneiden sich.`);
      if (absences.some(other => other.employeeId === person.id && other.type === "sick" && intersects(other, proposal.from, proposal.to))) errors.push(`${person.name}: Zeitraum überschneidet sich mit einer Krankmeldung.`);
      if (!days.some(day => day.countable && covers([proposal], day.iso))) errors.push(`${person.name}: Zeitraum enthält keinen anrechenbaren Urlaubstag.`);
    }
    const people = employees.filter(person => eligible.has(person.id)).map(person => {
      const own = all.filter(item => item.employeeId === person.id), before = statistics(days, known.filter(item => item.employeeId === person.id));
      const stats = statistics(days, own), budget = budgetFor(person, budgets), target = Math.ceil(budget / 2), warnings = [];
      const overlapDates = days.filter(day => day.countable && covers(proposals.filter(item => item.employeeId === person.id), day.iso) && [...used.get(day.iso)].some(id => id !== person.id)).map(day => day.iso);
      if (weeklyMinutes(person) === null) warnings.push("Keine Vorschläge: Wochen-Sollstunden fehlen oder sind ungültig.");
      else if (weeklyMinutes(person) > 3000) warnings.push("Eigene Wochen-Sollstunden überschreiten bereits die 50-Stunden-Grenze.");
      if (stats.total < budget) warnings.push(`${budget - stats.total} Tage noch offen.`);
      if (stats.longest < 12) warnings.push("Zusammenhängender 12-Tage-Block nicht erreicht.");
      if (stats.firstHalf < target) warnings.push(`Halbjahresziel: ${target - stats.firstHalf} Tage bis 30. Juni fehlen.`);
      if (overlapDates.length) warnings.push(`${overlapDates.length} Urlaubstage überschneiden sich mit anderen Personen.`);
      if (stats.total > budget) {
        warnings.push(`Jahreskontingent um ${stats.total - budget} Tage überschritten.`);
        if (proposals.some(item => item.employeeId === person.id)) errors.push(`${person.name}: Jahreskontingent überschritten. Bitte Vorschläge kürzen oder Kontingent korrigieren.`);
      }
      const proposalDates = days.filter(day => covers(proposals.filter(item => item.employeeId === person.id), day.iso));
      const maxConcurrentMinutes = Math.max(0, ...proposalDates.map(day => capacity(employees, used.get(day.iso))));
      return { id: person.id, name: person.name, budget, maxConcurrentMinutes, existing: before.total, added: stats.total - before.total, ...stats, target, overlapDates, warnings };
    });
    return { people, errors: [...new Set(errors)], notices: blockedDates.length ? [`An ${blockedDates.length} Kalendertagen liegen vorhandene Urlaube über 50 Wochen-Sollstunden oder Sollstunden fehlen. Dort werden keine zusätzlichen Vorschläge erstellt.`] : [] };
  }
  function propose(options) {
    const { data, employees, absences = [], year, budgets, holidaysForYear, notBefore } = options;
    const days = yearDays(year, holidaysForYear), known = knownRanges(data, absences), proposals = [];
    const used = occupancy(days, known), people = eligiblePeople(data, employees, year, notBefore).filter(person => !options.selectedIds || options.selectedIds.includes(person.id));
    const eligibleDays = days.filter(day => day.countable);
    function add(person, candidate) {
      // Extend an approved block without copying its already approved dates.
      let start = null, end = null;
      function flush() {
        if (start) {
          proposals.push({ id: `proposal-${proposals.length + 1}`, employeeId: person.id, employeeName: person.name, from: start, to: end });
          for (const day of days) if (day.iso >= start && day.iso <= end) used.get(day.iso).add(person.id);
        }
        start = null; end = null;
      }
      for (const day of days.filter(day => day.iso >= candidate.from && day.iso <= candidate.to)) {
        if (covers(known.filter(item => item.employeeId === person.id), day.iso)) { flush(); continue; }
        if (!start && day.countable) start = day.iso;
        if (start && day.countable) end = day.iso;
      }
      flush();
    }
    for (const [personIndex, person] of people.entries()) {
      const budget = budgetFor(person, budgets), limit = bounds(person, year, notBefore);
      if (weeklyMinutes(person) === null || weeklyMinutes(person) > 3000) continue;
      const ownKnown = known.filter(item => item.employeeId === person.id);
      const sick = absences.filter(item => item.employeeId === person.id && item.type === "sick");
      const own = () => [...ownKnown, ...proposals.filter(item => item.employeeId === person.id)];
      function choose(size, firstHalf, allowKnown, targetDay) {
        const current = own(), stats = statistics(days, current), remaining = budget - stats.total;
        const candidates = [];
        for (let index = 0; index + size <= eligibleDays.length; index++) {
          const slice = eligibleDays.slice(index, index + size), from = slice[0].iso, to = slice.at(-1).iso;
          if (from < limit.from || to > limit.to || (firstHalf && to > `${year}-06-30`) || sick.some(range => intersects(range, from, to))) continue;
          if (days.some(day => day.iso >= from && day.iso <= to && capacity(employees, new Set([...used.get(day.iso), person.id])) > 3000)) continue;
          if (proposals.some(range => range.employeeId === person.id && intersects(range, from, to))) continue;
          if (!allowKnown && ownKnown.some(range => intersects(range, from, to))) continue;
          const fresh = slice.filter(day => !covers(current, day.iso));
          if (!fresh.length || fresh.length > remaining) continue;
          const overlaps = fresh.map(day => [...used.get(day.iso)].filter(id => id !== person.id).length);
          const distance = Math.abs(days.findIndex(day => day.iso === from) - targetDay);
          // Prefer no overlapping colleagues, then fewer overlapping person-days.
          // Among equally good dates, distribute blocks around seasonal targets.
          candidates.push({ from, to, score: [Math.max(...overlaps), overlaps.reduce((sum, count) => sum + count, 0), distance] });
        }
        candidates.sort((a, b) => {
          for (let i = 0; i < a.score.length; i++) if (a.score[i] !== b.score[i]) return a.score[i] - b.score[i];
          return a.from.localeCompare(b.from);
        });
        return candidates[0];
      }
      const first = statistics(days, own());
      if (first.longest < 12 && budget >= 12 && first.total < budget) {
        const candidate = choose(12, false, true, 70 + personIndex * 3 % 35);
        if (candidate) add(person, candidate);
      }
      // At most one pass per remaining day; finite even in a completely blocked year.
      for (let pass = 0; pass < 366; pass++) {
        const stats = statistics(days, own()), remaining = budget - stats.total;
        if (remaining <= 0) break;
        const halfMissing = Math.max(0, Math.ceil(budget / 2) - stats.firstHalf);
        let candidate;
        if (halfMissing) {
          for (let size = Math.min(6, remaining, halfMissing); size >= 1 && !candidate; size--) candidate = choose(size, true, false, 145);
        }
        if (!candidate) {
          const target = 225 + ((pass + personIndex) % 2) * 85;
          for (let size = Math.min(6, remaining); size >= 1 && !candidate; size--) candidate = choose(size, false, false, target);
        }
        if (!candidate) break;
        add(person, candidate);
      }
    }
    return { proposals, ...assess({ ...options, proposals }) };
  }
  function adopt(options, makeId) {
    const report = assess(options);
    if (report.errors.length) throw new Error(report.errors.join(" "));
    let next = calendar.copyData(options.data);
    for (const proposal of options.proposals) next = calendar.saveRequest(next, { ...proposal, id: makeId() }, next.printNames[proposal.employeeId]);
    return next;
  }
  return { eligiblePeople, propose, assess, adopt, weeklyMinutes };
});
