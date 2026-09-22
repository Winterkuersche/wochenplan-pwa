const test=require('node:test');
const assert=require('node:assert/strict');
const {moveEmployeeInOrder}=require('../employee-order.js');
test('employee master-data order moves up/down and remains in the serializable array',()=>{const employees=[{id:'a'},{id:'b'},{id:'c'}];assert.equal(moveEmployeeInOrder(employees,'b',-1),true);assert.deepEqual(JSON.parse(JSON.stringify(employees)).map(item=>item.id),['b','a','c']);assert.equal(moveEmployeeInOrder(employees,'b',-1),false);assert.equal(moveEmployeeInOrder(employees,'a',1),true);assert.deepEqual(employees.map(item=>item.id),['b','c','a'])});
