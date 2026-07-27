import { MonitorStatus } from '@rant/database';

/** How often the scheduler probes every active monitor (ms). */
export const HEALTH_TICK_MS = 5_000;

/** Consecutive failed checks before an incident opens. */
export const INCIDENT_OPEN_THRESHOLD = 2;

/** Samples older than this are pruned each tick to bound growth (ms). */
export const SAMPLE_RETENTION_MS = 6 * 60 * 60 * 1_000;

/** How long a manually-injected outage lasts by default (seconds). */
export const DEFAULT_CHAOS_SECONDS = 60;

export interface CheckResult {
  status: MonitorStatus;
  latencyMs: number;
  statusCode: number;
  up: boolean;
}

/**
 * Simulated health probe. Like CI's `stepShouldFail` and Deploy's
 * `deployShouldFail`, the work is faithful but synthetic: mostly healthy with
 * realistic latency, an occasional degraded blip, and a rare transient outage —
 * unless chaos has been injected, in which case it fails hard (demoable outage).
 */
export function simulateCheck(chaosActive: boolean): CheckResult {
  if (chaosActive) {
    return { status: MonitorStatus.DOWN, latencyMs: 0, statusCode: 503, up: false };
  }
  const roll = Math.random();
  if (roll < 0.03) {
    // Rare transient outage.
    return { status: MonitorStatus.DOWN, latencyMs: 0, statusCode: 502, up: false };
  }
  if (roll < 0.1) {
    // Elevated latency — degraded but serving.
    return {
      status: MonitorStatus.DEGRADED,
      latencyMs: 300 + Math.floor(Math.random() * 500),
      statusCode: 200,
      up: true,
    };
  }
  // Healthy.
  return {
    status: MonitorStatus.UP,
    latencyMs: 40 + Math.floor(Math.random() * 90),
    statusCode: 200,
    up: true,
  };
}
