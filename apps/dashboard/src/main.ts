const API_BASE = "http://localhost:3000";

// UI Elements — Scenarios & Clock
const virtualClockEl = document.getElementById("virtual-clock") as HTMLElement;
const clockContextEl = document.getElementById("clock-context") as HTMLElement;
const btnStep = document.getElementById("btn-step") as HTMLButtonElement;
const btnReset = document.getElementById("btn-reset") as HTMLButtonElement;
const scenarioBtns = document.querySelectorAll<HTMLButtonElement>(".scenario-btn");

// UI Elements — Pane 1: Maria's Home
const laneAlexa = document.getElementById("lane-alexa") as HTMLElement;
const laneFiretv = document.getElementById("lane-firetv") as HTMLElement;
const laneRing = document.getElementById("lane-ring") as HTMLElement;
const laneBee = document.getElementById("lane-bee") as HTMLElement;
const laneCalendar = document.getElementById("lane-calendar") as HTMLElement;

const miniRing = document.getElementById("mini-ring") as HTMLElement;
const voiceStatusText = document.getElementById("voice-status-text") as HTMLElement;
const voiceQuoteText = document.getElementById("voice-quote-text") as HTMLElement;
const btnHomeFine = document.getElementById("btn-home-fine") as HTMLButtonElement;
const btnHomeHelp = document.getElementById("btn-home-help") as HTMLButtonElement;

const tvViewAmbient = document.getElementById("tv-view-ambient") as HTMLElement;
const tvViewOverlay = document.getElementById("tv-view-overlay") as HTMLElement;

const ringPresenceBadge = document.getElementById("ring-presence-badge") as HTMLElement;
const snapshotPlaceholder = document.getElementById("snapshot-placeholder") as HTMLElement;
const snapshotImageContainer = document.getElementById("snapshot-image-container") as HTMLElement;
const snapshotAuditLabel = document.getElementById("snapshot-audit-label") as HTMLElement;
const btnRingDep = document.getElementById("btn-ring-dep") as HTMLButtonElement;
const btnRingRet = document.getElementById("btn-ring-ret") as HTMLButtonElement;

const beeStatusVal = document.getElementById("bee-status-val") as HTMLElement;
const calStatusVal = document.getElementById("cal-status-val") as HTMLElement;

// UI Elements — Pane 2: Agent Brain & Ladder
const ladderSteps = [
    document.getElementById("step-l0") as HTMLElement,
    document.getElementById("step-l1") as HTMLElement,
    document.getElementById("step-l2") as HTMLElement,
    document.getElementById("step-l3") as HTMLElement,
];

const devSeverityBadge = document.getElementById("dev-severity-badge") as HTMLElement;
const confidenceFill = document.getElementById("confidence-fill") as HTMLElement;
const confidenceVal = document.getElementById("confidence-val") as HTMLElement;
const reasonsUl = document.getElementById("reasons-ul") as HTMLUListElement;
const agentActionBadge = document.getElementById("agent-action-badge") as HTMLElement;
const traceStream = document.getElementById("trace-stream") as HTMLElement;

// UI Elements — Pane 3: Eleni's Phone
const tabBtnToday = document.getElementById("tab-btn-today") as HTMLButtonElement;
const tabBtnNotif = document.getElementById("tab-btn-notif") as HTMLButtonElement;
const tabBtnDetail = document.getElementById("tab-btn-detail") as HTMLButtonElement;

const viewToday = document.getElementById("view-today") as HTMLElement;
const viewNotif = document.getElementById("view-notif") as HTMLElement;
const viewDetail = document.getElementById("view-detail") as HTMLElement;

const pushNotification = document.getElementById("push-notification") as HTMLElement;
const pushTitle = document.getElementById("push-title") as HTMLElement;
const pushBody = document.getElementById("push-body") as HTMLElement;

const detailHeadline = document.getElementById("detail-headline") as HTMLElement;
const detailConf = document.getElementById("detail-conf") as HTMLElement;
const detailReasons = document.getElementById("detail-reasons") as HTMLUListElement;
const detailCameraText = document.getElementById("detail-camera-text") as HTMLElement;
const btnPhoneCall = document.getElementById("btn-phone-call") as HTMLButtonElement;
const btnPhoneAck = document.getElementById("btn-phone-ack") as HTMLButtonElement;
const btnBackPhone = document.getElementById("btn-back-phone") as HTMLButtonElement;

const phoneStatusDot = document.getElementById("phone-status-dot") as HTMLElement;
const phonePeaceBadge = document.getElementById("phone-peace-badge") as HTMLElement;
const phonePeaceSub = document.getElementById("phone-peace-sub") as HTMLElement;
const phoneItemWake = document.getElementById("phone-item-wake") as HTMLElement;
const phoneItemAlexa = document.getElementById("phone-item-alexa") as HTMLElement;
const phoneItemTv = document.getElementById("phone-item-tv") as HTMLElement;
const phoneItemNote = document.getElementById("phone-item-note") as HTMLElement;

// Current state
type ScenarioKey = "A" | "B" | "C1" | "C2";
let currentScenario: ScenarioKey = "A";
let scenarioStepIndex = 0;

function appendTrace(time: string, tool: string, result: string) {
    const row = document.createElement("div");
    row.className = "trace-row";
    row.innerHTML = `<span class="trace-t">${time}</span> <span class="trace-tool">${tool}</span> <span class="trace-res">${result}</span>`;
    traceStream.prepend(row);
}

function setLadderLevel(level: number, isIncident = false) {
    ladderSteps.forEach((step, idx) => {
        step.className = "ladder-step";
        if (idx <= level) {
            step.classList.add(isIncident && idx === level ? "step-incident" : "step-active");
        }
    });
}

function highlightLanes(activeLanes: string[]) {
    [laneAlexa, laneFiretv, laneRing, laneBee, laneCalendar].forEach((el) => {
        el.classList.remove("lane-active");
    });
    if (activeLanes.includes("alexa")) laneAlexa.classList.add("lane-active");
    if (activeLanes.includes("firetv")) laneFiretv.classList.add("lane-active");
    if (activeLanes.includes("ring")) laneRing.classList.add("lane-active");
    if (activeLanes.includes("bee")) laneBee.classList.add("lane-active");
    if (activeLanes.includes("calendar")) laneCalendar.classList.add("lane-active");
}

function setPhoneView(view: "today" | "notif" | "detail") {
    [tabBtnToday, tabBtnNotif, tabBtnDetail].forEach((b) => b.classList.remove("active"));
    [viewToday, viewNotif, viewDetail].forEach((v) => v.classList.add("hidden"));

    if (view === "today") {
        tabBtnToday.classList.add("active");
        viewToday.classList.remove("hidden");
    } else if (view === "notif") {
        tabBtnNotif.classList.add("active");
        viewNotif.classList.remove("hidden");
    } else {
        tabBtnDetail.classList.add("active");
        viewDetail.classList.remove("hidden");
    }
}

function setPhoneBriefing(opts: {
    status: string;
    badge: string;
    sub: string;
    items: [string, string][];
}) {
    setPhoneView("today");
    phoneStatusDot.textContent = opts.status;
    phonePeaceBadge.textContent = opts.badge;
    phonePeaceSub.textContent = opts.sub;
    const slots = [phoneItemWake, phoneItemAlexa, phoneItemTv, phoneItemNote];
    opts.items.forEach(([time, note], i) => {
        slots[i].innerHTML = `<span>${time}</span> ${note}`;
    });
}

function showC2ResolvedOnPhone() {
    setPhoneBriefing({
        status: "● Normal",
        badge: "🟢 Handled quietly",
        sub: "10:16 — Asked Maria; she said she's fine.",
        items: [
            ["10:15", "Morning routine overdue · no departure"],
            ["10:16", "Asked Maria; she said she's fine"],
            ["10:16", "Resolved on Echo · no Ring access"],
            ["Status", "Phone stayed dark · 0 notifications"],
        ],
    });
}

function updateDeviationUI(confidence: number, severity: "low" | "medium" | "high", reasons: string[], nextAction: string) {
    confidenceVal.textContent = confidence.toFixed(2);
    confidenceFill.style.width = `${Math.min(100, Math.round(confidence * 100))}%`;

    confidenceFill.className = "confidence-fill";
    devSeverityBadge.className = "dev-severity";

    if (severity === "low") {
        confidenceFill.classList.add("fill-low");
        devSeverityBadge.classList.add("severity-low");
        devSeverityBadge.textContent = "LOW";
    } else if (severity === "medium") {
        confidenceFill.classList.add("fill-med");
        devSeverityBadge.classList.add("severity-med");
        devSeverityBadge.textContent = "MEDIUM";
    } else {
        confidenceFill.classList.add("fill-high");
        devSeverityBadge.classList.add("severity-high");
        devSeverityBadge.textContent = "HIGH";
    }

    reasonsUl.innerHTML = reasons.map((r) => `<li>${r}</li>`).join("");
    agentActionBadge.textContent = nextAction;
}

// -------------------------------------------------------------
// SCENARIO IMPLEMENTATIONS (§8 Master Prompt)
// -------------------------------------------------------------

async function loadScenario(scenario: ScenarioKey) {
    currentScenario = scenario;
    scenarioStepIndex = 0;

    scenarioBtns.forEach((b) => {
        b.classList.toggle("active", b.dataset.scen === scenario);
    });

    // Call server scenario loader
    try {
        await fetch(`${API_BASE}/scenario/load`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario }),
        });
    } catch { }

    // Apply visual state according to the scenario
    if (scenario === "A") {
        // Scenario A: "Quiet afternoon" (harmless)
        virtualClockEl.textContent = "14:05:00";
        clockContextEl.textContent = "Monday Afternoon";

        highlightLanes(["firetv", "bee"]);
        setLadderLevel(0);

        // Maria's Home Pane
        miniRing.className = "mini-light-ring ring-idle";
        voiceStatusText.textContent = "No interaction for 3h (Usual TV Time)";
        voiceQuoteText.textContent = "— (Silent, within normal window) —";

        tvViewAmbient.classList.remove("hidden");
        tvViewOverlay.classList.add("hidden");

        ringPresenceBadge.textContent = "🟢 Home (Since 12:10)";
        snapshotPlaceholder.classList.remove("hidden");
        snapshotImageContainer.classList.add("hidden");

        beeStatusVal.textContent = "Active / Moving (wearable)";
        calStatusVal.textContent = "No appointment scheduled";

        // Agent Brain Pane
        updateDeviationUI(
            0.15,
            "low",
            ["No Alexa interaction for 3h", "Fire TV active (usual pattern)", "Wearable active / moving"],
            "NO_ACTION"
        );
        appendTrace("14:05:00", "get_behavior_deviation", "confidence: 0.15 < lowThreshold (0.6) → NO_ACTION");

        // Caregiver Phone Pane
        setPhoneBriefing({
            status: "● Normal",
            badge: "🟢 No action required",
            sub: "Activity is consistent with 30-day baseline.",
            items: [
                ["07:48", "Morning wake detected"],
                ["08:10", "Alexa morning greeting"],
                ["13:40", "Fire TV playing (usual afternoon routine)"],
                ["14:05", "Today sits inside normal band · 0 notifications"],
            ],
        });
    } else if (scenario === "B") {
        // Scenario B: "Sudden stop" (incident) — Step 0
        virtualClockEl.textContent = "14:32:00";
        clockContextEl.textContent = "Wednesday Afternoon";

        highlightLanes(["bee", "firetv", "alexa"]);
        setLadderLevel(0);

        miniRing.className = "mini-light-ring ring-speaking";
        voiceStatusText.textContent = "Sudden inactivity detected at home";
        voiceQuoteText.textContent = "Evaluating anomaly against baseline...";

        tvViewAmbient.classList.remove("hidden");
        tvViewOverlay.classList.add("hidden");

        ringPresenceBadge.textContent = "🟢 Home (No departure since 12:10)";
        snapshotPlaceholder.classList.remove("hidden");
        snapshotImageContainer.classList.add("hidden");

        beeStatusVal.textContent = "Sudden Stop (Inactivity)";
        calStatusVal.textContent = "No appointment scheduled";

        updateDeviationUI(
            0.88,
            "high",
            ["Sudden inactivity detected at home", "Fire TV input stopped unexpectedly", "No Alexa interaction"],
            "REQUEST_CHECKIN"
        );
        appendTrace("14:32:10", "get_behavior_deviation", "confidence: 0.88 >= highThreshold (0.8) → REQUEST_CHECKIN (ask first)");
        setPhoneBriefing({
            status: "● Normal",
            badge: "🟢 No notification yet",
            sub: "HomeGuard asks Maria at home before this phone is involved.",
            items: [
                ["12:10", "Ring return · presence home"],
                ["14:32", "Sudden inactivity at home"],
                ["14:32", "Check-in starts on Echo, then Fire TV"],
                ["Status", "Phone stays dark until check-ins go unanswered"],
            ],
        });
    } else if (scenario === "C1") {
        // Scenario C1: "Quiet Tuesday" (explained by calendar)
        virtualClockEl.textContent = "10:15:00";
        clockContextEl.textContent = "Tuesday Morning";

        highlightLanes(["ring", "calendar"]);
        setLadderLevel(0);

        miniRing.className = "mini-light-ring ring-idle";
        voiceStatusText.textContent = "No interaction at home since 08:50";
        voiceQuoteText.textContent = "Absence explained by calendar + Ring departure";

        tvViewAmbient.classList.remove("hidden");
        tvViewOverlay.classList.add("hidden");

        ringPresenceBadge.textContent = "🟠 Away (Departed 08:50)";
        snapshotPlaceholder.classList.remove("hidden");
        snapshotImageContainer.classList.add("hidden");

        beeStatusVal.textContent = "Regular movement";
        calStatusVal.textContent = "Physiotherapy (09:15–10:15, away)";

        updateDeviationUI(
            0.15,
            "low",
            [
                "Absence explained by scheduled appointment (Physiotherapy)",
                "Departure corroborated by Ring front door camera (08:50)",
            ],
            "NO_ACTION"
        );
        appendTrace("10:15:00", "get_behavior_deviation", "explainedBy: { schedule: 'Physiotherapy', corroboratedBy: 'ring_departure' } → NO_ACTION");

        setPhoneBriefing({
            status: "● Normal",
            badge: "🟢 Physiotherapy (expected away)",
            sub: "Ring departure 08:50 confirmed appointment.",
            items: [
                ["07:48", "Morning wake detected"],
                ["08:10", "Alexa morning greeting"],
                ["08:50", "Ring departure confirmed"],
                ["10:15", "Quiet day handled quietly · Phone stays dark"],
            ],
        });
    } else if (scenario === "C2") {
        // Scenario C2: "Silent Thursday" (soft intervention succeeds)
        virtualClockEl.textContent = "10:15:00";
        clockContextEl.textContent = "Thursday Morning";

        highlightLanes(["alexa"]);
        setLadderLevel(1);

        miniRing.className = "mini-light-ring ring-speaking";
        voiceStatusText.textContent = "Morning wake window elapsed (+2h)";
        voiceQuoteText.textContent = "\"Maria, are you okay?\"";

        tvViewAmbient.classList.remove("hidden");
        tvViewOverlay.classList.add("hidden");

        ringPresenceBadge.textContent = "🟢 Home (No departure observed)";
        snapshotPlaceholder.classList.remove("hidden");
        snapshotImageContainer.classList.add("hidden");

        beeStatusVal.textContent = "Still in bed / morning rest";
        calStatusVal.textContent = "No appointment (Thursdays at home)";

        updateDeviationUI(
            0.68,
            "medium",
            ["Expected morning routine elapsed with no activity", "No departure observed", "No calendar appointment"],
            "REQUEST_CHECKIN"
        );
        appendTrace("10:15:00", "request_checkin", "Voice check-in initiated (Echo speaks) → Level 1 Verify");

        // Phone stays dark: Thursday silence is not a wake or a greeting.
        setPhoneBriefing({
            status: "● Normal",
            badge: "🟢 No notification",
            sub: "Thursday silence is being checked on the Echo. This phone stays dark.",
            items: [
                ["07:45", "Expected wake — not observed"],
                ["08:10", "Expected Alexa greeting — not observed"],
                ["10:15", "Home · no departure · no appointment"],
                ["Status", "0 notifications · check-in on Echo"],
            ],
        });
    }
}

// -------------------------------------------------------------
// STEP-BY-STEP PLAYBACK RUNNER (Particularly for Scenario B)
// -------------------------------------------------------------

function advanceStep() {
    if (currentScenario === "B") {
        scenarioStepIndex += 1;

        if (scenarioStepIndex === 1) {
            // 14:32:15 -> Alexa Voice Check-in
            virtualClockEl.textContent = "14:32:15";
            setLadderLevel(1);
            highlightLanes(["alexa"]);
            miniRing.className = "mini-light-ring ring-speaking";
            voiceQuoteText.textContent = "\"Maria, are you okay?\"";
            voiceStatusText.textContent = "Voice check-in active (45s window)";
            appendTrace("14:32:15", "request_checkin", "Echo speaks canonical prompt → waiting for Maria");
        } else if (scenarioStepIndex === 2) {
            // 14:33:00 -> Voice timed out, Fire TV Overlay appears
            virtualClockEl.textContent = "14:33:00";
            setLadderLevel(1);
            highlightLanes(["firetv"]);
            voiceStatusText.textContent = "Voice unanswered → Escalated to Fire TV Screen (75s)";
            tvViewAmbient.classList.add("hidden");
            tvViewOverlay.classList.remove("hidden");
            appendTrace("14:33:00", "request_checkin", "Surfacing 10-foot Fire TV overlay (D-pad OK or Voice hint)");
        } else if (scenarioStepIndex === 3) {
            // 14:34:15 -> Both channels unanswered! Gate opens Ring inspection
            virtualClockEl.textContent = "14:34:20";
            setLadderLevel(2);
            highlightLanes(["ring"]);
            agentActionBadge.textContent = "INSPECT_RING";
            voiceStatusText.textContent = "Both check-in channels unanswered";

            // Ring Gate passes
            snapshotPlaceholder.classList.add("hidden");
            snapshotImageContainer.classList.remove("hidden");
            snapshotAuditLabel.textContent = "Accessed 14:34:20 — reason: check-ins unanswered";

            appendTrace("14:34:20", "get_ring_event(include_media=true)", "Ring Gate passed: all 4 privacy checks verified → MOCK snapshot logged");
        } else if (scenarioStepIndex === 4) {
            // 14:34:25 -> Escalate to Caregiver!
            virtualClockEl.textContent = "14:34:25";
            setLadderLevel(3, true);
            agentActionBadge.textContent = "ESCALATE";

            appendTrace("14:34:25", "notify_caregiver", "Escalation dispatched to My phone via SSE stream");

            // Phone triggers lockscreen notification
            setPhoneView("notif");
            pushTitle.textContent = "Maria hasn't responded to check-ins";
            pushBody.textContent = "Activity stopped suddenly at 2:32 PM, and no one has left the house since 12:10.";
        }
    } else if (currentScenario === "C2") {
        // Maria replies 'I'm fine' — logged as handled quietly, never a push.
        virtualClockEl.textContent = "10:16:00";
        setLadderLevel(0);
        miniRing.className = "mini-light-ring ring-resolved";
        voiceQuoteText.textContent = "Maria: \"I'm fine, just resting.\"";
        voiceStatusText.textContent = "Resolved via Voice Check-in (ok)";
        updateDeviationUI(0.05, "low", ["Voice check-in answered successfully ('I am fine')"], "NO_ACTION");
        appendTrace("10:16:00", "respond_checkin(via: alexa_voice, response: ok)", "Anomaly resolved → NO_ACTION · Caregiver phone stays dark");
        showC2ResolvedOnPhone();
    }
}

// -------------------------------------------------------------
// EVENT HANDLERS & LISTENERS
// -------------------------------------------------------------

scenarioBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        loadScenario(btn.dataset.scen as ScenarioKey);
    });
});

btnStep.addEventListener("click", advanceStep);
btnReset.addEventListener("click", () => loadScenario(currentScenario));

// Phone tab buttons
tabBtnToday.addEventListener("click", () => setPhoneView("today"));
tabBtnNotif.addEventListener("click", () => setPhoneView("notif"));
tabBtnDetail.addEventListener("click", () => setPhoneView("detail"));
btnBackPhone.addEventListener("click", () => setPhoneView("notif"));
pushNotification.addEventListener("click", () => setPhoneView("detail"));

// Simulated Caregiver Actions (Human actions are HTTP endpoints, §3b)
btnPhoneCall.addEventListener("click", () => {
    alert("📞 Simulating phone call to Maria (Living Room Echo).");
});

btnPhoneAck.addEventListener("click", async () => {
    try {
        const res = await fetch(`${API_BASE}/caregiver/incidents/incident-maria-1/acknowledge`, {
            method: "POST",
        });
        const data = await res.json();
        appendTrace("14:35:10", "POST /caregiver/incidents/.../acknowledge", "Eleni acknowledged incident → Agent holds");
        agentActionBadge.textContent = "NO_ACTION (Caregiver Engaged)";
        btnPhoneAck.textContent = "✓ Acknowledged";
        btnPhoneAck.disabled = true;
    } catch { }
});

// Home quick reply buttons
btnHomeFine.addEventListener("click", () => {
    miniRing.className = "mini-light-ring ring-resolved";
    voiceQuoteText.textContent = "Maria: \"I'm fine\"";
    tvViewOverlay.classList.add("hidden");
    tvViewAmbient.classList.remove("hidden");
    updateDeviationUI(0.05, "low", ["Resolved by resident response ('I am fine')"], "NO_ACTION");
    appendTrace("Now", "respond_checkin(response: ok)", "Resolved immediately · No Ring access · No caregiver alert");
    if (currentScenario === "C2") {
        setLadderLevel(0);
        showC2ResolvedOnPhone();
    }
});

btnHomeHelp.addEventListener("click", () => {
    setLadderLevel(3, true);
    agentActionBadge.textContent = "ESCALATE";
    appendTrace("Now", "respond_checkin(response: need_help)", "Resident requested help → Skips camera → Immediate escalation");
    setPhoneView("notif");
});

// Ring simulation buttons
btnRingDep.addEventListener("click", () => {
    ringPresenceBadge.textContent = "🟠 Away (Departed 08:50)";
    appendTrace("08:50:00", "Ring entrance camera", "Departure detected: Maria left front door");
});

btnRingRet.addEventListener("click", () => {
    ringPresenceBadge.textContent = "🟢 Home (Returned 12:10)";
    appendTrace("12:10:00", "Ring entrance camera", "Return detected: Maria entered front door");
});

// Connect to Caregiver SSE Stream (§13)
function connectCaregiverSSE() {
    const es = new EventSource(`${API_BASE}/caregiver/stream`);

    es.addEventListener("notification", (event: any) => {
        try {
            const payload = JSON.parse(event.data);
            setPhoneView("notif");
            pushTitle.textContent = payload.headline;
            pushBody.textContent = payload.reasons?.join(". ");
            detailHeadline.textContent = payload.headline;
            detailConf.textContent = `Confidence: ${(payload.confidence * 100).toFixed(0)}%`;
            detailReasons.innerHTML = payload.reasons?.map((r: string) => `<li>${r}</li>`).join("") || "";
            if (payload.accessLog?.[0]) {
                detailCameraText.textContent = `Camera accessed: ${payload.accessLog[0].reason}`;
            }
        } catch { }
    });

    es.addEventListener("acknowledged", () => {
        agentActionBadge.textContent = "NO_ACTION (Caregiver Engaged)";
    });
}

// Initial launch
loadScenario("A");
connectCaregiverSSE();
