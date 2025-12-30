const {
  DependencyTracker,
  ChangeDetector,
  ReenqueuePlanner,
} = require("../src/dependency-tracker");

const fp = (text) => text;

const initialBlueprint = [
  { id: "A1", text: "Assumption one" },
  { id: "A2", text: "Assumption two" },
];

const buildTracker = () => {
  const tracker = new DependencyTracker();
  tracker.setBlueprintSnapshot(initialBlueprint);
  tracker.recordSectionDependency({
    sectionId: "S1",
    blueprintAssumptionIds: ["A1"],
    retrievalQueries: ["query alpha"],
    dependsOnSections: ["S3"],
    outputFingerprint: fp("S1-v1"),
  });
  tracker.recordSectionDependency({
    sectionId: "S2",
    blueprintAssumptionIds: ["A2"],
    retrievalQueries: ["query beta"],
    dependsOnSections: ["S1"],
    outputFingerprint: fp("S2-v1"),
  });
  tracker.recordSectionDependency({
    sectionId: "S3",
    blueprintAssumptionIds: [],
    retrievalQueries: ["query gamma"],
    dependsOnSections: [],
    outputFingerprint: fp("S3-v1"),
  });
  return tracker;
};

const buildInput = (overrides = {}) => ({
  blueprint: initialBlueprint,
  retrievalQueriesBySection: {
    S1: ["query alpha"],
    S2: ["query beta"],
    S3: ["query gamma"],
  },
  sectionOutputs: {
    S1: fp("S1-v1"),
    S2: fp("S2-v1"),
    S3: fp("S3-v1"),
  },
  ...overrides,
});

describe("dependency tracker", () => {
  test("marks sections impacted by blueprint assumption changes", () => {
    const tracker = buildTracker();
    const detector = new ChangeDetector(tracker);
    const input = buildInput({
      blueprint: [
        { id: "A1", text: "Assumption changed" },
        { id: "A2", text: "Assumption two" },
      ],
    });
    const result = detector.detectChanges(input);

    expect(result.impactedSections.has("S1")).toBe(true);
    expect(result.impactedSections.has("S2")).toBe(false);
    expect(result.changedAssumptions).toEqual(["A1"]);
    expect(result.reasonsBySection.get("S1")[0].type).toBe("ASSUMPTION");
  });

  test("marks sections when retrieval queries change", () => {
    const tracker = buildTracker();
    const detector = new ChangeDetector(tracker);
    const input = buildInput({
      retrievalQueriesBySection: {
        S1: ["query alpha v2"],
        S2: ["query beta"],
        S3: ["query gamma"],
      },
    });

    const result = detector.detectChanges(input);
    expect(result.impactedSections.has("S1")).toBe(true);
    expect(
      result.reasonsBySection.get("S1").some((r) => r.type === "RETRIEVAL")
    ).toBe(true);
  });

  test("propagates output changes to dependent sections", () => {
    const tracker = buildTracker();
    const detector = new ChangeDetector(tracker);
    const input = buildInput({
      sectionOutputs: { S1: fp("S1-v2"), S2: fp("S2-v1"), S3: fp("S3-v1") },
    });

    const result = detector.detectChanges(input);
    expect(result.impactedSections.has("S2")).toBe(true);
    expect(result.reasonsBySection.get("S2")[0].detail).toContain("S1");
  });

  test("reenqueue planner returns transitive dependents", () => {
    const tracker = buildTracker();
    const detector = new ChangeDetector(tracker);
    const planner = new ReenqueuePlanner(tracker, detector);
    const input = buildInput({
      sectionOutputs: { S3: fp("S3-v2"), S2: fp("S2-v1"), S1: fp("S1-v1") },
    });

    const plan = planner.plan(input);
    expect(plan.sections).toContain("S1");
    expect(plan.sections).toContain("S2");
    expect(plan.sections).toContain("S3");
    expect(plan.reasons.get("S2").some((r) => r.detail.includes("transitively"))).toBe(true);
  });
});
