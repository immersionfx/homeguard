import { describe, it, expect } from "vitest";
import { SimulatedAlexaAdapter } from "./index.js";

describe("SimulatedAlexaAdapter (Alexa+ Voice Channel)", () => {
  const alexa = new SimulatedAlexaAdapter();

  it("identifies 'mode' as 'simulated' per honesty rules", () => {
    expect(alexa.mode).toBe("simulated");
  });

  it("canonical prompt is 'Maria, are you okay?'", () => {
    expect(alexa.canonicalPrompt).toBe("Maria, are you okay?");
  });

  describe("deterministic intent matching", () => {
    it("matches 'I'm fine, just resting' to 'ok'", () => {
      expect(alexa.matchIntent("I'm fine, just resting")).toBe("ok");
    });

    it("matches 'okay', 'yes', 'all good' to 'ok'", () => {
      expect(alexa.matchIntent("Okay")).toBe("ok");
      expect(alexa.matchIntent("yes I am")).toBe("ok");
      expect(alexa.matchIntent("All good here")).toBe("ok");
    });

    it("matches 'I need help' and 'emergency' to 'help'", () => {
      expect(alexa.matchIntent("I need help")).toBe("help");
      expect(alexa.matchIntent("please help me")).toBe("help");
      expect(alexa.matchIntent("can't get up")).toBe("help");
    });

    it("help has precedence if ambiguous", () => {
      expect(alexa.matchIntent("I'm fine but wait help")).toBe("help");
    });

    it("returns 'unrecognized' for irrelevant or noisy input", () => {
      expect(alexa.matchIntent("what is the weather today")).toBe("unrecognized");
    });
  });

  it("creates a compliant NormalizedEvent", () => {
    const event = alexa.createVoiceEvent("maria", "I'm fine", "ok");
    expect(event.source).toBe("alexa");
    expect(event.type).toBe("voice_checkin_response");
    expect(event.metadata.intent).toBe("ok");
    expect(event.metadata.mode).toBe("simulated");
  });
});
