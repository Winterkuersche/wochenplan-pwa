"use strict";
function moveEmployeeInOrder(employees,employeeId,offset){
  if(!Array.isArray(employees))return false;
  const from=employees.findIndex(employee=>String(employee?.id)===String(employeeId));
  const to=from+Number(offset);
  if(from<0||!Number.isInteger(to)||to<0||to>=employees.length)return false;
  [employees[from],employees[to]]=[employees[to],employees[from]];
  return true;
}
if(typeof module!=="undefined")module.exports={moveEmployeeInOrder};
