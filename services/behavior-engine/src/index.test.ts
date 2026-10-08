import { describe, it, expect } from "vitest";
import type { Baseline } from "@homesense/event-model";
import { computeDeviation } from "./index";
import { decideAgentAction, DEFAULT_POLICY } from "@homesense/policy";

const mariaBaseline: Baseline = {
  residentId: "maria",
  usualDepartureWindow: ["18:30", "18:50"],
  usualReturnDurationMinutes: [35, 50],
  eveningTvUsuallyActive: true,
  eveningAlexaUsuallyActive: true,
};

describe("computeDeviation", () => {
  it("is LOW when the resident returns within the usual window (30 min, window 35-50)", () => {
    const result = computeDeviation("maria", mariaBaseline, {
      departureDetected: true,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 30,
      fireTvActive: true,
      alexaActive: true,
    });
    expect(result.severity).toBe("low");
    expect(result.confidence).toBeLessThan(0.6);
  });

  it("is NOT elevated once a return event is detected, regardless of elapsed time", () => {
    const result = computeDeviation("maria", mariaBaseline, {
      departureDetected: true,
      returnDetected: true,
      elapsedMinutesSinceDeparture: 200,
      fireTvActive: false,
      alexaActive: false,
    });
    expect(result.severity).toBe("low");
  });

  it("is MEDIUM or HIGH at 75 minutes elapsed with no Fire TV / Alexa activity", () => {
    const result = computeDeviation("maria", mariaBaseline, {
      departureDetected: true,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 75,
      fireTvActive: false,
      alexaActive: false,
    });
    expect(["medium", "high"]).toContain(result.severity);
    expect(result.confidence).toBeGreaterThanOrEqual(DEFAULT_POLICY.lowThreshold);
    expect(result.reasons).toContain("unusually long absence");
  });

  it("escalates toward HIGH the longer the absence continues with no signals", () => {
    const result = computeDeviation("maria", mariaBaseline, {
      departureDetected: true,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 130,
      fireTvActive: false,
      alexaActive: false,
    });
    expect(result.severity).toBe("high");
    expect(result.confidence).toBeGreaterThanOrEqual(DEFAULT_POLICY.highThreshold);
  });
});

describe("decideAgentAction (policy)", () => {
  it("does NOT call notify_caregiver when a medium deviation resolves via successful check-in", () => {
    const deviation = computeDeviation("maria", mariaBaseline, {
      departureDetected: true,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 75,
      fireTvActive: false,
      alexaActive: false,
    });
    const action = decideAgentAction(deviation, "successful");
    expect(action).toBe("NO_ACTION");
  });

  it("MUST inspect ring first, then escalate when high deviation check-in goes unanswered", () => {
    const deviation = computeDeviation("maria", mariaBaseline, {
      departureDetected: true,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 130,
      fireTvActive: false,
      alexaActive: false,
    });
    // First: both channels exhausted, Ring gate allows inspection
    const firstAction = decideAgentAction(deviation, "unanswered");
    expect(firstAction).toBe("INSPECT_RING");

    // Second: once Ring is inspected, agent escalates to caregiver
    const secondAction = decideAgentAction(deviation, "unanswered", { ringInspected: true });
    expect(secondAction).toBe("ESCALATE");
  });

  it("requests a check-in (does not escalate immediately) for a fresh medium deviation", () => {
    const deviation = computeDeviation("maria", mariaBaseline, {
      departureDetected: true,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 75,
      fireTvActive: false,
      alexaActive: false,
    });
    const action = decideAgentAction(deviation, "none");
    expect(action).toBe("REQUEST_CHECKIN");
  });

  it("does nothing for a low deviation with no check-in in progress", () => {
    const deviation = computeDeviation("maria", mariaBaseline, {
      departureDetected: true,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 30,
      fireTvActive: true,
      alexaActive: true,
    });
    const action = decideAgentAction(deviation, "none");
    expect(action).toBe("NO_ACTION");
  });
});

describe("v3 Golden Scenarios (in-process validation)", () => {
  it("Scenario A — 'Quiet afternoon' (harmless): NO_ACTION, confidence < lowThreshold", () => {
    const dev = computeDeviation("maria", mariaBaseline, {
      departureDetected: false,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 0,
      fireTvActive: true,
      alexaActive: false,
      wearableActive: true,
    });
    expect(dev.severity).toBe("low");
    expect(dev.confidence).toBeLessThan(DEFAULT_POLICY.lowThreshold);
    expect(dev.reasons).toContain("wearable active");
    expect(decideAgentAction(dev, "none")).toBe("NO_ACTION");
  });

  it("Scenario B — 'Sudden stop' (incident): high dev -> REQUEST_CHECKIN -> unanswered -> INSPECT_RING -> ESCALATE", () => {
    const dev = computeDeviation("maria", mariaBaseline, {
      departureDetected: false,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 0,
      fireTvActive: false,
      alexaActive: false,
      wearableActive: false,
      suddenInactivity: true,
    });
    expect(dev.confidence).toBeGreaterThanOrEqual(DEFAULT_POLICY.highThreshold);
    // Ask first, even at high confidence
    expect(decideAgentAction(dev, "none")).toBe("REQUEST_CHECKIN");

    // Checkin unanswered: inspect Ring first
    expect(decideAgentAction(dev, "unanswered", { ringInspected: false })).toBe("INSPECT_RING");

    // Once Ring is inspected: escalate to caregiver
    expect(decideAgentAction(dev, "unanswered", { ringInspected: true, caregiverNotified: false })).toBe("ESCALATE");
  });

  it("Scenario B-negative — resident answers 'ok' -> resolves immediately, no Ring, no Escalate", () => {
    const dev = computeDeviation("maria", mariaBaseline, {
      departureDetected: false,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 0,
      fireTvActive: false,
      alexaActive: false,
      suddenInactivity: true,
    });
    expect(decideAgentAction(dev, "successful")).toBe("NO_ACTION");
  });

  it("Scenario C1 — 'Quiet Tuesday' (schedule explanation): NO_ACTION when departure corroborated", () => {
    const dev = computeDeviation("maria", mariaBaseline, {
      departureDetected: true,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 60,
      fireTvActive: false,
      alexaActive: false,
      schedule: {
        hasAppointmentAway: true,
        appointmentTitle: "Physiotherapy",
        isWithinWindow: true,
        departureCorroborated: true,
      },
    });
    expect(dev.explainedBy).toBeDefined();
    expect(dev.explainedBy?.corroboratedBy).toBe("ring_departure");
    expect(decideAgentAction(dev, "none")).toBe("NO_ACTION");
  });

  it("Scenario C1 Variant — appointment away but NO departure observed: not explained -> REQUEST_CHECKIN", () => {
    const dev = computeDeviation("maria", mariaBaseline, {
      departureDetected: false,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 0,
      fireTvActive: false,
      alexaActive: false,
      morningInactivity: true,
      schedule: {
        hasAppointmentAway: true,
        appointmentTitle: "Physiotherapy",
        isWithinWindow: true,
        departureCorroborated: false,
      },
    });
    expect(dev.explainedBy).toBeUndefined();
    expect(dev.reasons).toContain(
      "Calendar shows an appointment away from home, but no departure was observed."
    );
    expect(decideAgentAction(dev, "none")).toBe("REQUEST_CHECKIN");
  });

  it("Scenario C2 — 'Silent Thursday' (soft intervention succeeds): voice response 'ok' -> NO_ACTION", () => {
    const dev = computeDeviation("maria", mariaBaseline, {
      departureDetected: false,
      returnDetected: false,
      elapsedMinutesSinceDeparture: 0,
      fireTvActive: false,
      alexaActive: false,
      morningInactivity: true,
    });
    expect(dev.confidence).toBeGreaterThanOrEqual(DEFAULT_POLICY.lowThreshold);
    expect(decideAgentAction(dev, "none")).toBe("REQUEST_CHECKIN");
    // Maria replies 'ok' via voice
    expect(decideAgentAction(dev, "successful")).toBe("NO_ACTION");
  });
});

