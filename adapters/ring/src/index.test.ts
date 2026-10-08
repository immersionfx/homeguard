import { describe, it, expect } from "vitest";
import { MockRingAdapter } from "./index.js";

describe("MockRingAdapter (Ring Entrance Camera)", () => {
  it("identifies mode as 'mock' per integration honesty rules", () => {
    const ring = new MockRingAdapter();
    expect(ring.mode).toBe("mock");
  });

  it("determines resident is home by default before any departures", async () => {
    const ring = new MockRingAdapter();
    const status = await ring.getLastEntranceStatus("maria");
    expect(status.isHome).toBe(true);
  });

  it("answers 'is she home or out?' accurately based on departure and return sequence", async () => {
    const ring = new MockRingAdapter();

    // 08:50 Maria leaves through front door
    ring.recordEntranceEvent("maria", "departure", "2026-10-03T08:50:00Z");
    let status = await ring.getLastEntranceStatus("maria");
    expect(status.isHome).toBe(false);
    expect(status.lastEvent?.type).toBe("departure");

    // Front porch motion while she is out does not make her home
    ring.recordEntranceEvent("maria", "motion", "2026-10-03T09:30:00Z");
    status = await ring.getLastEntranceStatus("maria");
    expect(status.isHome).toBe(false);

    // 10:15 Maria returns home
    ring.recordEntranceEvent("maria", "return", "2026-10-03T10:15:00Z");
    status = await ring.getLastEntranceStatus("maria");
    expect(status.isHome).toBe(true);
    expect(status.lastEvent?.type).toBe("return");
  });

  it("provides privacy-compliant mock snapshot with MOCK label", async () => {
    const ring = new MockRingAdapter();
    const snapshot = await ring.getSnapshot("maria", "no response to check-in");

    expect(snapshot.mode).toBe("mock");
    expect(snapshot.label).toContain("MOCK FRONT DOOR SNAPSHOT");
    expect(snapshot.reason).toBe("no response to check-in");
    expect(snapshot.url).toContain("mock://ring/");
  });

  it("retrieves recent events filtered by resident in chronological order", async () => {
    const ring = new MockRingAdapter();
    ring.recordEntranceEvent("maria", "motion", "2026-10-03T11:00:00Z");
    ring.recordEntranceEvent("maria", "departure", "2026-10-03T12:00:00Z");

    const events = await ring.getRecentEvents("maria", 5);
    expect(events.length).toBe(2);
    expect(events[0].type).toBe("departure"); // most recent first
  });
});
