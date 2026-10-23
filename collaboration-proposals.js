(function (root) {
  "use strict";
  const copy = value => JSON.parse(JSON.stringify(value));
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  function clean(payload) {
    const { weekFrom, weekTo, ...plan } = payload.storage.wochenplan_plan_v10;
    return { storage: { wochenplan_master_v10: payload.storage.wochenplan_master_v10, wochenplan_plan_v10: plan } };
  }
  function diff(before, after, path = []) {
    if (equal(before, after)) return [];
    const object = v => v && typeof v === "object" && !Array.isArray(v);
    if (object(before) && object(after) && !(path.length === 5 && path[2] === "schedule")) {
      return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
        .flatMap(k => diff(before[k], after[k], [...path, k]));
    }
    return [{ path, before: before ?? null, after: after ?? null, before_exists: before !== undefined, after_exists: after !== undefined }];
  }
  const at = (payload, path) => path.reduce((v, k) => v != null && Object.prototype.hasOwnProperty.call(v, k) ? v[k] : undefined, payload);
  function conflicts(payload, changes) {
    return (changes || []).filter(c => {
      const value = at(payload, c.path);
      return (value !== undefined) !== c.before_exists || (c.before_exists && !equal(value, c.before));
    });
  }
  function apply(payload, changes) {
    const result = copy(payload);
    if (conflicts(result, changes).length) throw new Error("Der Plan wurde an einer vorgeschlagenen Stelle geändert. Bitte zuerst vergleichen.");
    for (const c of changes) {
      let parent = result;
      for (const k of c.path.slice(0, -1)) {
        if (!parent[k] || typeof parent[k] !== "object") throw new Error("Der Plan wurde inzwischen geändert. Bitte zuerst vergleichen.");
        parent = parent[k];
      }
      if (c.after_exists) parent[c.path.at(-1)] = copy(c.after); else delete parent[c.path.at(-1)];
    }
    return result;
  }
  function affectsCell(change, day, employee) {
    const p = change.path || [];
    if (p[1] !== "wochenplan_plan_v10") return false;
    if (p[2] === "schedule") {
      if (p[3] !== day) return false;
      return p.length >= 5 ? p[4] === employee : Boolean(change.before?.[employee] || change.after?.[employee]);
    }
    if (p[2] === "absences") {
      return [...(Array.isArray(change.before) ? change.before : []), ...(Array.isArray(change.after) ? change.after : [])]
        .some(a => a.employeeId === employee && a.from <= day && a.to >= day);
    }
    return false;
  }
  function items(proposal) {
    return (proposal.changes || []).map((change, index) => ({ change, index,
      status: change.decision || (proposal.status === "pending" ? "pending" : proposal.status) }));
  }
  const pending = proposal => items(proposal).filter(item => item.status === "pending").map(item => item.change);
  root.WochenplanProposals = Object.freeze({ equal, clean, diff: (a, b) => diff(clean(a), clean(b)), conflicts, apply, affectsCell, items, pending });
})(typeof window === "undefined" ? globalThis : window);
