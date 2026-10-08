/**
 * main.ts — HOMEGUARD Fire TV App Shell
 *
 * Implements the 10-foot TV state machine:
 * - Ambient / Idle Screen
 * - Check-in Overlay Screen with embedded MCP Apps Host
 * - Interactive Fire TV Remote Simulator & D-pad Controller
 */

import { FireTvMcpHost } from "./mcpHost.js";
import { TvRemoteController, type TvRemoteKey } from "./tvRemote.js";

// DOM Elements
const ambientScreen = document.getElementById("ambient-screen") as HTMLElement;
const checkinScreen = document.getElementById("checkin-screen") as HTMLElement;
const checkinIframe = document.getElementById("checkin-iframe") as HTMLIFrameElement;
const mcpStatusEl = document.getElementById("mcp-server-status") as HTMLElement;
const tvClockEl = document.getElementById("tv-clock") as HTMLElement;
const tvDateEl = document.getElementById("tv-date") as HTMLElement;
const btnTestCheckin = document.getElementById("btn-test-checkin") as HTMLButtonElement;

// Remote simulator buttons
const remoteButtons: Record<TvRemoteKey, HTMLButtonElement | null> = {
  up: document.getElementById("remote-btn-up") as HTMLButtonElement,
  down: document.getElementById("remote-btn-down") as HTMLButtonElement,
  left: document.getElementById("remote-btn-left") as HTMLButtonElement,
  right: document.getElementById("remote-btn-right") as HTMLButtonElement,
  select: document.getElementById("remote-btn-select") as HTMLButtonElement,
  back: document.getElementById("remote-btn-back") as HTMLButtonElement,
  home: document.getElementById("remote-btn-home") as HTMLButtonElement,
  menu: document.getElementById("remote-btn-menu") as HTMLButtonElement,
};

// Controllers
const tvRemote = new TvRemoteController();
const mcpHost = new FireTvMcpHost({ serverUrl: "http://localhost:3000/mcp" });

let isCheckinActive = false;

// 1. Clock & Date
function updateClock(): void {
  const now = new Date();
  tvClockEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  tvDateEl.textContent = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
setInterval(updateClock, 1000);
updateClock();

// 2. MCP Server Connection & Status
mcpHost.onStatusChange((status) => {
  if (status === "connected") {
    mcpStatusEl.textContent = "Connected (/mcp)";
    mcpStatusEl.style.color = "var(--tv-success)";
  } else if (status === "connecting") {
    mcpStatusEl.textContent = "Connecting…";
    mcpStatusEl.style.color = "var(--tv-warning)";
  } else if (status === "error") {
    mcpStatusEl.textContent = "Offline (Retry)";
    mcpStatusEl.style.color = "var(--tv-danger)";
  } else {
    mcpStatusEl.textContent = "Disconnected";
    mcpStatusEl.style.color = "var(--tv-text-secondary)";
  }
});

// Auto-connect to MCP server on launch
mcpHost.connect().catch((err) => {
  console.warn("Initial MCP connection failed, will retry on demand:", err);
});

// 3. Screen Transitions
export async function showCheckinScreen(reason = "Evening departure window elapsed without return."): Promise<void> {
  if (isCheckinActive) return;
  isCheckinActive = true;

  try {
    // 1. Call request_checkin on the real MCP server
    await mcpHost.requestCheckin("maria", reason);

    // 2. Fetch the bundled 10-foot check-in HTML from MCP App resource ui://homeguard/checkin
    const html = await mcpHost.getCheckinHtml();

    // 3. Mount in iframe
    checkinIframe.srcdoc = html;

    // 4. Wait for iframe document load to establish AppBridge
    await new Promise<void>((resolve) => {
      checkinIframe.onload = () => resolve();
    });

    // 5. Connect AppBridge and link remote navigation
    await mcpHost.attachIframe(checkinIframe, { resident_id: "maria", reason });
    tvRemote.setIframe(checkinIframe);

    // 6. Switch visibility
    ambientScreen.classList.add("hidden");
    checkinScreen.classList.remove("hidden");
  } catch (err) {
    console.error("Failed to present check-in screen:", err);
    isCheckinActive = false;
    alert("Check-in could not be loaded. Ensure HOMEGUARD MCP server is running on http://localhost:3000/mcp");
  }
}

export function hideCheckinScreen(): void {
  if (!isCheckinActive) return;
  isCheckinActive = false;
  tvRemote.setIframe(null);
  checkinScreen.classList.add("hidden");
  ambientScreen.classList.remove("hidden");
  btnTestCheckin.focus();
}

// 4. Check-in Completion Handler
mcpHost.onCheckinComplete((response) => {
  console.log(`[Fire TV] Resident check-in response received: ${response}`);
  // Give resident 4 seconds to view the confirmation screen before returning to ambient TV
  setTimeout(() => {
    hideCheckinScreen();
  }, 4000);
});

// 5. Remote Simulator Interactivity
for (const [key, btn] of Object.entries(remoteButtons)) {
  if (!btn) continue;
  btn.addEventListener("click", () => {
    tvRemote.sendKey(key as TvRemoteKey);
  });
}

// Visual feedback on remote buttons when keys are pressed
tvRemote.addListener((key) => {
  const btn = remoteButtons[key];
  if (btn) {
    btn.classList.add("active");
    setTimeout(() => btn.classList.remove("active"), 150);
  }

  // Handle Home/Back key on TV shell level
  if (key === "home") {
    hideCheckinScreen();
  } else if (key === "select" && !isCheckinActive) {
    showCheckinScreen();
  }
});

// Start D-pad keyboard listener
tvRemote.start();

// 5b. Remote Microphone / Alexa Voice Button
const btnRemoteVoice = document.getElementById("remote-btn-voice") as HTMLButtonElement | null;
if (btnRemoteVoice) {
  btnRemoteVoice.addEventListener("click", () => {
    btnRemoteVoice.classList.add("active");
    setTimeout(() => btnRemoteVoice.classList.remove("active"), 350);

    if (isCheckinActive && checkinIframe.contentWindow) {
      // Dispatch voice reply to check-in iframe: Maria says "I'm fine"
      checkinIframe.contentWindow.postMessage({ type: "TV_VOICE", text: "I'm fine" }, "*");
    } else if (!isCheckinActive) {
      showCheckinScreen();
    }
  });
}

// Test Check-in Button in Ambient Screen
btnTestCheckin.addEventListener("click", () => {
  showCheckinScreen();
});

// Initial focus on Ambient Screen prompt
btnTestCheckin.focus();

