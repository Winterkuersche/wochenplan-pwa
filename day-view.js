function renderDayView() {
  const body = document.getElementById("vacationTableBody");
  if (!body) return;

  body.innerHTML = "";

  state.employees.forEach((emp) => {
    const total = Number(emp.vacationDays || 0);
    const used = getUsedVacationDaysForEmployee(emp);
    const remaining = getRemainingVacationDaysForEmployee(emp);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${emp.name || "—"}</td>
      <td>${total}</td>
      <td>${used}</td>
      <td>${remaining}</td>
    `;

    body.appendChild(tr);
  });
}
