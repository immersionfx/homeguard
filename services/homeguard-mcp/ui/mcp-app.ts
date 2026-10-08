import { App } from "@modelcontextprotocol/ext-apps";

type CheckinResponse = "ok" | "on_my_way" | "need_help";

interface CheckinToolResult {
  status: "pending" | "successful" | "unanswered" | "help_requested" | "none";
  resident_id?: string;
  reason?: string;
  response?: string | null;
}

const loadingEl = document.getElementById("loading")!;
const checkinEl = document.getElementById("checkin")!;
const resultEl = document.getElementById("result")!;
const resultIconEl = document.getElementById("result-icon")!;
const resultTextEl = document.getElementById("result-text")!;
const resultSubtitleEl = document.getElementById("result-subtitle")!;

const btnOk = document.getElementById("btn-ok") as HTMLButtonElement;
const btnOnTheWay = document.getElementById("btn-on-the-way") as HTMLButtonElement;
const btnHelp = document.getElementById("btn-help") as HTMLButtonElement;

function show(el: HTMLElement) {
  [loadingEl, checkinEl, resultEl].forEach((e) => e.classList.add("hidden"));
  el.classList.remove("hidden");
}

function extractJson<T>(result: { content?: Array<{ type: string; text?: string }> }): T | null {
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function showResult(response: CheckinResponse, via = "firetv_remote") {
  if (response === "need_help") {
    resultIconEl.textContent = "🆘";
    resultTextEl.textContent = "Help is on the way.";
    resultSubtitleEl.textContent = "We've let your caregiver know right away.";
  } else if (response === "on_my_way") {
    resultIconEl.textContent = "🏠";
    resultTextEl.textContent = "Good to know — see you soon.";
    resultSubtitleEl.textContent = via === "firetv_voice" ? "🎙️ Voice confirmed via Alexa" : "";
  } else {
    resultIconEl.textContent = "✅";
    resultTextEl.textContent = "Thanks, Maria.";
    resultSubtitleEl.textContent =
      via === "firetv_voice"
        ? "Glad you're doing okay. (Voice confirmed: \"I'm fine\")"
        : "Glad you're doing okay.";
  }
  show(resultEl);
}

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch {}
}

function speakPrompt() {
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance("Maria, are you okay? Press OK, or say: I'm fine.");
      utter.rate = 0.95;
      utter.lang = "en-US";
      window.speechSynthesis.speak(utter);
    }
  } catch {}
}

let activeRecognition: any = null;

function startVoiceRecognition() {
  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) return;
  try {
    if (activeRecognition) {
      activeRecognition.stop();
    }
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const transcript = (e.results[0]?.[0]?.transcript || "").toLowerCase();
      if (transcript.includes("help")) {
        respond("need_help", "firetv_voice");
      } else if (
        transcript.includes("fine") ||
        transcript.includes("ok") ||
        transcript.includes("okay") ||
        transcript.includes("yes")
      ) {
        respond("ok", "firetv_voice");
      }
    };
    rec.start();
    activeRecognition = rec;
  } catch {}
}

const app = new App({ name: "HOMEGUARD Check-in", version: "0.1.0" });
app.connect();

// Fires when the host delivers the request_checkin tool result — this
// is what put us on screen in the first place.
app.ontoolresult = (result) => {
  const data = extractJson<CheckinToolResult>(result);
  if (!data || data.status === "pending") {
    show(checkinEl);
    playChime();
    speakPrompt();
    startVoiceRecognition();
  } else {
    show(loadingEl);
  }
};

async function respond(
  response: CheckinResponse,
  via: "firetv_remote" | "firetv_voice" = "firetv_remote"
) {
  [btnOk, btnOnTheWay, btnHelp].forEach((b) => (b.disabled = true));
  if (activeRecognition) {
    try {
      activeRecognition.stop();
    } catch {}
    activeRecognition = null;
  }
  try {
    const result = await app.callServerTool({
      name: "respond_checkin",
      arguments: { response, via },
    });
    extractJson(result); // server ack, UI drives its own copy from the button pressed
    showResult(response, via);
  } catch (err) {
    console.error("respond_checkin failed", err);
    [btnOk, btnOnTheWay, btnHelp].forEach((b) => (b.disabled = false));
  }
}

btnOk.addEventListener("click", () => respond("ok", "firetv_remote"));
btnOnTheWay.addEventListener("click", () => respond("on_my_way", "firetv_remote"));
btnHelp.addEventListener("click", () => respond("need_help", "firetv_remote"));

// Listen for simulated voice events from the TV remote controller
window.addEventListener("message", (event) => {
  if (event.data?.type === "TV_VOICE") {
    const text = (event.data.text || "").toLowerCase();
    if (text.includes("help")) {
      respond("need_help", "firetv_voice");
    } else {
      respond("ok", "firetv_voice");
    }
  }
});

// D-pad friendliness: first actionable button gets initial focus once
// the check-in screen becomes visible.
const observer = new MutationObserver(() => {
  if (!checkinEl.classList.contains("hidden")) {
    btnOk.focus();
  }
});
observer.observe(checkinEl, { attributes: true, attributeFilter: ["class"] });

