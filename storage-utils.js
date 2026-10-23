/* Local saves stay synchronous so pagehide can finish them. A write-ahead
 * journal protects the existing v10 keys from partial writes and keeps one
 * previous data state. It is a device copy, not an external backup. */
(function (root) {
  "use strict";

  function create(options) {
    const keys = options.keys;
    const coreKeys = [keys.master, keys.plan];
    const allowedKeys = Object.values(keys);
    const journalKey = "wochenplan_save_journal_v1";
    const expected = new Map();
    let problem = "";
    let problemKind = "";
    const storage = () => typeof options.storage === "function" ? options.storage() : options.storage;
    const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

    function capture() {
      return Object.fromEntries(allowedKeys.map((key) => [key, storage().getItem(key)]));
    }

    function restoreRaw(entries) {
      // Free the space occupied by the failed new state before restoring.
      allowedKeys.forEach((key) => storage().removeItem(key));
      allowedKeys.forEach((key) => {
        if (entries[key] !== null && entries[key] !== undefined) storage().setItem(key, entries[key]);
      });
    }

    function remember() {
      const entries = capture();
      Object.entries(entries).forEach(([key, value]) => expected.set(key, value));
    }

    function readJson(key, fallback) {
      try {
        const raw = storage().getItem(key);
        if (raw === null) return fallback;
        const value = JSON.parse(raw);
        if (coreKeys.includes(key)) {
          if (!isRecord(value) || (key === keys.master && !Array.isArray(value.employees))) throw Error("shape");
          if (key === keys.plan && value.schedule !== undefined && !isRecord(value.schedule)) throw Error("shape");
        }
        return value;
      } catch (_) {
        if (coreKeys.includes(key)) {
          problemKind = "corrupt";
          problem = "Gespeicherte Daten konnten nicht gelesen werden. Bitte eine Sicherung wiederherstellen; der vorhandene Speicher bleibt geschützt.";
        }
        return fallback;
      }
    }

    function dataSignature(entries) {
      try {
        const master = JSON.parse(entries[keys.master] || "null");
        const plan = JSON.parse(entries[keys.plan] || "null");
        if (plan) { delete plan.weekFrom; delete plan.weekTo; }
        return JSON.stringify([master, plan]);
      } catch (_) { return null; }
    }

    function writeBatch(values, { allowRecovery = false, source = "save" } = {}) {
      if (problem && !allowRecovery) return { ok: false, error: problem };
      let previous;
      let pending = false;
      let wrote = false;
      try {
        previous = capture();
        // A second tab must never silently overwrite a state loaded earlier.
        if (!allowRecovery && coreKeys.some((key) => previous[key] !== expected.get(key))) {
          problem = "Ein anderes Fenster hat den Plan geändert. Sichere offene Änderungen als Datei und lade diese Ansicht neu.";
          problemKind = "stale";
          return { ok: false, error: problem };
        }
        const encoded = Object.fromEntries(Object.entries(values).map(([key, value]) => {
          if (!allowedKeys.includes(key)) throw Error("Unbekannter Speicherschlüssel");
          return [key, value === undefined ? null : key === keys.theme ? String(value) : JSON.stringify(value)];
        }));
        const next = { ...previous, ...encoded };
        const changed = dataSignature(previous) !== dataSignature(next) || allowRecovery;
        if (changed) {
          storage().setItem(journalKey, JSON.stringify({ pending: true, createdAt: new Date().toISOString(), source, previous }));
          pending = true;
        }
        Object.entries(encoded).forEach(([key, raw]) => {
          if (raw === null) storage().removeItem(key);
          else storage().setItem(key, raw);
          wrote = true;
        });
        if (pending) {
          const journal = JSON.parse(storage().getItem(journalKey));
          journal.pending = false;
          storage().setItem(journalKey, JSON.stringify(journal));
        }
        problem = "";
        problemKind = "";
        remember();
        return { ok: true };
      } catch (_) {
        if (previous && (pending || wrote)) {
          try {
            restoreRaw(previous);
            if (pending) {
              const journal = JSON.parse(storage().getItem(journalKey));
              journal.pending = false;
              storage().setItem(journalKey, JSON.stringify(journal));
            }
            remember();
          } catch (_) {
            problem = "Speichern wurde unterbrochen. Bitte diese Ansicht neu laden oder die Rohdaten sichern.";
            problemKind = "rollback";
          }
        }
        return { ok: false, error: problem || "Nicht genügend Gerätespeicher oder Speichern nicht erlaubt. Bitte den aktuellen Stand als Datei sichern." };
      }
    }

    function writeJson(key, value) {
      if (problem && (coreKeys.includes(key) || key === keys.savedAt)) return false;
      try {
        storage().setItem(key, JSON.stringify(value));
        if (allowedKeys.includes(key)) expected.set(key, storage().getItem(key));
        return true;
      } catch (_) { return false; }
    }

    function getPrevious() {
      try {
        const journal = JSON.parse(storage().getItem(journalKey) || "null");
        if (!journal || journal.pending || !journal.previous?.[keys.master] || !journal.previous?.[keys.plan]) return null;
        return {
          backupVersion: 2,
          createdAt: journal.createdAt,
          storage: Object.fromEntries(allowedKeys.filter((key) => journal.previous[key] != null).map((key) => [key, key === keys.theme ? journal.previous[key] : JSON.parse(journal.previous[key])]))
        };
      } catch (_) { return null; }
    }

    function exportRaw() {
      const entries = capture();
      for (let i = 0; i < storage().length; i += 1) {
        const key = storage().key(i);
        if (/^wochenplan_(master|plan|ui)_v\d+$/.test(key) || key === journalKey || /^wochenplan_(import_backup|last_backup_before_import)_v\d+$/.test(key)) entries[key] = storage().getItem(key);
      }
      return { format: "wochenplan-raw-rescue", createdAt: new Date().toISOString(), entries };
    }

    try {
      const journal = JSON.parse(storage().getItem(journalKey) || "null");
      if (journal?.pending) {
        if (!isRecord(journal.previous) || !allowedKeys.every((key) => Object.hasOwn(journal.previous, key))) throw Error("journal");
        restoreRaw(journal.previous);
        journal.pending = false;
        storage().setItem(journalKey, JSON.stringify(journal));
      }
      remember();
      const hasMaster = expected.get(keys.master) !== null;
      const hasPlan = expected.get(keys.plan) !== null;
      if (hasMaster !== hasPlan || (!hasMaster && expected.get(keys.savedAt) !== null)) {
        problem = "Ein Teil der gespeicherten Planung fehlt. Bitte eine Sicherung oder den Online-Stand wiederherstellen.";
        problemKind = "missing";
      }
    } catch (_) {
      problem = "Der Gerätespeicher ist nicht lesbar. Bitte die Rohdaten sichern und eine Sicherung wiederherstellen.";
      problemKind = "unavailable";
    }

    return { readJson, writeJson, writeBatch, getPrevious, exportRaw,
      isCurrent() { try { return coreKeys.every(key => storage().getItem(key) === expected.get(key)); } catch (_) { return false; } },
      protect(reason) { problem = reason; problemKind = "migration"; },
      get problemKind() { return problemKind; },
      get blocked() { return Boolean(problem); }, get error() { return problem; } };
  }

  root.WochenplanStorage = Object.freeze({ create });
})(typeof window === "undefined" ? globalThis : window);
