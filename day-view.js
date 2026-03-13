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

function openVacationDialog(emp) {
  const defaultIso = state.weekFrom || toIsoDate(new Date());

  openShiftDialog("U", {
    emp,
    isoDate: defaultIso,
    type: "U"
  });
}

function openVacationEntryDialog(emp, entry) {
  if (!emp || !entry) return;

  openShiftDialog("U", {
    emp,
    isoDate: entry.from,
    type: "U"
  });

  if (typeof shiftDialogAbsenceFrom !== "undefined" && shiftDialogAbsenceFrom) {
    shiftDialogAbsenceFrom.value = entry.from;
  }

  if (typeof shiftDialogAbsenceTo !== "undefined" && shiftDialogAbsenceTo) {
    shiftDialogAbsenceTo.value = entry.to;
  }
}

function renderVacationRangesForEmployee(emp) {
  const entries = getVacationEntriesForEmployee(emp.id)
    .slice()
    .sort((a, b) => a.from.localeCompare(b.from));

  if (!entries.length) {
    return `<span class="small">—</span>`;
  }

  return entries
    .map((entry) => {
      const text = formatVacationRange(entry);

      return `
        <div class="vacationRangeItem">
          <span class="vacationRangeText">${text}</span>
          <button
            type="button"
            class="vacationRangeEditBtn"
            data-emp-id="${emp.id}"
            data-entry-id="${entry.id}"
            title="Urlaub bearbeiten"
          >✎</button>
          <button
            type="button"
            class="vacationRangeDeleteBtn"
            data-entry-id="${entry.id}"
            title="Urlaub löschen"
          >🗑</button>
        </div>
      `;
    })
    .join("");
}

function bindVacationRangeActions() {
  document.querySelectorAll(".vacationRangeEditBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const empId = btn.dataset.empId;
      const entryId = btn.dataset.entryId;

      const emp = state.employees.find((e) => e.id === empId);
      const entry = (state.absences || []).find((a) => a.id === entryId);

      if (!emp || !entry) return;

      openVacationEntryDialog(emp, entry);
    });
  });

  document.querySelectorAll(".vacationRangeDeleteBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entryId = btn.dataset.entryId;
      const entry = (state.absences || []).find((a) => a.id === entryId);

      if (!entry) return;

      if (!confirm("Diesen Urlaubszeitraum löschen?")) return;

      removeAbsence(entryId);
    });
  });
}

function renderDayView() {
  const body = document.getElementById("vacationTableBody");
  if (!body) return;

  body.innerHTML = "";

  const year = new Date().getFullYear();

  state.employees.forEach((emp) => {
    const summary = getVacationSummaryForEmployee(emp, year);
    const months = getVacationMonthsForEmployee(emp, year);
    const rangesHtml = renderVacationRangesForEmployee(emp);

    const tr = document.createElement("tr");


   

let monthsHtml = "";

months.forEach((hasVacation, i) => {
  monthsHtml += `
    <td class="vacMonthCell">
      ${hasVacation ? "U" : "-"}
    </td>
  `;
});
    
   tr.innerHTML = `
<td>${emp.name || "—"}</td>
<td>${summary.total}</td>
<td>${summary.used}</td>
<td>${summary.remaining}</td>
<td class="vacationRangesCell">${rangesHtml}</td>
`;

const actionCell = document.createElement("td");

const addBtn = document.createElement("button");
addBtn.type = "button";
addBtn.textContent = "+ Urlaub";
addBtn.addEventListener("click", () => {
  openVacationDialog(emp);
});

actionCell.appendChild(addBtn);
tr.appendChild(actionCell);

tr.insertAdjacentHTML("beforeend", monthsHtml);

body.appendChild(tr);
  });

  bindVacationRangeActions();
}
function getVacationMonthsForEmployee(emp, year) {
  const months = new Array(12).fill(false);

  const entries = getVacationEntriesForEmployee(emp.id);

  entries.forEach((entry) => {
    const from = fromIsoDate(entry.from);
    const to = fromIsoDate(entry.to);

    if (!from || !to) return;

    const cursor = new Date(from);

    while (cursor <= to) {
      if (cursor.getFullYear() === year) {
        const m = cursor.getMonth();
        months[m] = true;
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return months;
}
