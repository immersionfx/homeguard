import type { NormalizedEvent } from "@homesense/event-model";

/**
 * Bee signal: ambient context about the resident's day (conversation
 * summaries, mood cues, activity mentions) that can feed the behavior
 * engine as an OPTIONAL extra signal. HOMEGUARD must work correctly
 * with zero Bee signal.
 */
export interface BeeAdapter {
  readonly mode: "real" | "mock";
  getRecentSignals(residentId: string, sinceIso: string): Promise<NormalizedEvent[]>;
}

/**
 * WHY THIS IS THE ONLY ADAPTER RIGHT NOW
 * ---------------------------------------
 * Bee (the Amazon wearable) currently ships hardware only within the
 * United States and its companion app is iOS-only. From a Greece-based
 * dev account there is no path to a real, populated Bee account for
 * this hackathon. Rather than pretend otherwise, Bee is treated as an
 * OPTIONAL, clearly-labeled MOCK signal source. If real US-based Bee
 * access becomes available later (e.g. a US collaborator's account
 * token), implement `RealBeeAdapter` against the same interface and
 * swap it in — nothing else in HOMEGUARD changes.
 */
export class MockBeeAdapter implements BeeAdapter {
  readonly mode = "mock" as const;

  async getRecentSignals(
    residentId: string,
    _sinceIso: string
  ): Promise<NormalizedEvent[]> {
    // Deterministic, clearly-fabricated demo data. Never presented as
    // real Bee data anywhere in the UI or docs — always paired with
    // this adapter's `mode: "mock"` flag in the dashboard.
    return [
      {
        id: `bee-mock-${residentId}-1`,
        residentId,
        timestamp: new Date().toISOString(),
        source: "bee",
        type: "conversation_summary",
        metadata: {
          mock: true,
          summary: "Sample ambient context for demo purposes only.",
        },
      },
    ];
  }
}
