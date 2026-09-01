"use strict";
(function installPlanning2PlaygroundAcceptance(root) {
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const failure = (code, message) => ({ ok: false, code, message });
  async function accept({ session, adapter, revalidate, discardPlayground, now = new Date() }) {
    const variant = (session?.variants || []).find(item => item.variantId === session.selectedVariantId);
    if (!variant) return failure("NO_VARIANT", "Keine Variante ausgewählt.");
    let validation;
    try { validation = await revalidate(clone(variant.workingPlan), clone(variant.optimizationBasePlan || session.basePlan), clone(session)); }
    catch (error) { return failure("VALIDATION_ERROR", `Validierung fehlgeschlagen: ${error?.message || error}`); }
    const hard = validation?.hardConstraintResult || validation?.constraintResults || validation;
    if (!hard || hard.allowed === false) return failure("HARD_INVALID", "Diese Variante kann nicht übernommen werden, solange Hard-Constraint-Verletzungen bestehen.");
    try {
      const currentPlan = clone(await adapter.readCurrentPlan());
      const signature = root.Planning2PlaygroundState.planSignature(currentPlan);
      if (signature !== session.sourcePlanSignature) return failure("PLAN_CONFLICT", "Der aktuelle Plan wurde seit Start des Spielplatzes geändert. Bitte den Spielplatz neu vom aktuellen Plan starten.");
      const oldHistory = clone(await adapter.readOptimizationHistory(session.month)) || [];
      const record = root.Planning2OptimizationHistory.createRecord({ session, variant, currentPlan, history: oldHistory, validation: hard, now });
      const nextHistory = [...oldHistory, clone(record)];
      await adapter.commitAcceptance({ month: session.month, currentPlan, nextPlan: clone(variant.workingPlan), oldHistory, nextHistory, record: clone(record) });
      await discardPlayground();
      return { ok: true, record: clone(record), plan: clone(variant.workingPlan) };
    } catch (error) { return failure("STORAGE_ERROR", `Übernahme fehlgeschlagen: ${error?.message || error}`); }
  }
  function createLocalStorageAdapter({ storage, planKey, historyRepository }) {
    return {
      readCurrentPlan() { return JSON.parse(storage.getItem(planKey) || "{}"); },
      readOptimizationHistory(month) { return historyRepository.readOptimizationHistory(month); },
      async commitAcceptance({ month, currentPlan, nextPlan, oldHistory, nextHistory }) {
        try { storage.setItem(planKey, JSON.stringify(clone(nextPlan))); historyRepository.writeOptimizationHistory(month, nextHistory); }
        catch (error) { try { storage.setItem(planKey, JSON.stringify(currentPlan)); historyRepository.writeOptimizationHistory(month, oldHistory); } catch {} throw error; }
      }
    };
  }
  const api = { accept, createLocalStorageAdapter };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Planning2PlaygroundAcceptance = api;
})(typeof window !== "undefined" ? window : globalThis);
