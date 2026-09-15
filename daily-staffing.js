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

function buildDailyStaffingForDays(days, employees, getResolvedEntry) {
  return (Array.isArray(days) ? days : []).slice(0, 6).filter(Boolean).map((day) => {
    const groups = Object.fromEntries(DAILY_STAFFING_GROUPS.map(({ key }) => [key, []]));

    (employees || []).forEach((employee) => {
      const group = getDailyStaffingGroup(getResolvedEntry(employee, day.iso));
      if (group) groups[group].push(employee.name || "—");
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
                const names = groups[key];
                return `
                  <div class="dailyStaffingGroup dailyStaffingGroup--${key}">
                    <div class="dailyStaffingGroupHeading"><span>${label}</span><strong aria-label="${names.length} Personen">${names.length}</strong></div>
                    <div class="dailyStaffingNames">${names.length ? names.map(escapeHtml).join(", ") : "—"}</div>
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
