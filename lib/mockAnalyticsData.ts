/**
 * ASI Analytics strict live-data module.
 * Any call here indicates legacy synthetic-path usage and should be migrated.
 */

export const legacyAnalyticsData = null;

export const legacyCubeApi = {
  load: async () => {
    throw new Error('Synthetic analytics provider is disabled. Use live Cube/API sources only.');
  }
};

export const generateRealTimeMetrics = () => {
  throw new Error('Synthetic metrics generator is disabled. Use live metrics endpoints only.');
};
