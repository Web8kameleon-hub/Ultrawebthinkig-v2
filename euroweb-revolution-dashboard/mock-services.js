/**
 * Disabled by the repository-wide No Fake policy. // no-fake: allow
 *
 * Runtime services must connect to real providers and must report an explicit
 * unavailable/error state when those providers cannot be reached. They must
 * never fabricate telemetry, security events, devices, or traffic metrics.
 */

throw new Error(
  'Mock services are disabled. Configure and start the real AGI, security, mesh, IoT, and gateway services.', // no-fake: allow
);
