const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const live = fs.readFileSync('planning2-live.js', 'utf8');
const liveCss = fs.readFileSync('planning2-live.css', 'utf8');
const legacyWeekView = fs.readFileSync('week-view.js', 'utf8');
const targeted = fs.readFileSync('planning2-targeted-suggestions.js', 'utf8');

function sectionMarkup(id) {
  const start = index.indexOf(`<section id="${id}"`);
  assert.notEqual(start, -1, `${id} must exist`);
  const end = index.indexOf('</section>', start);
  return index.slice(start, end + 10);
}

test('normal app loads Planning 2 as its visible Wochenplan section and boots without duplicate auto-start', () => {
  const week = sectionMarkup('weekView');
  assert.match(week, /id="planning2View"/);
  assert.match(week, /id="grid"/);
  assert.match(index, /planning2-live\.js[^]*app\.js/);
  assert.match(app, /if \(view === "week"\) window\.Planning2Live\?\.mount\(\)/);
  assert.doesNotMatch(live, /mountPlanning2\(\);\s*\}\)\(\)/);
  assert.match(live, /window\.Planning2Live=\{mount:mountPlanning2,render\}/);
});


test('Planning 2 overlays and toast are inside the shared CSS host scope', () => {
  const week = sectionMarkup('weekView');
  assert.match(liveCss, /^#weekView\s*\{/);
  assert.doesNotMatch(liveCss, /^#planning2View\s*\{/);
  for (const id of ['editorOverlay', 'targetedSuggestionsOverlay', 'candidateDebugOverlay', 'toast']) {
    assert.match(week, new RegExp(`id=\"${id}\"`));
  }
});

test('all established navigation targets remain wired and returning to week remounts Planning 2', () => {
  for (const [button, view] of [
    ['btnViewMonthEl', 'month'], ['btnViewDayEl', 'day'],
    ['btnViewOverviewEl', 'overview'], ['btnViewMepEl', 'mep'], ['btnViewWeekEl', 'week']
  ]) {
    assert.match(app, new RegExp(`if \\(${button}\\)[^]*?uiState\\.currentView = "${view}"`));
  }
  assert.match(app, /weekViewEl\.classList\.toggle\("hidden", view !== "week"\)/);
  assert.match(app, /Planning2Live\?\.mount\(\)/);
});

test('Planning 2 live uses only productive adapter data and publishes saves to the host app', () => {
  assert.match(live, /createPlanning2DataAdapter\(localStorage\)/);
  assert.match(live, /planning2Data\.readMaster\(\)/);
  assert.match(live, /planning2Data\.readPlan\(\)/);
  assert.match(live, /planning2Data\.savePlan\(plan\)/);
  assert.match(live, /planning2:plan-saved/);
  assert.match(app, /addEventListener\("planning2:plan-saved"/);
  assert.doesNotMatch(live, /readPlan\([^)]*planning2_preview/);
});

test('legacy weekly planner stays present as an inactive fallback', () => {
  const legacy = sectionMarkup('legacyWeekView');
  assert.match(legacy, /id="weekTable"/);
  assert.match(legacy, /aria-hidden="true"/);
  assert.match(legacyWeekView, /function renderWeekView\(/);
  assert.match(index, /week-view\.js/);
});

test('normal render remains fast while explicit targeted suggestions and baseline stay available', () => {
  const renderStart = live.indexOf('function render()');
  const bindingsStart = live.indexOf("document.getElementById('weeks').onclick", renderStart);
  const renderBody = live.slice(renderStart, bindingsStart);
  assert.doesNotMatch(renderBody, /generatePlanning2CandidateEvaluation\(/);
  assert.doesNotMatch(renderBody, /generatePlanning2MutationPackages\(/);
  assert.match(live, /openPlanning2TargetedSuggestions/);
  assert.match(live, /applyPlanning2TargetedSuggestion/);
  assert.match(live, /createMonthlyPlanBaseline/);
});


test('integrated targeted suggestions receive the complete existing A-D pipeline explicitly', () => {
  const registration = live.match(/createPlanning2TargetedSuggestionService\(\{[^]*?\}\)/)?.[0] || '';
  assert.match(registration, /generateCandidates:generatePlanning2CandidateEvaluation/);
  assert.match(registration, /generatePackages:generatePlanning2MutationPackages/);
  assert.match(registration, /rankCandidates:rankPlanning2Candidates/);
  assert.match(registration, /rankPackages:rankPlanning2MutationPackages/);
  assert.match(registration, /simulatePackage:simulatePlanning2MutationPackage/);
  assert.match(live, /generatePlanning2EmptyDayCandidates/);
  assert.match(live, /generatePlanning2ExistingShiftMutationEvaluation/);
  assert.match(targeted, /data-targeted-loading/);
  assert.match(live, /Keine fachlich validen internen Vorschläge/);
});

test('integrated week hides duplicate legacy controls and obsolete transfer UI', () => {
  assert.match(app, /viewMetaLineEl\.classList\.add\("hidden"\)/);
  assert.match(app, /btnResetWeekEl\.classList\.add\("hidden"\)/);
  assert.doesNotMatch(index, /An Planung 2 übergeben/);
  assert.match(index, /id="legacyWeekView" class="overview hidden/);
  assert.match(live, /⚠ 08:55 fehlt/);
});
