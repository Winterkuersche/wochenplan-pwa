function getDayData(emp, dayKey) {
  return getFormDataForShift(emp.days?.[dayKey] || "-");
}

function renderMepTable() {
  if (!mepTableBodyEl) return;
  mepTableBodyEl.innerHTML = "";

  state.employees.forEach((emp) => {
    const dayData = {
      mo: getDayData(emp, "mo"),
      di: getDayData(emp, "di"),
      mi: getDayData(emp, "mi"),
      do: getDayData(emp, "do"),
      fr: getDayData(emp, "fr"),
      sa: getDayData(emp, "sa"),
      so: { start: "", pause: "", end: "", sum: "" }
    };

    const rows = [
      { label: "Beginn", key: "start" },
      { label: "Pause",  key: "pause" },
      { label: "Ende",   key: "end" },
      { label: "Summe",  key: "sum" }
    ];

    rows.forEach((rowDef, index) => {
      const tr = document.createElement("tr");

      if (index === 0) {
        const tdName = document.createElement("td");
        tdName.className = "mepNameCell";
        tdName.rowSpan = 4;
        tdName.textContent = emp.name || "—";
        tr.appendChild(tdName);

        const tdFunc = document.createElement("td");
        tdFunc.className = "mepFuncText";
        tdFunc.rowSpan = 4;
        tdFunc.textContent = emp.roleKey || "-";
        tr.appendChild(tdFunc);

        const tdPlan = document.createElement("td");
        tdPlan.className = "mepPlanText";
        tdPlan.rowSpan = 4;
        tdPlan.textContent = emp.target || "-";
        tr.appendChild(tdPlan);
      }

      const tdType = document.createElement("td");
      tdType.className = "mepTypeCell";
      tdType.textContent = rowDef.label;
      tr.appendChild(tdType);

      ["mo", "di", "mi", "do", "fr", "sa", "so"].forEach((dayKey) => {
        const td = document.createElement("td");
        td.className = "mepDayValueCell";
        td.textContent = dayData[dayKey][rowDef.key] || "";
        tr.appendChild(td);
      });

      if (index === 0) {
        const tdWeek = document.createElement("td");
        tdWeek.className = "mepWeekText";
        tdWeek.rowSpan = 4;
        tdWeek.textContent = minutesToHM(totalMinutesForEmployee(emp));
        tr.appendChild(tdWeek);

        const tdMonth = document.createElement("td");
        tdMonth.className = "mepMonthText";
        tdMonth.rowSpan = 4;
        tdMonth.textContent = "";
        tr.appendChild(tdMonth);
      }

      mepTableBodyEl.appendChild(tr);
    });
  });
}

function renderFormView() {
  renderMepTable();
}