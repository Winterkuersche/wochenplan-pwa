function renderFormView(){

  const root=document.getElementById("formView");
  root.innerHTML="";

  if(!state.monthPlan) return;

  state.monthPlan.weeks.forEach(week=>{

    const div=document.createElement("div");
    div.className="printSheet";

    const table=document.createElement("table");
    table.className="mepTable";

    const body=document.createElement("tbody");

    state.employees.forEach(emp=>{

      const tr=document.createElement("tr");

      const name=document.createElement("td");
      name.textContent=emp.name;
      tr.appendChild(name);

      week.forEach(d=>{

        const td=document.createElement("td");

        if(d.isOutsideMonth){
          td.style.background="#eee";
        }

        const shift=getShift(emp,d.iso);
        td.textContent=shift;

        tr.appendChild(td);
      });

      body.appendChild(tr);

    });

    table.appendChild(body);
    div.appendChild(table);
    root.appendChild(div);

  });

}
