import type { Baseline, Deviation } from "@homesense/event-model";

export interface ScheduleSignal {
  hasAppointmentAway: boolean;
  appointmentTitle?: string;
  isWithinWindow: boolean;
  departureCorroborated: boolean;
}

export interface BehaviorSignals {
  departureDetected: boolean;
  returnDetected: boolean;
  /** minutes elapsed since the departure event, if departureDetected */
  elapsedMinutesSinceDeparture: number;
  fireTvActive: boolean;
  alexaActive: boolean;
  /** Optional Bee wearable activity signal */
  wearableActive?: boolean;
  /** Sudden inactivity detected while resident is at home */
  suddenInactivity?: boolean;
  /** Inactivity past usual morning wake/kitchen window */
  morningInactivity?: boolean;
  /** Schedule/calendar context */
  schedule?: ScheduleSignal;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Deterministic, explainable deviation scoring (v3).
 * Supports departure overrun scoring, at-home sudden/morning inactivity,
 * schedule explanation with Ring corroboration, and wearable activity offsetting.
 */
export function computeDeviation(
  residentId: string,
  baseline: Baseline,
  signals: BehaviorSignals
): Deviation {
  // 1. Schedule-based explanation check (Scenario C1)
  if (signals.schedule?.hasAppointmentAway) {
    if (signals.schedule.isWithinWindow && signals.schedule.departureCorroborated) {
      return {
        residentId,
        severity: "low",
        confidence: 0.15,
        reasons: [
          `Absence explained by scheduled appointment (${signals.schedule.appointmentTitle ?? "Away"})`,
          "departure corroborated by Ring",
        ],
        explainedBy: {
          schedule: signals.schedule.appointmentTitle ?? "Physiotherapy",
          corroboratedBy: "ring_departure",
        },
      };
    }
  }

  // 2. Sudden inactivity while resident is at home (Scenario B)
  if (signals.suddenInactivity) {
    const reasons: string[] = ["Sudden inactivity detected at home"];
    if (!signals.alexaActive) reasons.push("no Alexa interaction");
    if (!signals.fireTvActive) reasons.push("Fire TV input stopped");
    if (signals.wearableActive === false) reasons.push("wearable sudden inactivity");
    return {
      residentId,
      severity: "high",
      confidence: 0.88,
      reasons,
    };
  }

  // 3. Morning routine inactivity while at home (Scenario C2 or C1 uncorroborated)
  if (signals.morningInactivity) {
    const reasons: string[] = ["Expected morning routine elapsed with no activity"];
    if (signals.schedule?.hasAppointmentAway && !signals.schedule.departureCorroborated) {
      reasons.push(
        "Calendar shows an appointment away from home, but no departure was observed."
      );
      return {
        residentId,
        severity: "medium",
        confidence: 0.72,
        reasons,
      };
    }
    return {
      residentId,
      severity: "medium",
      confidence: 0.68,
      reasons,
    };
  }

  // 4. Resident at home with regular/quiet activity (Scenario A)
  if (!signals.departureDetected || signals.returnDetected) {
    if (!signals.alexaActive && (signals.fireTvActive || signals.wearableActive)) {
      const reasons: string[] = ["No Alexa interaction for 3h"];
      if (signals.fireTvActive) reasons.push("Fire TV active");
      if (signals.wearableActive) reasons.push("wearable active");
      return {
        residentId,
        severity: "low",
        confidence: 0.25,
        reasons,
      };
    }

    return {
      residentId,
      severity: "low",
      confidence: 0.05,
      reasons: ["activity consistent with usual pattern"],
    };
  }

  // 5. Departure absence overrun scoring
  const reasons: string[] = [];
  const [, maxReturnMinutes] = baseline.usualReturnDurationMinutes;
  const overrunMinutes = signals.elapsedMinutesSinceDeparture - maxReturnMinutes;

  if (overrunMinutes <= 0) {
    return {
      residentId,
      severity: "low",
      confidence: 0.1,
      reasons: ["departure detected, still within usual return window"],
    };
  }

  reasons.push("unusually long absence");
  const overrunRatio = overrunMinutes / maxReturnMinutes;

  let missingSignalCount = 0;
  if (baseline.eveningTvUsuallyActive && !signals.fireTvActive) {
    missingSignalCount += 1;
    reasons.push("no expected Fire TV activity");
  }
  if (baseline.eveningAlexaUsuallyActive && !signals.alexaActive) {
    missingSignalCount += 1;
    reasons.push("no expected Alexa interaction");
  }

  // If calendar showed appointment away but no departure corroborated
  if (signals.schedule?.hasAppointmentAway && !signals.schedule.departureCorroborated) {
    reasons.push(
      "Calendar shows an appointment away from home, but no departure was observed."
    );
  }

  // Wearable offset if active
  let confidenceAdjustment = 0;
  if (signals.wearableActive) {
    confidenceAdjustment = -0.15;
    reasons.push("wearable active");
  }

  const confidence = clamp(
    0.6 * overrunRatio + 0.2 * missingSignalCount + confidenceAdjustment,
    0,
    0.97
  );

  const severity = confidence < 0.6 ? "low" : confidence < 0.8 ? "medium" : "high";

  return { residentId, severity, confidence, reasons };
}

