import type { NormalizedEvent } from "@homesense/event-model";

export type RingEventType = "departure" | "return" | "motion" | "person_detected";

export interface RingSnapshot {
  timestamp: string;
  url: string;
  mode: "mock" | "sim" | "real";
  label: string;
  reason: string;
}

export interface EntranceStatus {
  isHome: boolean;
  lastEvent: NormalizedEvent | null;
  timestamp: string;
}

export interface RingAdapter {
  readonly mode: "mock" | "sim" | "real";
  getRecentEvents(residentId: string, limit?: number): Promise<NormalizedEvent[]>;
  getLastEntranceStatus(residentId: string): Promise<EntranceStatus>;
  getSnapshot(residentId: string, reason: string): Promise<RingSnapshot>;
  recordEntranceEvent(
    residentId: string,
    type: RingEventType,
    timestamp?: string,
    metadata?: Record<string, unknown>
  ): NormalizedEvent;
}

/**
 * MockRingAdapter (Phase 6 P0):
 *
 * Implements the Ring entrance camera adapter for HOMEGUARD.
 * In accordance with our core design principle:
 * "Ring is an entrance camera. It answers the one question no other device can:
 * is she home or out?"
 *
 * Privacy by design:
 * - Does not stream video continuously.
 * - Does not infer medical emergencies (no 'fall detected' claims).
 * - Media snapshots are served strictly on-demand through the server-enforced Ring Gate.
 */
export class MockRingAdapter implements RingAdapter {
  readonly mode = "mock" as const;
  private events: NormalizedEvent[] = [];

  constructor(initialEvents: NormalizedEvent[] = []) {
    this.events = [...initialEvents];
  }

  /**
   * Returns recent entrance events for the resident.
   */
  async getRecentEvents(residentId: string, limit = 10): Promise<NormalizedEvent[]> {
    return this.events
      .filter((e) => e.residentId === residentId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Evaluates whether the resident is currently home or out based on
   * the chronological sequence of departure/return events.
   */
  async getLastEntranceStatus(residentId: string): Promise<EntranceStatus> {
    const residentEvents = this.events.filter((e) => e.residentId === residentId);

    // Look for the most recent departure or return event
    for (let i = residentEvents.length - 1; i >= 0; i--) {
      const ev = residentEvents[i];
      if (ev.type === "departure") {
        return {
          isHome: false,
          lastEvent: ev,
          timestamp: ev.timestamp,
        };
      }
      if (ev.type === "return") {
        return {
          isHome: true,
          lastEvent: ev,
          timestamp: ev.timestamp,
        };
      }
    }

    // Default: if no departure has been observed, resident is assumed home
    return {
      isHome: true,
      lastEvent: residentEvents[residentEvents.length - 1] ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Provides a static, neutral silhouette snapshot placeholder for the front door entrance.
   * Labeled visibly as MOCK per hackathon rules §11.
   */
  async getSnapshot(residentId: string, reason: string): Promise<RingSnapshot> {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      url: `mock://ring/entrance-snapshot-${residentId}.jpg`,
      mode: this.mode,
      label: "MOCK FRONT DOOR SNAPSHOT (NO PERSON ON CAMERA)",
      reason,
    };
  }

  /**
   * Helper to append a normalized event into the adapter's event log.
   */
  recordEntranceEvent(
    residentId: string,
    type: RingEventType,
    timestamp: string = new Date().toISOString(),
    metadata: Record<string, unknown> = {}
  ): NormalizedEvent {
    const event: NormalizedEvent = {
      id: `ring-${residentId}-${type}-${Date.now()}`,
      residentId,
      timestamp,
      source: "ring",
      type,
      location: "front_door",
      metadata: {
        ...metadata,
        mode: this.mode,
      },
    };

    this.events.push(event);
    return event;
  }
}
