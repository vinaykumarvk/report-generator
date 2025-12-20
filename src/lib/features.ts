import { getConfig } from './config';

const config = getConfig();

export function isFeatureEnabled(flag: string): boolean {
  return Boolean(config.featureFlags[flag]);
}

export function listFeatureFlags() {
  return { ...config.featureFlags };
}
