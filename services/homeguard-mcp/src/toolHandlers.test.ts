import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState } from "./demoState.js";
import type { DemoResidentState } from "./demoState.js";
import * as handlers from "./toolHandlers.js";

let state: DemoResidentState;

beforeEach(() => {
  state = createInitialState();
});

function simulateDeparture(minutesAgo: number, fireTvActive: boolean, alexaActive: boolean) {
  state.departureDetected = true;
  state.returnDetected = false;
  state.departureTimestamp = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  state.fireTvActive = fireTvActive;
  state.alexaActive = alexaActive;
}

describe("HOMEGUARD MCP tool handlers — Maria scenario", () => {
  it("get_behavior_status is normal before any departure", () => {
    const status = handlers.getBehaviorStatus(state);
    expect(status.status).toBe("low");
  });

  it("full success path: departure -> medium deviation -> checkin -> resolved -> NO_ACTION", () => {
    simulateDeparture(75, false, false);

    const deviation = handlers.getBehaviorDeviation(state);
    expect(["medium", "high"]).toContain(deviation.severity);

    const nextAction = handlers.computeNextAction(state);
    expect(nextAction).toBe("REQUEST_CHECKIN");

    handlers.requestCheckin(state, "behavior_deviation");
    expect(handlers.getLastCheckin(state).status).toBe("pending");

    handlers.respondToCheckin(state, "ok");
    expect(handlers.getLastCheckin(state).status).toBe("successful");

    // Anomaly resolved — agent must NOT escalate, regardless of the
    // confidence score computed above.
    expect(handlers.computeNextAction(state)).toBe("NO_ACTION");
  });

  it("full failure path: high deviation -> checkin unanswered -> INSPECT_RING -> ESCALATE", () => {
    simulateDeparture(130, false, false);

    handlers.requestCheckin(state, "behavior_deviation");
    handlers.timeoutCheckin(state);
    expect(handlers.getLastCheckin(state).status).toBe("unanswered");

    // Level 2: Ring inspection proposed
    expect(handlers.computeNextAction(state)).toBe("INSPECT_RING");

    // Ring gate passes
    const ringResult = handlers.getRingEvent(state, true, "no response to 2 check-ins");
    expect(ringResult).toHaveProperty("granted", true);
    expect(state.ringInspected).toBe(true);
    expect(state.ringAuditLog.length).toBe(1);

    // Level 3: Now escalates to caregiver
    expect(handlers.computeNextAction(state)).toBe("ESCALATE");

    const notification = handlers.notifyCaregiver(state, "high", "unanswered check-in");
    expect(notification.status).toBe("sent");
    expect(notification.payload.accessLog.length).toBe(1);
    expect(state.caregiverNotified).toBe(true);

    // After caregiver acknowledged: hold
    handlers.acknowledgeIncident(state);
    expect(handlers.computeNextAction(state)).toBe("NO_ACTION");
  });

  it("resident pressing 'I need help' skips camera and escalates immediately", () => {
    simulateDeparture(75, false, false);
    handlers.requestCheckin(state, "behavior_deviation");
    handlers.respondToCheckin(state, "need_help");
    expect(handlers.computeNextAction(state)).toBe("ESCALATE");
  });

  it("Ring gate denies media access if check-in is not unanswered", () => {
    simulateDeparture(130, false, false);
    handlers.requestCheckin(state, "behavior_deviation");
    // checkin is still pending, not unanswered
    const denied = handlers.getRingEvent(state, true, "early attempt");
    expect(denied).toHaveProperty("error", "RING_ACCESS_DENIED");
    expect((denied as any).failedChecks).toContain("CHECKIN_NOT_UNANSWERED");
    expect(state.ringAuditLog.some((e) => !e.granted)).toBe(true);
  });

  it("getScheduleContext returns mock calendar context with consent", () => {
    state.schedule = {
      hasAppointmentAway: true,
      appointmentTitle: "Physiotherapy",
      isWithinWindow: true,
      departureCorroborated: true,
    };
    const ctx = handlers.getScheduleContext(state);
    expect(ctx.source).toBe("mock-calendar");
    expect(ctx.hasConsent).toBe(true);
    expect(ctx.awayNow).toBe(true);
    expect(ctx.items.length).toBe(1);
  });
});

