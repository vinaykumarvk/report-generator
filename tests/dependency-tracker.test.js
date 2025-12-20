import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DependencyTracker,
  ChangeDetector,
  ReenqueuePlanner,
} from '../src/dependency-tracker.js';

const fp = (text) => text;

const initialBlueprint = [
  { id: 'A1', text: 'Assumption one' },
  { id: 'A2', text: 'Assumption two' },
];

const buildTracker = () => {
  const tracker = new DependencyTracker();
  tracker.setBlueprintSnapshot(initialBlueprint);
  tracker.recordSectionDependency({
    sectionId: 'S1',
    blueprintAssumptionIds: ['A1'],
    retrievalQueries: ['query alpha'],
    dependsOnSections: ['S3'],
    outputFingerprint: fp('S1-v1'),
  });
  tracker.recordSectionDependency({
    sectionId: 'S2',
    blueprintAssumptionIds: ['A2'],
    retrievalQueries: ['query beta'],
    dependsOnSections: ['S1'],
    outputFingerprint: fp('S2-v1'),
  });
  tracker.recordSectionDependency({
    sectionId: 'S3',
    blueprintAssumptionIds: [],
    retrievalQueries: ['query gamma'],
    dependsOnSections: [],
    outputFingerprint: fp('S3-v1'),
  });
  return tracker;
};

const buildInput = (overrides = {}) => ({
  blueprint: initialBlueprint,
  retrievalQueriesBySection: {
    S1: ['query alpha'],
    S2: ['query beta'],
    S3: ['query gamma'],
  },
  sectionOutputs: {
    S1: fp('S1-v1'),
    S2: fp('S2-v1'),
    S3: fp('S3-v1'),
  },
  ...overrides,
});

test('marks sections impacted by blueprint assumption changes', () => {
  const tracker = buildTracker();
  const detector = new ChangeDetector(tracker);
  const input = buildInput({ blueprint: [{ id: 'A1', text: 'Assumption changed' }, { id: 'A2', text: 'Assumption two' }] });
  const result = detector.detectChanges(input);

  assert.equal(result.impactedSections.has('S1'), true);
  assert.equal(result.impactedSections.has('S2'), false);
  assert.deepEqual(result.changedAssumptions, ['A1']);
  assert.equal(result.reasonsBySection.get('S1')[0].type, 'ASSUMPTION');
});

test('marks sections when retrieval queries change', () => {
  const tracker = buildTracker();
  const detector = new ChangeDetector(tracker);
  const input = buildInput({
    retrievalQueriesBySection: { S1: ['query alpha v2'], S2: ['query beta'], S3: ['query gamma'] },
  });

  const result = detector.detectChanges(input);
  assert.equal(result.impactedSections.has('S1'), true);
  assert.equal(result.reasonsBySection.get('S1').some((r) => r.type === 'RETRIEVAL'), true);
});

test('propagates output changes to dependent sections', () => {
  const tracker = buildTracker();
  const detector = new ChangeDetector(tracker);
  const input = buildInput({ sectionOutputs: { S1: fp('S1-v2'), S2: fp('S2-v1'), S3: fp('S3-v1') } });

  const result = detector.detectChanges(input);
  assert.equal(result.impactedSections.has('S2'), true);
  assert.ok(result.reasonsBySection.get('S2')[0].detail.includes('S1'));
});

test('reenqueue planner returns transitive dependents', () => {
  const tracker = buildTracker();
  const detector = new ChangeDetector(tracker);
  const planner = new ReenqueuePlanner(tracker, detector);
  const input = buildInput({ sectionOutputs: { S3: fp('S3-v2'), S2: fp('S2-v1'), S1: fp('S1-v1') } });

  const plan = planner.plan(input);
  assert.ok(plan.sections.includes('S1'));
  assert.ok(plan.sections.includes('S2'));
  assert.ok(plan.sections.includes('S3'));
  assert.ok(plan.reasons.get('S2').some((r) => r.detail.includes('transitively')));
});
