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
      const group = getDailyStaffingGroup(getResolvedEntry(employee, day.iso));
      if (group) groups[group].push(getDailyStaffingFirstName(employee.name));
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
                  <div class="dailyStaffingGroup dailyStaffingGroup--${key}${names.length ? "" : " is-empty"}">
                    <div class="dailyStaffingGroupHeading"><span>${label}</span><strong aria-label="${names.length} Personen">${names.length}</strong></div>
                    ${names.length ? `<div class="dailyStaffingNames">${names.map((name) => `<span class="dailyStaffingName">${escapeHtml(name)}</span>`).join("")}</div>` : ""}
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
