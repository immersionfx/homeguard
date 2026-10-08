import type { Baseline, CheckInStatus, NormalizedEvent } from "@homesense/event-model";

/**
 * NOTE on CVE-2026-25536: this module holds APPLICATION/domain state
 * (Maria's current signals) and is intentionally a shared singleton
 * across requests — that's correct and required, it represents the
 * real world. What must NEVER be a shared singleton is the MCP
 * protocol-level McpServer/Transport instance — see http.ts, which
 * creates a fresh one per HTTP request per the SDK's fix for that CVE.
 */

export interface RingAuditEntry {
  t: string;
  resource: "ring_snapshot";
  reason: string;
  granted: boolean;
  mode: "mock" | "sim" | "real";
}

export interface DemoResidentState {
  residentId: string;
  baseline: Baseline;
  departureDetected: boolean;
  returnDetected: boolean;
  departureTimestamp: string | null;
  fireTvActive: boolean;
  alexaActive: boolean;
  wearableActive?: boolean;
  suddenInactivity?: boolean;
  morningInactivity?: boolean;
  checkInStatus: CheckInStatus;
  checkInResponse: string | null;
  voiceStatus: CheckInStatus;
  screenStatus: CheckInStatus;
  ringInspected: boolean;
  caregiverNotified: boolean;
  caregiverAcked: boolean;
  secondsSinceNotify: number;
  events: NormalizedEvent[];
  ringAuditLog: RingAuditEntry[];
  schedule?: {
    hasAppointmentAway: boolean;
    appointmentTitle?: string;
    isWithinWindow: boolean;
    departureCorroborated: boolean;
  };
}

const mariaBaseline: Baseline = {
  residentId: "maria",
  usualDepartureWindow: ["18:30", "18:50"],
  usualReturnDurationMinutes: [35, 50],
  eveningTvUsuallyActive: true,
  eveningAlexaUsuallyActive: true,
};

export function createInitialState(): DemoResidentState {
  return {
    residentId: "maria",
    baseline: mariaBaseline,
    departureDetected: false,
    returnDetected: false,
    departureTimestamp: null,
    fireTvActive: true,
    alexaActive: true,
    checkInStatus: "none",
    checkInResponse: null,
    voiceStatus: "none",
    screenStatus: "none",
    ringInspected: false,
    caregiverNotified: false,
    caregiverAcked: false,
    secondsSinceNotify: 0,
    events: [],
    ringAuditLog: [],
  };
}

/** Single shared demo state for the "Maria" scenario. */
export const demoState: DemoResidentState = createInitialState();

export function elapsedMinutesSinceDeparture(state: DemoResidentState): number {
  if (!state.departureTimestamp) return 0;
  const elapsedMs = Date.now() - new Date(state.departureTimestamp).getTime();
  return Math.floor(elapsedMs / 60000);
}

export function pushEvent(state: DemoResidentState, event: NormalizedEvent): void {
  state.events.push(event);
}
