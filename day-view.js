function renderDayTabs(){

  const tabs=document.getElementById("dayTabs");
  tabs.innerHTML="";

  const week=getActiveWeekDays();

  week.slice(0,6).forEach((d,i)=>{

    const b=document.createElement("button");
    b.textContent=d.weekdayLabel;

    if(i===currentDayIndex) b.className="active";

    b.onclick=()=>{
      currentDayIndex=i;
      renderAllViews();
    };

    tabs.appendChild(b);
  });
}

function renderDayView(){

  renderDayTabs();

  const list=document.getElementById("plannerList");
  list.innerHTML="";

  const day=getActiveWeekDays()[currentDayIndex];
  if(!day) return;

  state.employees.forEach(emp=>{

    const div=document.createElement("div");
    div.className="dayCard";

    const title=document.createElement("div");
    title.textContent=emp.name;

    const sel=document.createElement("select");

    SHIFTS.forEach(s=>{
      const o=document.createElement("option");
      o.value=s.key;
      o.textContent=s.key;
      sel.appendChild(o);
    });

    sel.value=getShift(emp,day.iso);

    sel.onchange=()=>{
      setShift(emp,day.iso,sel.value);
      renderAllViews();
    };

    div.appendChild(title);
    div.appendChild(sel);

    list.appendChild(div);
  });
}
