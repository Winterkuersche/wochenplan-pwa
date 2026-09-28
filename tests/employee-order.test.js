const test=require('node:test');
const assert=require('node:assert/strict');
const {moveEmployeeInOrder}=require('../employee-order.js');
test('employee master-data order moves up/down and remains in the serializable array',()=>{const employees=[{id:'a'},{id:'b'},{id:'c'}];assert.equal(moveEmployeeInOrder(employees,'b',-1),true);assert.deepEqual(JSON.parse(JSON.stringify(employees)).map(item=>item.id),['b','a','c']);assert.equal(moveEmployeeInOrder(employees,'b',-1),false);assert.equal(moveEmployeeInOrder(employees,'a',1),true);assert.deepEqual(employees.map(item=>item.id),['b','c','a'])});

test('master-data positions are the one-based indexes of the persisted employee order',()=>{
  const employees=[{id:'a'},{id:'b'},{id:'c'}];
  const positions=()=>Object.fromEntries(employees.map((employee,index)=>[employee.id,index+1]));
  assert.deepEqual(positions(),{a:1,b:2,c:3});
  assert.equal(moveEmployeeInOrder(employees,'c',-1),true);
  assert.deepEqual(positions(),{a:1,c:2,b:3});
});
