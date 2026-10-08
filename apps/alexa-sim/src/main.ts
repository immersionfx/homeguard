import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SimulatedAlexaAdapter } from "@homesense/alexa-adapter";

// Elements
const mcpBadge = document.getElementById("mcp-badge") as HTMLElement;
const lightRing = document.getElementById("light-ring") as HTMLElement;
const deviceStateLabel = document.getElementById("device-state-label") as HTMLElement;
const btnMicToggle = document.getElementById("btn-mic-toggle") as HTMLButtonElement;
const waveformEl = document.getElementById("waveform") as HTMLElement;

const alexaPromptText = document.getElementById("alexa-prompt-text") as HTMLElement;
const residentBubble = document.getElementById("resident-bubble") as HTMLElement;
const residentReplyText = document.getElementById("resident-reply-text") as HTMLElement;
const residentIntentTag = document.getElementById("resident-intent-tag") as HTMLElement;

const btnReplyFine = document.getElementById("btn-reply-fine") as HTMLButtonElement;
const btnReplyHelp = document.getElementById("btn-reply-help") as HTMLButtonElement;
const btnTriggerCheckin = document.getElementById("btn-trigger-checkin") as HTMLButtonElement;
const btnTriggerTimeout = document.getElementById("btn-trigger-timeout") as HTMLButtonElement;

const traceCallName = document.getElementById("trace-call-name") as HTMLElement;
const traceOutput = document.getElementById("trace-output") as HTMLElement;

// Services
const alexa = new SimulatedAlexaAdapter();
const SERVER_URL = "http://localhost:3000/mcp";

let mcpClient: Client | null = null;
let isConnected = false;
let isListening = false;
let activeSpeechRec: any = null;

type EchoState = "IDLE" | "PROMPTING" | "LISTENING" | "RESOLVED" | "ALERT";

function setEchoState(state: EchoState) {
  deviceStateLabel.textContent = state;
  lightRing.className = "echo-light-ring";

  switch (state) {
    case "IDLE":
      lightRing.classList.add("ring-idle");
      waveformEl.classList.add("hidden");
      btnMicToggle.classList.remove("recording");
      break;
    case "PROMPTING":
      lightRing.classList.add("ring-speaking");
      waveformEl.classList.remove("hidden");
      btnMicToggle.classList.remove("recording");
      break;
    case "LISTENING":
      lightRing.classList.add("ring-listening");
      waveformEl.classList.add("hidden");
      btnMicToggle.classList.add("recording");
      break;
    case "RESOLVED":
      lightRing.classList.add("ring-resolved");
      waveformEl.classList.add("hidden");
      btnMicToggle.classList.remove("recording");
      break;
    case "ALERT":
      lightRing.classList.add("ring-warning");
      waveformEl.classList.add("hidden");
      btnMicToggle.classList.remove("recording");
      break;
  }
}

function updateTrace(toolName: string, payload: unknown) {
  traceCallName.textContent = toolName;
  traceOutput.textContent = JSON.stringify(payload, null, 2);
}

// 1. Connect to Real MCP Server
async function connectMcp() {
  mcpBadge.textContent = "MCP: Connecting…";
  mcpBadge.style.color = "#f59e0b";

  try {
    const client = new Client({
      name: "Alexa+ Voice Simulator",
      version: "0.1.0",
    });

    const transport = new StreamableHTTPClientTransport(new URL(SERVER_URL));
    await client.connect(transport);

    mcpClient = client;
    isConnected = true;
    mcpBadge.textContent = "MCP: Connected (/mcp)";
    mcpBadge.style.color = "#34d399";

    // Read initial status
    const statusResult = await client.callTool({
      name: "get_last_checkin",
      arguments: { resident_id: "maria" },
    });
    updateTrace("get_last_checkin", statusResult);
  } catch (err) {
    console.warn("MCP connection failed (server might be offline):", err);
    mcpBadge.textContent = "MCP: Offline (Retry)";
    mcpBadge.style.color = "#ef4444";
  }
}

// 2. Trigger Canonical Voice Check-in
async function triggerVoiceCheckin(reason = "Evening departure window elapsed without return.") {
  setEchoState("PROMPTING");
  residentBubble.classList.add("hidden");
  alexaPromptText.textContent = `"${alexa.canonicalPrompt}"`;

  // Real MCP call
  if (mcpClient) {
    try {
      const res = await mcpClient.callTool({
        name: "request_checkin",
        arguments: { resident_id: "maria", reason },
      });
      updateTrace("request_checkin (channel: alexa_voice)", res);
    } catch (err) {
      console.error("request_checkin error:", err);
    }
  }

  // Speak prompt using browser TTS
  await alexa.speak(alexa.canonicalPrompt);

  // Transition to listening for resident's reply
  startListening();
}

// 3. Handle Voice Recognition & Input
function startListening() {
  setEchoState("LISTENING");
  isListening = true;

  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) {
    console.info("Web Speech API not supported in this browser; use quick pills for demo.");
    return;
  }

  try {
    if (activeSpeechRec) activeSpeechRec.stop();
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      handleResidentInput(transcript);
    };

    rec.onerror = () => {
      stopListening();
    };

    rec.onend = () => {
      if (isListening) stopListening();
    };

    rec.start();
    activeSpeechRec = rec;
  } catch (err) {
    console.warn("Speech recognition error:", err);
    stopListening();
  }
}

function stopListening() {
  isListening = false;
  if (activeSpeechRec) {
    try {
      activeSpeechRec.stop();
    } catch {}
    activeSpeechRec = null;
  }
}

// 4. Process Resident Response (Spoken or Clicked)
async function handleResidentInput(transcript: string) {
  stopListening();

  // Match intent deterministically
  const intent = alexa.matchIntent(transcript);

  // Show resident speech bubble
  residentBubble.classList.remove("hidden");
  residentReplyText.textContent = `"${transcript}"`;
  residentIntentTag.textContent = `Intent matched: ${intent.toUpperCase()} (deterministic keyword match)`;

  if (intent === "ok") {
    setEchoState("RESOLVED");
    if (mcpClient) {
      const res = await mcpClient.callTool({
        name: "respond_checkin",
        arguments: { response: "ok", via: "alexa_voice" },
      });
      updateTrace("respond_checkin (via: alexa_voice, response: ok)", res);
    }
  } else if (intent === "help") {
    setEchoState("ALERT");
    if (mcpClient) {
      const res = await mcpClient.callTool({
        name: "respond_checkin",
        arguments: { response: "need_help", via: "alexa_voice" },
      });
      updateTrace("respond_checkin (via: alexa_voice, response: need_help)", res);
    }
  } else {
    // Unrecognized speech
    residentIntentTag.textContent = `Intent unrecognized: "${transcript}". Asking for clarification.`;
    setEchoState("PROMPTING");
    alexa.speak("Maria, please say if you are okay or if you need help.");
    setTimeout(startListening, 3000);
  }
}

// 5. Button Listeners
btnMicToggle.addEventListener("click", () => {
  if (isListening) {
    stopListening();
    setEchoState("IDLE");
  } else {
    startListening();
  }
});

btnTriggerCheckin.addEventListener("click", () => {
  triggerVoiceCheckin();
});

btnReplyFine.addEventListener("click", () => {
  handleResidentInput("I'm fine, just resting");
});

btnReplyHelp.addEventListener("click", () => {
  handleResidentInput("I need help");
});

btnTriggerTimeout.addEventListener("click", async () => {
  stopListening();
  setEchoState("ALERT");
  residentBubble.classList.remove("hidden");
  residentReplyText.textContent = "— (Silence / 45s voice timeout elapsed) —";
  residentIntentTag.textContent = "Result: UNANSWERED on voice channel -> Escalates to Fire TV screen";

  if (mcpClient) {
    try {
      const res = await mcpClient.callTool({
        name: "demo_timeout_checkin",
        arguments: { channel: "voice" },
      });
      updateTrace("demo_timeout_checkin (channel: voice)", res);
    } catch (err) {
      console.error("demo_timeout_checkin error:", err);
    }
  }
});

// Launch MCP connection
connectMcp();
setEchoState("IDLE");
