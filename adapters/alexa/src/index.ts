import type { NormalizedEvent } from "@homesense/event-model";

export type AlexaVoiceIntent = "ok" | "help" | "unrecognized";

export interface AlexaVoiceAdapter {
  readonly mode: "simulated";
  speak(text: string): Promise<void>;
  matchIntent(transcript: string): AlexaVoiceIntent;
  createVoiceEvent(residentId: string, transcript: string, intent: AlexaVoiceIntent): NormalizedEvent;
}

const OK_KEYWORDS = [
  "i'm fine",
  "im fine",
  "fine",
  "okay",
  "ok",
  "yes",
  "all good",
  "good",
  "resting",
  "just resting",
  "doing ok",
  "doing well",
  "i am fine",
];

const HELP_KEYWORDS = [
  "help",
  "i need help",
  "need help",
  "emergency",
  "assist",
  "can't get up",
  "cant get up",
  "hurts",
  "fall",
  "fallen",
];

/**
 * SimulatedAlexaAdapter (Phase 5 P0):
 *
 * Provides the voice check-in channel in Maria's home.
 * Speaks the canonical prompt ("Maria, are you okay?") via browser TTS,
 * and matches resident replies using a deterministic keyword matcher
 * so that safety outcomes are 100% reproducible and explainable.
 */
export class SimulatedAlexaAdapter implements AlexaVoiceAdapter {
  readonly mode = "simulated" as const;

  /** Canonical voice check-in prompt */
  readonly canonicalPrompt = "Maria, are you okay?";

  /**
   * Speak the prompt aloud using browser SpeechSynthesis if available,
   * or log cleanly in Node/test environments.
   */
  async speak(text: string = this.canonicalPrompt): Promise<void> {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      return new Promise<void>((resolve) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.lang = "en-US";
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }
  }

  /**
   * Deterministic intent matching against safety keywords (not an LLM),
   * ensuring zero hallucinations in critical safety decisions.
   */
  matchIntent(rawInput: string): AlexaVoiceIntent {
    const normalized = rawInput.trim().toLowerCase();

    // Check help keywords first (safety precedence)
    for (const kw of HELP_KEYWORDS) {
      if (normalized.includes(kw)) {
        return "help";
      }
    }

    // Check ok keywords
    for (const kw of OK_KEYWORDS) {
      if (normalized.includes(kw)) {
        return "ok";
      }
    }

    return "unrecognized";
  }

  /**
   * Generates a normalized event suitable for the behavior engine / event model.
   */
  createVoiceEvent(
    residentId: string,
    transcript: string,
    intent: AlexaVoiceIntent
  ): NormalizedEvent {
    return {
      id: `alexa-voice-${residentId}-${Date.now()}`,
      residentId,
      timestamp: new Date().toISOString(),
      source: "alexa",
      type: "voice_checkin_response",
      metadata: {
        transcript,
        intent,
        mode: this.mode,
        channel: "alexa_voice",
      },
    };
  }
}
