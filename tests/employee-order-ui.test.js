const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');

function extract(name) {
  const start = app.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} exists`);
  let depth = 0;
  let opened = false;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === '{') { depth += 1; opened = true; }
    else if (app[index] === '}' && --depth === 0 && opened) return app.slice(start, index + 1);
  }
  throw new Error(name);
}

test('employee master data renders its array position directly beside the name', () => {
  const render = extract('renderTeamSetup');
  assert.match(render, /positionNumber\.textContent = `\$\{idx \+ 1\} ·`/);
  assert.match(render, /nameControl\.append\(positionNumber, nameInput\)/);
  assert.match(render, /labeledField\("Name", nameControl\)/);
  assert.match(styles, /\.teamPositionNumber/);
});

test('moving an employee re-renders the existing order and keeps the moved row visible', () => {
  const render = extract('renderTeamSetup');
  assert.match(render, /moveEmployeeInOrder\(state\.employees, emp\.id, offset\)/);
  assert.match(render, /saveAppState\(\);\s*renderTeamSetup\(\);\s*renderAllViews\(\)/);
  assert.match(render, /candidate\.dataset\.employeeId === String\(emp\.id\)/);
  assert.match(render, /scrollIntoView\(\{ behavior: "smooth", block: "nearest" \}\)/);
  assert.match(styles, /\.teamOrderControls button\{min-height:44px/);
});
