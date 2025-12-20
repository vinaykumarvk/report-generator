import { createHash } from 'crypto';

/**
 * @typedef {Object} BlueprintAssumption
 * @property {string} id
 * @property {string} text
 */

/**
 * @typedef {Object} SectionDependencyInput
 * @property {string} sectionId
 * @property {string[]} blueprintAssumptionIds
 * @property {string[]} retrievalQueries
 * @property {string[]=} dependsOnSections
 * @property {string} outputFingerprint
 */

/**
 * @typedef {Object} ChangeDetectionInput
 * @property {BlueprintAssumption[]} blueprint
 * @property {Record<string, string[]>} retrievalQueriesBySection
 * @property {Record<string, string>} sectionOutputs
 */

/**
 * @typedef {Object} ChangeReason
 * @property {'ASSUMPTION' | 'RETRIEVAL' | 'UPSTREAM_OUTPUT'} type
 * @property {string} detail
 */

/**
 * @typedef {Object} ChangeAnalysisResult
 * @property {Set<string>} impactedSections
 * @property {Map<string, ChangeReason[]>} reasonsBySection
 * @property {string[]} changedAssumptions
 */

/**
 * @typedef {Object} SectionDependencyRecord
 * @property {string} sectionId
 * @property {Set<string>} blueprintAssumptionIds
 * @property {Set<string>} dependsOnSections
 */

/** @param {string[]} values */
const hashStrings = (values) => {
  const h = createHash('sha1');
  values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .sort()
    .forEach((value) => h.update(value));
  return h.digest('hex');
};

export class DependencyTracker {
  constructor() {
    /** @type {Record<string, string>} */
    this.blueprintFingerprints = {};
    /** @type {Map<string, Set<string>>} */
    this.assumptionToSections = new Map();
    /** @type {Record<string, string>} */
    this.sectionRetrievalFingerprints = {};
    /** @type {Record<string, string>} */
    this.sectionOutputFingerprints = {};
    /** @type {Map<string, SectionDependencyRecord>} */
    this.sectionDependencies = new Map();
  }

  /** @param {BlueprintAssumption[]} assumptions */
  setBlueprintSnapshot(assumptions) {
    this.blueprintFingerprints = Object.fromEntries(
      assumptions.map((assumption) => [assumption.id, hashStrings([assumption.text])]),
    );
  }

  /** @param {SectionDependencyInput} input */
  recordSectionDependency(input) {
    const dependsOnSections = new Set(input.dependsOnSections ?? []);
    const blueprintAssumptionIds = new Set(input.blueprintAssumptionIds);
    this.sectionDependencies.set(input.sectionId, {
      sectionId: input.sectionId,
      blueprintAssumptionIds,
      dependsOnSections,
    });

    blueprintAssumptionIds.forEach((assumptionId) => {
      const existing = this.assumptionToSections.get(assumptionId) ?? new Set();
      existing.add(input.sectionId);
      this.assumptionToSections.set(assumptionId, existing);
    });

    this.sectionRetrievalFingerprints[input.sectionId] = hashStrings(input.retrievalQueries);
    this.sectionOutputFingerprints[input.sectionId] = input.outputFingerprint;
  }

  setSectionOutputFingerprint(sectionId, fingerprint) {
    this.sectionOutputFingerprints[sectionId] = fingerprint;
  }

  setRetrievalQueries(sectionId, retrievalQueries) {
    this.sectionRetrievalFingerprints[sectionId] = hashStrings(retrievalQueries);
  }

  getBaselineBlueprintFingerprints() {
    return { ...this.blueprintFingerprints };
  }

  getSectionRetrievalFingerprints() {
    return { ...this.sectionRetrievalFingerprints };
  }

  getSectionOutputFingerprints() {
    return { ...this.sectionOutputFingerprints };
  }

  getAssumptionToSections() {
    return this.assumptionToSections;
  }

  getSectionDependencies() {
    return this.sectionDependencies;
  }
}

export class ChangeDetector {
  /** @param {DependencyTracker} tracker */
  constructor(tracker) {
    this.tracker = tracker;
  }

  /** @param {ChangeDetectionInput} input */
  detectChanges(input) {
    const reasonsBySection = new Map();
    const impactedSections = new Set();

    const changedAssumptions = this.findChangedAssumptions(input.blueprint);
    this.collectAssumptionImpacts(changedAssumptions, impactedSections, reasonsBySection);
    this.collectRetrievalImpacts(input.retrievalQueriesBySection, impactedSections, reasonsBySection);
    this.collectUpstreamOutputImpacts(input.sectionOutputs, impactedSections, reasonsBySection);

    return {
      impactedSections,
      reasonsBySection,
      changedAssumptions,
    };
  }

  /** @param {BlueprintAssumption[]} blueprint */
  findChangedAssumptions(blueprint) {
    const baseline = this.tracker.getBaselineBlueprintFingerprints();
    const current = Object.fromEntries(blueprint.map((assumption) => [assumption.id, hashStrings([assumption.text])]))
    const changed = [];

    Object.entries(baseline).forEach(([assumptionId, priorFingerprint]) => {
      if (current[assumptionId] === undefined || current[assumptionId] !== priorFingerprint) {
        changed.push(assumptionId);
      }
    });

    return changed;
  }

  /**
   * @param {string[]} changedAssumptions
   * @param {Set<string>} impactedSections
   * @param {Map<string, ChangeReason[]>} reasonsBySection
   */
  collectAssumptionImpacts(changedAssumptions, impactedSections, reasonsBySection) {
    const assumptionMap = this.tracker.getAssumptionToSections();
    changedAssumptions.forEach((assumptionId) => {
      const sections = assumptionMap.get(assumptionId);
      if (!sections) return;
      sections.forEach((sectionId) => {
        impactedSections.add(sectionId);
        const reasons = reasonsBySection.get(sectionId) ?? [];
        reasons.push({ type: 'ASSUMPTION', detail: `Blueprint assumption ${assumptionId} changed` });
        reasonsBySection.set(sectionId, reasons);
      });
    });
  }

  /**
   * @param {Record<string, string[]>} retrievalQueriesBySection
   * @param {Set<string>} impactedSections
   * @param {Map<string, ChangeReason[]>} reasonsBySection
   */
  collectRetrievalImpacts(retrievalQueriesBySection, impactedSections, reasonsBySection) {
    const baseline = this.tracker.getSectionRetrievalFingerprints();
    Object.entries(baseline).forEach(([sectionId, previousFingerprint]) => {
      const nextFingerprint = hashStrings(retrievalQueriesBySection[sectionId] ?? []);
      if (nextFingerprint !== previousFingerprint) {
        impactedSections.add(sectionId);
        const reasons = reasonsBySection.get(sectionId) ?? [];
        reasons.push({ type: 'RETRIEVAL', detail: 'Retrieval query set changed' });
        reasonsBySection.set(sectionId, reasons);
      }
    });
  }

  /**
   * @param {Record<string, string>} sectionOutputs
   * @param {Set<string>} impactedSections
   * @param {Map<string, ChangeReason[]>} reasonsBySection
   */
  collectUpstreamOutputImpacts(sectionOutputs, impactedSections, reasonsBySection) {
    const baselineOutputs = this.tracker.getSectionOutputFingerprints();
    const changedSections = new Set();

    Object.entries(baselineOutputs).forEach(([sectionId, previousFingerprint]) => {
      const nextFingerprint = sectionOutputs[sectionId];
      if (nextFingerprint && nextFingerprint !== previousFingerprint) {
        changedSections.add(sectionId);
        impactedSections.add(sectionId);
        const reasons = reasonsBySection.get(sectionId) ?? [];
        reasons.push({ type: 'UPSTREAM_OUTPUT', detail: 'Section output fingerprint changed' });
        reasonsBySection.set(sectionId, reasons);
      }
    });

    if (changedSections.size === 0) return;

    const dependents = this.buildDependentMap();
    const visited = new Set();
    const queue = Array.from(changedSections);

    while (queue.length > 0) {
      const changedSection = queue.shift();
      const dependentSections = dependents.get(changedSection);
      if (!dependentSections) continue;

      dependentSections.forEach((dependentSectionId) => {
        if (visited.has(dependentSectionId)) return;
        visited.add(dependentSectionId);
        impactedSections.add(dependentSectionId);
        const reasons = reasonsBySection.get(dependentSectionId) ?? [];
        reasons.push({ type: 'UPSTREAM_OUTPUT', detail: `Upstream section ${changedSection} output changed` });
        reasonsBySection.set(dependentSectionId, reasons);
        queue.push(dependentSectionId);
      });
    }
  }

  buildDependentMap() {
    const dependents = new Map();
    this.tracker.getSectionDependencies().forEach((record) => {
      record.dependsOnSections.forEach((upstream) => {
        const existing = dependents.get(upstream) ?? new Set();
        existing.add(record.sectionId);
        dependents.set(upstream, existing);
      });
    });
    return dependents;
  }
}

export class ReenqueuePlanner {
  /**
   * @param {DependencyTracker} tracker
   * @param {ChangeDetector} detector
   */
  constructor(tracker, detector) {
    this.tracker = tracker;
    this.detector = detector;
  }

  /** @param {ChangeDetectionInput} input */
  plan(input) {
    const analysis = this.detector.detectChanges(input);
    const dependents = this.collectTransitiveDependents(Array.from(analysis.impactedSections));
    const allImpacted = new Set([...analysis.impactedSections, ...dependents]);

    dependents.forEach((sectionId) => {
      const reasons = analysis.reasonsBySection.get(sectionId) ?? [];
      reasons.push({ type: 'UPSTREAM_OUTPUT', detail: 'Upstream dependency changed transitively' });
      analysis.reasonsBySection.set(sectionId, reasons);
    });

    return {
      sections: Array.from(allImpacted),
      reasons: analysis.reasonsBySection,
    };
  }

  /** @param {string[]} changedSections */
  collectTransitiveDependents(changedSections) {
    const dependents = new Set();
    const dependentMap = this.buildDependentMap();
    const queue = [...changedSections];

    while (queue.length > 0) {
      const current = queue.shift();
      const directDependents = dependentMap.get(current);
      if (!directDependents) continue;
      directDependents.forEach((dep) => {
        if (dependents.has(dep)) return;
        dependents.add(dep);
        queue.push(dep);
      });
    }

    return dependents;
  }

  buildDependentMap() {
    const dependents = new Map();
    this.tracker.getSectionDependencies().forEach((record) => {
      record.dependsOnSections.forEach((upstream) => {
        const existing = dependents.get(upstream) ?? new Set();
        existing.add(record.sectionId);
        dependents.set(upstream, existing);
      });
    });
    return dependents;
  }
}
