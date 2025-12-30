type DiffEntry = {
  path: string;
  before: unknown;
  after: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function diffObjects(before: unknown, after: unknown, basePath = ""): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  if (before === after) return diffs;

  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length || before.some((item, idx) => item !== after[idx])) {
      diffs.push({ path: basePath, before, after });
    }
    return diffs;
  }

  if (isObject(before) && isObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    keys.forEach((key) => {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      diffs.push(...diffObjects(before[key], after[key], nextPath));
    });
    return diffs;
  }

  diffs.push({ path: basePath, before, after });
  return diffs;
}
