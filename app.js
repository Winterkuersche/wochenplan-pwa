const MAX_WEEKLY_MINUTES = 159 * 60;

let currentDayIndex = 0;

let state = {
  weekFrom: "",
  weekTo: "",
  monthPlan: null,
  employees: []
};

const SHIFTS = [
  { key: "-", type: "free", start: "", end: "" },
  { key: "F3", type: "early", start: "09:00", end: "12:00" },
  { key: "F4", type: "early", start: "09:00", end: "13:00" },
  { key: "F5", type: "early", start: "09:00", end: "14:00" },
  { key: "F6", type: "early", start: "09:00", end: "15:00" },
  { key: "G1", type: "full", start: "09:00", end: "19:10" },
  { key: "L1", type: "late", start: "13:00", end: "19:10" },
  { key: "L2", type: "late", start: "14:00", end: "19:10" },
  { key: "L3", type: "late", start: "15:00", end: "19:10" },
  { key: "L4", type: "late", start: "16:00", end: "19:10" }
];

function pad2(n){
  return String(n).padStart(2,"0");
}

function minutesToHM(min){
  const h=Math.floor(min/60);
  const m=min%60;
  return `${h}:${pad2(m)}`;
}

function hmToMinutes(hm){
  if(!hm) return 0;
  const [h,m]=hm.split(":").map(Number);
  return h*60+m;
}

function getShiftByKey(key){
  return SHIFTS.find(s=>s.key===key)||SHIFTS[0];
}

function getShiftClassByKey(key){
  return getShiftByKey(key).type;
}

function netMinutesForShift(key){
  const s=getShiftByKey(key);
  if(!s.start) return 0;

  let dur=hmToMinutes(s.end)-hmToMinutes(s.start);

  if(key==="G1") dur-=70;
  else if(key.startsWith("L")) dur-=10;

  return dur;
}

function buildEmployees(){
  const names=[
    "Stephan M",
    "Lisa",
    "Anna",
    "Tom",
    "Sarah",
    "Ben",
    "Lara",
    "Mia",
    "Jonas",
    "Leo",
    "Paul",
    "Emma",
    "Noah"
  ];

  state.employees=names.map((n,i)=>({
    id:`emp${i}`,
    name:n,
    roleKey:"",
    target:"",
    shifts:{}
  }));
}

function getShift(emp,iso){
  return emp.shifts[iso]||"-";
}

function setShift(emp,iso,val){
  emp.shifts[iso]=val;
}

function totalMinutesForEmployee(emp){
  const week=getActiveWeekDays();
  return week.reduce((sum,d)=>sum+netMinutesForShift(getShift(emp,d.iso)),0);
}

function totalMinutesForDayIso(iso){
  return state.employees.reduce((s,e)=>s+netMinutesForShift(getShift(e,iso)),0);
}

function totalMinutesForWeek(){
  return state.employees.reduce((s,e)=>s+totalMinutesForEmployee(e),0);
}

function getActiveMonthPlan(){
  if(!state.weekFrom) return null;
  return getMonthPlanFromDateString(state.weekFrom);
}

function syncMonthPlan(){
  state.monthPlan=getActiveMonthPlan();
}

function getActiveWeekDays(){
  if(!state.monthPlan) return [];
  const weeks=state.monthPlan.weeks;

  for(const w of weeks){
    if(w.some(d=>d.iso===state.weekFrom)) return w;
  }

  return weeks[0]||[];
}

function renderSummary(){
  const week=totalMinutesForWeek();
  const rest=MAX_WEEKLY_MINUTES-week;

  document.getElementById("weeklyHoursActual").textContent=minutesToHM(week);
  document.getElementById("weeklyHoursRemaining").textContent=minutesToHM(Math.abs(rest));
}

function renderAllViews(){
  renderSummary();
  renderWeekView();
  renderDayView();
  renderFormView();
}

function initWeek(){
  const today=new Date();
  const iso=`${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
  state.weekFrom=iso;
  syncMonthPlan();
}

window.addEventListener("load",()=>{
  buildEmployees();
  initWeek();
  renderAllViews();
});
