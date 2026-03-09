function formatShortDateForDay(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
}

function renderDayTabs() {
  if (!dayTabsEl) return;

  const weekDays = getActiveWeekDays();
  dayTabsEl.innerHTML = "";

  weekDays.slice(0, 6).forEach((day, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${day.weekdayLabel} ${formatShortDateForDay(day.date)}`;

    if (index === currentDayIndex) {
      btn.classList.add("active");
    }

    if (day.isOutsideMonth) {
      btn.style.background = "#eee";
      btn.style.color = "#666";
    }

    btn.addEventListener("click", () => {
      currentDayIndex = index;
      renderAllViews();
    });

    dayTabsEl.appendChild(btn);
  });
}

function buildPlannerCard(emp, isoDate) {
  const currentShift = getShiftForEmployeeOnIso(emp, isoDate);
  const shift = getShiftByKey(currentShift);

  const card = document.createElement("div");
  card.className = "dayCard";

  const title = document.createElement("div");
  title.className = "dayCardTitle";
  title.textContent = emp.name || "—";

  const sub = document.createElement("div");
  sub.className = "dayCardSub";
  sub.textContent = `${emp.roleKey || "-"} · Soll ${emp.target || "0:00"}`;

  const select = document.createElement("select");
  select.className = `weekSelect ${getShiftClassByKey(currentShift)}`;

  SHIFTS.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.key;
    opt.textContent = s.key;
    select.appendChild(opt);
  });

  select.value = currentShift;

  select.addEventListener("change", () => {
    setShiftForEmployeeOnIso(emp, isoDate, select.value);
    select.className = `weekSelect ${getShiftClassByKey(select.value)}`;
    savePlanData();
    renderAllViews();
  });

  const info = document.createElement("div");
  info.className = "dayCardSub";

  if (shift.start && shift.end) {
    const pause = getFormPauseText(currentShift);
    const sum = minutesToHM(netMinutesForShift(currentShift));
    info.textContent = pause
      ? `${shift.start}–${shift.end} · Pause ${pause} · ${sum}`
      : `${shift.start}–${shift.end} · ${sum}`;
  } else {
    info.textContent = "Kein Einsatz";
  }

  card.appendChild(title);
  card.appendChild(sub);
  card.appendChild(select);
  card.appendChild(info);

  return card;
}

function renderDayMeta() {
  const dayObj = getCurrentDayObject();
  if (!dayObj) return;

  if (metaDayNameEl) {
    metaDayNameEl.textContent = `${dayObj.weekdayLabel} ${formatShortDateForDay(dayObj.date)}`;
  }

  if (dayHoursInfoEl) {
    dayHoursInfoEl.textContent = `Geplante Arbeitsstunden: ${minutesToHM(totalMinutesForDayIso(dayObj.iso))}`;
  }

  if (dayWarningsEl) {
    const warnings = getDayWarningsByIndex(currentDayIndex);
    dayWarningsEl.textContent = warnings.length ? warnings.join(" ") : "Keine Warnungen.";
  }
}

function renderDayPlannerList() {
  if (!plannerListEl) return;

  const dayObj = getCurrentDayObject();
  plannerListEl.innerHTML = "";
  if (!dayObj) return;

  const employeesSorted = [...state.employees].sort((a, b) => {
    const aShift = getShiftForEmployeeOnIso(a, dayObj.iso);
    const bShift = getShiftForEmployeeOnIso(b, dayObj.iso);

    const aType = getShiftByKey(aShift).type || "";
    const bType = getShiftByKey(bShift).type || "";

    const order = {
      early: 1,
      full: 2,
      late: 3,
      lateNo: 4,
      free: 5
    };

    return (order[aType] || 99) - (order[bType] || 99);
  });

  employeesSorted.forEach((emp) => {
    plannerListEl.appendChild(buildPlannerCard(emp, dayObj.iso));
  });
}

function renderDayView() {
  renderDayTabs();
  renderDayMeta();
  renderDayPlannerList();
}
