function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatShortDate(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
}

function getWeekDatesFromState() {
  const startStr =
    state.weekStart ||
    state.week?.start ||
    state.week?.from ||
    state.weekFrom ||
    "";

  if (!startStr) return null;

  const start = new Date(startStr);
  if (Number.isNaN(start.getTime())) return null;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function renderMepDateHeader() {
  const ids = [
    "mepDateMo",
    "mepDateDi",
    "mepDateMi",
    "mepDateDo",
   