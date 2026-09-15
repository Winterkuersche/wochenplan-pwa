const DAILY_STAFFING_GROUPS = [
  { key: "early", label: "Früh" },
  { key: "fullDay", label: "Ganzer Tag" },
  { key: "between", label: "Dazwischen" },
  { key: "late", label: "Spät" }
];

function getDailyStaffingGroup(entry) {
  const sourceEntry = entry?.sourceEntry || entry;
  const start = normalizePlanTime(sourceEntry?.start || "");
  const end = normalizePlanTime(sourceEntry?.end || "");
  if (!start || !end) return null;

  const startsEarly = start === "08:55" || start === "09:00";
  const endsLate = end === "19:00" || end === "19:10";
  const startsLater = hhmmToMinutes(start) > hhmmToMinutes("09:00");
  const endsEarlier = hhmmToMinutes(end) < hhmmToMinutes("19:00");

  if (startsEarly && endsLate) return "fullDay";
  if (startsEarly) return "early";
  if (endsLate) return "late";
  if (startsLater && endsEarlier) return "between";
  return null;
}

function getDailyStaffingFirstName(name) {
  const storedName = String(name || "").trim();
  if (!storedName) return "—";

  const separatorIndex = storedName.indexOf(",");
  if (separatorIndex === -1) return storedName;

  return storedName.slice(separatorIndex + 1).trim() || storedName.slice(0, separatorIndex).trim() || "—";
}

function buildDailyStaffingForDays(days, employees, getResolvedEntry) {
  const mondayThroughSaturday = (Array.isArray(days) ? days : []).filter((day) => {
    const weekday = day?.date instanceof Date ? day.date.getDay() : 0;
    return weekday >= 1 && weekday <= 6;
  });

  return mondayThroughSaturday.map((day) => {
    const groups = Object.fromEntries(DAILY_STAFFING_GROUPS.map(({ key }) => [key, []]));

    (employees || []).forEach((employee) => {
      const resolvedEntry = getResolvedEntry(employee, day.iso);
      const sourceEntry = resolvedEntry?.sourceEntry || resolvedEntry;
      const group = getDailyStaffingGroup(resolvedEntry);
      if (group) {
        groups[group].push({
          name: getDailyStaffingFirstName(employee.name),
          start: normalizePlanTime(sourceEntry?.start || ""),
          end: normalizePlanTime(sourceEntry?.end || "")
        });
      }
    });

    return { day, groups };
  });
}

function buildDailyStaffingMarkup(days, employees, getResolvedEntry) {
  const staffingDays = buildDailyStaffingForDays(days, employees, getResolvedEntry);
  if (!staffingDays.length) return "";

  return `
    <section class="dailyStaffing noExport" aria-label="Tagesbesetzung Montag bis Samstag">
      <h4 class="dailyStaffingTitle">Tagesbesetzung</h4>
      <div class="dailyStaffingDays">
        ${staffingDays.map(({ day, groups }) => `
          <article class="dailyStaffingDay">
            <h5>${escapeHtml(day.weekdayLabel || "")} <span>${String(day.date.getDate()).padStart(2, "0")}.${String(day.date.getMonth() + 1).padStart(2, "0")}</span></h5>
            <div class="dailyStaffingGroups">
              ${DAILY_STAFFING_GROUPS.map(({ key, label }) => {
                const people = groups[key];
                return `
                  <div class="dailyStaffingGroup dailyStaffingGroup--${key}${people.length ? "" : " is-empty"}">
                    <div class="dailyStaffingGroupHeading"><span>${label}</span><strong aria-label="${people.length} Personen">${people.length}</strong></div>
                    ${people.length ? `<div class="dailyStaffingNames">${people.map(({ name }) => `<span class="dailyStaffingName">${escapeHtml(name)}</span>`).join("")}</div>` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function buildDailyStaffingPdfTableMarkup(days, employees, getResolvedEntry) {
  const staffingDays = buildDailyStaffingForDays(days, employees, getResolvedEntry);
  if (!staffingDays.length) return "";

  return `
    <section class="dailyStaffingPdf exportOnly" aria-label="Tagesbesetzung Montag bis Samstag">
      <h4 class="dailyStaffingPdfTitle">Tagesbesetzung</h4>
      <table class="dailyStaffingPdfTable">
        <thead>
          <tr>
            <th>Tag</th>
            ${DAILY_STAFFING_GROUPS.map(({ key, label }) => `<th class="dailyStaffingPdfGroup--${key}">${label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${staffingDays.map(({ day, groups }) => `
            <tr>
              <th>${escapeHtml(day.weekdayLabel || "")} <span>${String(day.date.getDate()).padStart(2, "0")}.${String(day.date.getMonth() + 1).padStart(2, "0")}</span></th>
              ${DAILY_STAFFING_GROUPS.map(({ key }) => {
                const people = groups[key];
                const peopleMarkup = people.map(({ name, start, end }) => `
                  <span class="dailyStaffingPdfPerson"><b>${escapeHtml(name)}</b> <small>${escapeHtml(start)}–${escapeHtml(end)}</small></span>
                `).join("");
                return `<td class="dailyStaffingPdfGroup--${key}"><strong>${people.length}</strong><span class="dailyStaffingPdfPeople">${people.length ? peopleMarkup : "—"}</span></td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}
