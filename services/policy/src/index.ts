import type { AgentAction, CheckIn, CheckInStatus, Deviation } from "@homesense/event-model";

export interface HomeGuardPolicy {
  /** confidence below this => NO_ACTION */
  lowThreshold: number;
  /** confidence at/above this => escalate if unresolved */
  highThreshold: number;
  /** voice check-in timeout in seconds (default: 45) */
  voiceTimeoutSeconds: number;
  /** Fire TV screen check-in timeout in seconds (default: 75) */
  screenTimeoutSeconds: number;
  /** Ring camera inspection policy */
  ring: {
    autoInspect: boolean;
    mode: "snapshot";
    cooldownMinutes: number;
  };
  /** Schedule explanation configuration */
  schedule: {
    returnBufferMinutes: number;
    requireDepartureCorroboration: boolean;
  };
  /** P1: renotify caregiver after this many unacknowledged seconds */
  ackTimeoutSeconds: number;
  /** Resident pre-consents */
  consent: {
    ringSnapshotOnUnanswered: boolean;
    calendarContext: boolean;
  };
  /** Backward-compatible alias for voice + screen timeout */
  checkInTimeoutSeconds?: number;
}

export const DEFAULT_POLICY: HomeGuardPolicy = {
  lowThreshold: 0.6,
  highThreshold: 0.8,
  voiceTimeoutSeconds: 45,
  screenTimeoutSeconds: 75,
  ring: { autoInspect: true, mode: "snapshot", cooldownMinutes: 60 },
  schedule: { returnBufferMinutes: 45, requireDepartureCorroboration: true },
  ackTimeoutSeconds: 300,
  consent: { ringSnapshotOnUnanswered: true, calendarContext: true },
  checkInTimeoutSeconds: 120,
};

export interface DecisionContext {
  ringInspected?: boolean;
  caregiverNotified?: boolean;
  caregiverAcked?: boolean;
  secondsSinceNotify?: number;
}

/**
 * Pure decision function (v3).
 * Decides what the agent should do next based on deviation, check-in status,
 * situational context (Ring inspected, Caregiver notified/acked), and policy.
 */
export function decideAgentAction(
  deviation: Deviation,
  checkIn: CheckIn | CheckInStatus,
  ctx: DecisionContext = {},
  policy: HomeGuardPolicy = DEFAULT_POLICY
): AgentAction {
  const checkInStatus: CheckInStatus =
    typeof checkIn === "string" ? checkIn : checkIn.status;

  // 1. Resident explicitly requested help: skip camera and escalate immediately
  if (checkInStatus === "help_requested") {
    return ctx.caregiverNotified ? "NO_ACTION" : "ESCALATE";
  }

  // 2. A successful check-in always resolves the anomaly, regardless of confidence
  if (checkInStatus === "successful") {
    return "NO_ACTION";
  }

  // 3. Explained by schedule + corroborating departure: logged and no action
  if (deviation.explainedBy) {
    return "NO_ACTION";
  }

  // 4. Caregiver already engaged / acknowledged incident
  if (ctx.caregiverAcked) {
    return "NO_ACTION";
  }

  // 5. Confidence bands
  if (deviation.confidence < policy.lowThreshold) {
    return "NO_ACTION";
  }

  if (deviation.confidence < policy.highThreshold) {
    return "REQUEST_CHECKIN";
  }

  // Confidence >= highThreshold from here on:
  // Ask first, even at high confidence, if check-in not exhausted
  if (checkInStatus !== "unanswered") {
    return "REQUEST_CHECKIN";
  }

  // Both check-in channels exhausted:
  // Inspect Ring snapshot if allowed by policy and consent and not already inspected
  if (
    !ctx.ringInspected &&
    policy.ring.autoInspect &&
    policy.consent.ringSnapshotOnUnanswered
  ) {
    return "INSPECT_RING";
  }

  // If Ring already inspected (or skipped) and caregiver not yet notified -> escalate
  if (!ctx.caregiverNotified) {
    return "ESCALATE";
  }

  // Caregiver notified: check if unacknowledged timeout reached for renotify
  if ((ctx.secondsSinceNotify ?? 0) >= policy.ackTimeoutSeconds) {
    return "RENOTIFY";
  }

  // Waiting for caregiver acknowledgment
  return "NO_ACTION";
}

