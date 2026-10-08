import { computeDeviation } from "@homesense/behavior-engine";
import { decideAgentAction, DEFAULT_POLICY } from "@homesense/policy";
import type { CheckInChannel, CheckInStatus } from "@homesense/event-model";
import type { DemoResidentState } from "./demoState.js";
import { elapsedMinutesSinceDeparture } from "./demoState.js";
import { publishCaregiverEvent } from "./eventBus.js";


export function getDailyBaseline(state: DemoResidentState) {
  return {
    resident_id: state.residentId,
    patterns: {
      usual_departure: state.baseline.usualDepartureWindow.join("-"),
      usual_return_duration_minutes: state.baseline.usualReturnDurationMinutes,
      evening_tv: state.baseline.eveningTvUsuallyActive
        ? "usually_active"
        : "usually_inactive",
      evening_alexa: state.baseline.eveningAlexaUsuallyActive
        ? "usually_active"
        : "usually_inactive",
    },
  };
}

export function getRecentEvents(state: DemoResidentState) {
  return state.events;
}

export function getBehaviorDeviation(state: DemoResidentState) {
  const deviation = computeDeviation(state.residentId, state.baseline, {
    departureDetected: state.departureDetected,
    returnDetected: state.returnDetected,
    elapsedMinutesSinceDeparture: elapsedMinutesSinceDeparture(state),
    fireTvActive: state.fireTvActive,
    alexaActive: state.alexaActive,
    wearableActive: state.wearableActive,
    suddenInactivity: state.suddenInactivity,
    morningInactivity: state.morningInactivity,
    schedule: state.schedule,
  });
  return {
    severity: deviation.severity,
    confidence: deviation.confidence,
    reasons: deviation.reasons,
    explainedBy: deviation.explainedBy,
  };
}

export function getBehaviorStatus(state: DemoResidentState) {
  const deviation = getBehaviorDeviation(state);
  const summary =
    deviation.severity === "low"
      ? "Activity is consistent with the usual pattern. Nothing to report."
      : deviation.severity === "medium"
        ? "The evening routine looks somewhat different from usual. Not escalating yet, may check in."
        : "Behavior is significantly different from the usual pattern and unresolved.";
  return {
    status: deviation.severity,
    confidence: deviation.confidence,
    summary,
    incident: {
      notified: state.caregiverNotified,
      acknowledged: state.caregiverAcked,
    },
    timestamp: new Date().toISOString(),
  };
}

export function getScheduleContext(state: DemoResidentState) {
  const items = state.schedule?.hasAppointmentAway
    ? [
        {
          id: "appt-1",
          title: state.schedule.appointmentTitle ?? "Physiotherapy",
          start: new Date(Date.now() - 30 * 60_000).toISOString(),
          end: new Date(Date.now() + 30 * 60_000).toISOString(),
          away: true,
          location: "Clinic",
        },
      ]
    : [];

  return {
    residentId: state.residentId,
    source: "mock-calendar" as const,
    hasConsent: DEFAULT_POLICY.consent.calendarContext,
    awayNow: !!state.schedule?.hasAppointmentAway && state.schedule.isWithinWindow,
    items,
  };
}

export function getLastCheckin(state: DemoResidentState) {
  return {
    status: state.checkInStatus,
    response: state.checkInResponse,
    voiceStatus: state.voiceStatus,
    screenStatus: state.screenStatus,
    timestamp: new Date().toISOString(),
  };
}

export function requestCheckin(state: DemoResidentState, reason: string) {
  state.checkInStatus = "pending";
  state.voiceStatus = "pending";
  state.screenStatus = "none";
  return {
    status: "pending",
    resident_id: state.residentId,
    reason,
  };
}

export function respondToCheckin(
  state: DemoResidentState,
  response: "ok" | "on_my_way" | "need_help",
  via: CheckInChannel = "firetv_remote"
) {
  state.checkInStatus = response === "need_help" ? "help_requested" : "successful";
  state.checkInResponse = response;
  if (via === "alexa_voice") {
    state.voiceStatus = state.checkInStatus;
  } else {
    state.screenStatus = state.checkInStatus;
  }
  return getLastCheckin(state);
}

export function timeoutCheckin(state: DemoResidentState, channel: "voice" | "screen" | "both" = "both") {
  if (channel === "voice") {
    state.voiceStatus = "unanswered";
    state.screenStatus = "pending";
  } else if (channel === "screen") {
    state.screenStatus = "unanswered";
    if (state.voiceStatus === "unanswered") {
      state.checkInStatus = "unanswered";
    }
  } else {
    state.voiceStatus = "unanswered";
    state.screenStatus = "unanswered";
    state.checkInStatus = "unanswered";
  }
  return getLastCheckin(state);
}

/**
 * Ring Gate (NEW v3 §11):
 * include_media: true is granted ONLY if all 4 conditions hold:
 * 1. consent.ringSnapshotOnUnanswered is true
 * 2. check-in status is unanswered on both channels
 * 3. deviation.confidence >= highThreshold
 * 4. cooldown not active (not yet inspected for this incident)
 */
export function getRingEvent(
  state: DemoResidentState,
  includeMedia = false,
  reason = ""
) {
  const deviation = getBehaviorDeviation(state);

  if (!includeMedia) {
    return {
      source: "ring",
      type: state.departureDetected ? "departure" : "motion",
      timestamp: state.departureTimestamp ?? new Date().toISOString(),
      media: null,
    };
  }

  const failedChecks: string[] = [];
  if (!DEFAULT_POLICY.consent.ringSnapshotOnUnanswered) {
    failedChecks.push("CONSENT_MISSING");
  }
  if (state.checkInStatus !== "unanswered") {
    failedChecks.push("CHECKIN_NOT_UNANSWERED");
  }
  if (deviation.confidence < DEFAULT_POLICY.highThreshold) {
    failedChecks.push("CONFIDENCE_BELOW_HIGH_THRESHOLD");
  }
  if (state.ringInspected) {
    failedChecks.push("COOLDOWN_ACTIVE");
  }

  const timestamp = new Date().toISOString();
  if (failedChecks.length > 0) {
    state.ringAuditLog.push({
      t: timestamp,
      resource: "ring_snapshot",
      reason,
      granted: false,
      mode: "mock",
    });
    return {
      error: "RING_ACCESS_DENIED",
      failedChecks,
      timestamp,
    };
  }

  // Gate passed
  state.ringInspected = true;
  state.ringAuditLog.push({
    t: timestamp,
    resource: "ring_snapshot",
    reason,
    granted: true,
    mode: "mock",
  });

  return {
    source: "ring",
    type: "snapshot",
    mode: "mock",
    granted: true,
    timestamp,
    mediaUrl: "mock://ring/snapshot-silhouette.jpg",
    auditLogged: true,
  };
}

export function notifyCaregiver(
  state: DemoResidentState,
  severity: string,
  reason: string,
  incidentId = `incident-${state.residentId}-1`
) {
  state.caregiverNotified = true;
  const deviation = getBehaviorDeviation(state);

  const payload = {
    incidentId,
    urgency: (severity === "high" ? "urgent" : "attention") as "urgent" | "attention",
    headline: "Maria hasn't responded to check-ins",
    reasons: deviation.reasons,
    confidence: deviation.confidence,
    timeline: [
      {
        t: new Date().toISOString(),
        tool: "request_checkin",
        summary: "Voice and screen check-ins initiated and unanswered",
      },
    ],
    accessLog: state.ringAuditLog.map((entry) => ({
      t: entry.t,
      resource: entry.resource,
      reason: entry.reason,
      mode: entry.mode,
    })),
    recommendedAction: "call_resident" as const,
  };

  publishCaregiverEvent("notification", payload);

  return {
    notification_id: `notif-${incidentId}`,
    status: "sent",
    payload,
  };
}


export function acknowledgeIncident(state: DemoResidentState) {
  state.caregiverAcked = true;
  return { acknowledged: true, timestamp: new Date().toISOString() };
}

export function computeNextAction(state: DemoResidentState) {
  const deviation = computeDeviation(state.residentId, state.baseline, {
    departureDetected: state.departureDetected,
    returnDetected: state.returnDetected,
    elapsedMinutesSinceDeparture: elapsedMinutesSinceDeparture(state),
    fireTvActive: state.fireTvActive,
    alexaActive: state.alexaActive,
    wearableActive: state.wearableActive,
    suddenInactivity: state.suddenInactivity,
    morningInactivity: state.morningInactivity,
    schedule: state.schedule,
  });

  return decideAgentAction(
    deviation,
    state.checkInStatus,
    {
      ringInspected: state.ringInspected,
      caregiverNotified: state.caregiverNotified,
      caregiverAcked: state.caregiverAcked,
      secondsSinceNotify: state.secondsSinceNotify,
    },
    DEFAULT_POLICY
  );
}

