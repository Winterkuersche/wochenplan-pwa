function renderTabs() {
  if (!dayTabsEl) return;

  dayTabsEl.innerHTML = "";

  DAYS.forEach(d => {
    const btn = document.createElement("button");
    btn.className = `tabBtn${currentDay === d.key ? " active" : ""}`;
    btn.textContent = d.label;

    btn.addEventListener("click", () => {
      currentDay = d.key;
      renderSummary();
      renderDayView();
    });

    dayTabsEl.appendChild(btn);
  });
}

function renderPlanner() {
  if (!plannerListEl) return;

  const dayObj = DAYS.find(d => d.key === currentDay);
  if (metaDayNameEl) {
    metaDayNameEl.textContent = dayObj ? dayObj.full : currentDay;
  }

  if (dayHoursInfoEl) {
    dayHoursInfoEl.textContent = `Geplante Arbeitsstunden: ${minutesToHM(totalMinutesForDay(currentDay))}`;
  }

  if (dayWarningsEl) {
    const warnings = getDayWarnings(currentDay);
    dayWarningsEl.innerHTML = "";

    if (warnings.length === 0) {
      dayWarningsEl.textContent = "Keine Warnungen.";
    } else {
      warnings.forEach(w => {
        const div = document.createElement("div");
        div.className = "warnLine";
        div.textContent = w;
        dayWarningsEl.appendChild(div);
      });
    }
  }

  plannerListEl.innerHTML = "";

  state.employees.forEach(emp => {
    const wasLateYesterday = hadLateShiftPreviousDay(emp, currentDay);

    const row = document.createElement("div");
    row.className = `planRow${wasLateYesterday ? " prevLate" : ""}`;

    const head = document.createElement("div");
    head.className = "planHead";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="planName">${emp.name || "—"}</div>
      <div class="planSub">${emp.roleKey || "-"} · ${getShiftByKey(emp.days[currentDay]).desc}</div>
    `;

    if (wasLateYesterday) {
      const badge = document.createElement("div");
      badge.className = "prevLateBadge";
      badge.textContent = "Gestern 19:10";
      left.appendChild(badge);
    }

    const right = document.createElement("div");
    right.className = "planHours";
    right.innerHTML = `
      <div><strong>${minutesToHM(totalMinutesForEmployee(emp))}</strong> / ${emp.target || "—"}</div>
      <div class="small">Delta ${formatSignedMinutes(deltaMinutes(emp))}</div>
    `;

    head.appendChild(left);
    head.appendChild(right);

    const btnWrap = document.createElement("div");
    btnWrap.className = "shiftButtons";

    SHIFTS.forEach(shift => {
      const btn = document.createElement("button");
      btn.className = `shiftBtn shift-${getShiftClassByKey(shift.key)}${emp.days[currentDay] === shift.key ? " active" : ""}`;
      btn.textContent = shift.label;
      btn.title = shift.desc;

      btn.addEventListener("click", () => {
        emp.days[currentDay] = shift.key;
        saveWeekData();
        renderAllViews();
      });

      btnWrap.appendChild(btn);
    });

    const legend = document.createElement("div");
    legend.className = "shiftLegend";
    legend.textContent = "- frei · F3 09-12 · F4 09-13 · F5 09-14 · F6 09-15 · G1 09-19:10 · L1-L4 mit Abrechnung · L1E-L4E ohne Abrechnung";

    row.appendChild(head);
    row.appendChild(btnWrap);
    row.appendChild(legend);

    plannerListEl.appendChild(row);
  });
}

function renderDayView() {
  renderTabs();
  renderPlanner();
}
