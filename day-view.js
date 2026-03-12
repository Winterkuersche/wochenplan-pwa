function formatVacationRange(entry) {
  if (!entry?.from || !entry?.to) return "—";

  const from = fromIsoDate(entry.from);
  const to = fromIsoDate(entry.to);

  if (!from || !to) {
    return `${entry.from} – ${entry.to}`;
  }

  const fromText = `${pad2(from.getDate())}.${pad2(from.getMonth() + 1)}.${from.getFullYear()}`;
  const toText = `${pad2(to.getDate())}.${pad2(to.getMonth() + 1)}.${to.getFullYear()}`;

  return `${fromText} – ${toText}`;
}

function renderDayView() {
  const body = document.getElementById("vacationTableBody");
  if (!body) return;

  body.innerHTML = "";

  state.employees.forEach((emp) => {
    const total = Number(emp.vacationDays || 0);
    const used = getUsedVacationDaysForEmployee(emp);
    const remaining = getRemainingVacationDaysForEmployee(emp);
    const entries = getVacationEntriesForEmployee(emp.id);

    const rangesHtml = entries.length
      ? entries
          .sort((a, b) => a.from.localeCompare(b.from))
          .map((entry) => `<div class="vacationRangeItem">${formatVacationRange(entry)}</div>`)
          .join("")
      : `<span class="small">—</span>`;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${emp.name || "—"}</td>
      <td>${total}</td>
      <td>${used}</td>
      <td>${remaining}</td>
      <td class="vacationRangesCell">${rangesHtml}</td>
    `;

    body.appendChild(tr);
  });
}
