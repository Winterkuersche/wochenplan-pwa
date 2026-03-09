function createWeekSelect(emp,iso){
  const sel=document.createElement("select");

  SHIFTS.forEach(s=>{
    const o=document.createElement("option");
    o.value=s.key;
    o.textContent=s.key;
    sel.appendChild(o);
  });

  const val=getShift(emp,iso);
  sel.value=val;
  sel.className=`weekSelect ${getShiftClassByKey(val)}`;

  sel.addEventListener("change",()=>{
    setShift(emp,iso,sel.value);
    sel.className=`weekSelect ${getShiftClassByKey(sel.value)}`;
    renderAllViews();
  });

  return sel;
}

function renderWeekView(){
  const body=document.getElementById("weekTableBody");
  body.innerHTML="";

  const week=getActiveWeekDays();
  const days=week.slice(0,6);

  state.employees.forEach(emp=>{

    const tr=document.createElement("tr");

    const name=document.createElement("td");
    name.textContent=emp.name;
    tr.appendChild(name);

    days.forEach(d=>{
      const td=document.createElement("td");
      td.appendChild(createWeekSelect(emp,d.iso));
      tr.appendChild(td);
    });

    const ist=document.createElement("td");
    ist.textContent=minutesToHM(totalMinutesForEmployee(emp));
    tr.appendChild(ist);

    const delta=document.createElement("td");
    delta.textContent="";
    tr.appendChild(delta);

    const soll=document.createElement("td");
    soll.textContent=emp.target||"";
    tr.appendChild(soll);

    body.appendChild(tr);

  });
}
