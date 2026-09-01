"use strict";

/* A small, deliberately demand-driven bridge into the existing Planning-2 A-D
 * pipeline. It owns neither candidate rules nor ranking policy. */
(function initPlanning2TargetedSuggestions(globalScope) {
  const DEFAULT_LIMIT = 3;
  const DEFAULT_CANDIDATE_CAP = 48;

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function problemIdFor(problem) {
    return problem.problemId || (typeof globalScope.planning2ProblemId === "function"
      ? globalScope.planning2ProblemId(problem.isoDate, problem.gap)
      : `${problem.isoDate}|understaffing|${problem.gap.start}|${problem.gap.end}`);
  }
  function targetsProblem(value, problemId, problem) {
    if (value.problemId === problemId || (value.problemIds || []).includes(problemId)) return true;
    const gap = value.understaffingWindow;
    return value.isoDate === problem.isoDate && gap?.start === problem.gap.start && gap?.end === problem.gap.end;
  }
  function candidateAsPackage(candidate) {
    return {
      ...candidate,
      suggestionId: candidate.candidateId,
      packageType: "TARGETED_CANDIDATE",
      mutations: [...(candidate.mutations || []), ...(candidate.requiredFollowUpMutations || [])],
      sourceCandidateIds: [candidate.candidateId].filter(Boolean),
      coverageFacts: {
        improvedMinutes: candidate.resolvesTargetGap
          ? candidate.understaffingWindow.end - candidate.understaffingWindow.start
          : Math.max(0, Number(candidate.improvedMinutes) || 0),
        fullyResolved: candidate.resolvesTargetGap === true
      }
    };
  }
  function structuredReasons(suggestion) {
    const facts = suggestion.coverageFacts || {};
    const reasons = [];
    if (facts.fullyResolved || suggestion.resolvesTargetGap) reasons.push("schließt die Lücke vollständig");
    else if (facts.improvedMinutes > 0) reasons.push(`reduziert Unterbesetzung um ${Math.round(facts.improvedMinutes / 60 * 10) / 10} Std.`);
    if (suggestion.isGfb) reasons.push("nutzt GFB-Restbudget");
    if (suggestion.hasRegularFreeDay || suggestion.disruptionFacts?.touchesFreeDay === false) reasons.push("erhält freien Tag");
    if ((suggestion.requiredFollowUpMutations || []).length || suggestion.disruptionFacts?.followUpCount) reasons.push("benötigt Ausgleich am Folgetag");
    return reasons.slice(0, 2);
  }

  function createPlanning2TargetedSuggestionService(dependencies = {}) {
    const generate = dependencies.generateCandidates || globalScope.generatePlanning2CandidateEvaluation;
    const generatePackages = dependencies.generatePackages || globalScope.generatePlanning2MutationPackages;
    const rankCandidates = dependencies.rankCandidates || globalScope.rankPlanning2Candidates;
    const rankPackages = dependencies.rankPackages || globalScope.rankPlanning2MutationPackages;
    let runCount = 0;

    function request(context, problem, options = {}) {
      runCount += 1;
      const problemId = problemIdFor(problem);
      const targetDay = (context.days || []).find(day => day.isoDate === problem.isoDate);
      if (!targetDay) return { problem: clone(problem), suggestions: [], externalHelp: null, generationFacts: { bounded: true, candidateCount: 0 } };
      const targetContext = { ...context, days: [targetDay], enableExistingShiftMutations: true, packageTopK: Math.min(6, Number(options.packageTopK) || 6) };
      const evaluation = generate(targetContext);
      const cap = Math.max(1, Number(options.candidateCap) || DEFAULT_CANDIDATE_CAP);
      const valid = (evaluation.candidates || []).filter(candidate => candidate.constraintResults?.allowed !== false && targetsProblem(candidate, problemId, problem)).slice(0, cap);
      const compensationRoots = (evaluation.rejected || []).filter(candidate => candidate.requiresCompensatingPackage && targetsProblem(candidate, problemId, problem)).slice(0, 6);
      let support = [];
      if (compensationRoots.length) {
        const employeeIds = new Set(compensationRoots.map(candidate => String(candidate.employeeId)));
        const supportContext = {
          ...context,
          days: (context.days || []).slice(0, 6),
          employees: (context.employees || []).filter(person => employeeIds.has(String(person.employeeId))),
          enableExistingShiftMutations: true
        };
        const supportEvaluation = generate(supportContext);
        support = (supportEvaluation.candidates || []).filter(candidate => candidate.mutationType === "SHIFT_REMOVE" && employeeIds.has(String(candidate.employeeId))).slice(0, 12);
      }
      const packageInput = [...valid, ...compensationRoots, ...support].slice(0, cap);
      const packages = generatePackages ? generatePackages(context, packageInput) : { packages: [], generationFacts: {} };
      const validPackages = (packages.packages || []).filter(item => item.valid !== false && targetsProblem(item, problemId, problem));
      const rankedCandidates = rankCandidates ? rankCandidates(valid).map(candidateAsPackage) : valid.map(candidateAsPackage);
      const rankedPackages = rankPackages ? rankPackages(validPackages) : validPackages;
      const combined = [...rankedPackages, ...rankedCandidates].sort((left, right) =>
        Number(Boolean(right.coverageFacts?.fullyResolved || right.resolvesTargetGap)) - Number(Boolean(left.coverageFacts?.fullyResolved || left.resolvesTargetGap)) ||
        (right.coverageFacts?.improvedMinutes || 0) - (left.coverageFacts?.improvedMinutes || 0) ||
        (left.mutations?.length || 1) - (right.mutations?.length || 1)
      );
      const seen = new Set();
      const suggestions = combined.filter(item => {
        const key = JSON.stringify(item.mutations || []);
        if (!key || seen.has(key)) return false;
        seen.add(key); return true;
      }).slice(0, Math.min(DEFAULT_LIMIT, Number(options.limit) || DEFAULT_LIMIT)).map(item => ({ ...item, reasons: structuredReasons(item) }));
      const complete = suggestions.some(item => item.coverageFacts?.fullyResolved || item.resolvesTargetGap);
      return {
        problem: { ...clone(problem), problemId }, suggestions,
        externalHelp: complete ? null : { isoDate: problem.isoDate, start: problem.gap.start, end: problem.gap.end, missingPeople: problem.gap.missingPeople || 1, actionable: false },
        generationFacts: { bounded: true, candidateCap: cap, candidateCount: valid.length, ...(packages.generationFacts || {}) }
      };
    }
    return { request, getRunCount: () => runCount };
  }

  const api = { createPlanning2TargetedSuggestionService, structuredReasons, problemIdFor };
  globalScope.Planning2TargetedSuggestions = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
