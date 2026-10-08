# HomeGuard / HomeSense — Hackathon Submission Notes

**Amazon Developer Hackathon 2026** · Devpost: `amazonappdev2026`  
**Primary track:** **Alexa+**  
**Supporting integrations:** Fire TV (check-in UI host), Ring (entrance presence + gated snapshot)  
**Hardware note:** Bee is explicitly mock-only (`mode: "mock"`) — US / iOS companion constraint from Greece.

> **Pitch line:** *Your home doesn't just see. It learns.*  
> HomeGuard is an AI wellbeing agent that learns one person's routine, detects meaningful deviations, verifies with the least intrusive channel first, and involves a caregiver only when unresolved — with explainable reasons every step of the way.

This file is the submission polish companion to `README.md`. It covers **about the project**, **how to run**, **what we shipped**, **how MCP powers the Alexa+ experience**, **friction logs** (judging bonus), and **product feedback** on every tool / API / SDK we used.

---

## About the project

## Inspiration

**My mom!** She lives alone. Last month she didn't answer for forty minutes. She was in the bathroom, perfectly fine. But, I spent those forty minutes not knowing if she was fine or if she needed me. 

The Amazon devices already in the home can watch: Alexa can speak, Fire TV can show a prompt, Ring can see the front door. Bee detects movements. Once you install them, every motion and every missed ping lands on you. *You* become the integration layer. 

Existing products already answer questions like: *how can I remotely monitor my mom?* But I wanted an Alexa+ agent that can answer a harder question: **how do I know when she actually needs me?**

That is what I wanted HomeGuard to solve.

## What it does

HomeGuard is an **Alexa+ AI wellbeing agent for someone living alone**. It doesn't treat every quiet morning as an emergency. It first learns what *normal* looks like for that particular person: their usual activity, the time of day, and the difference between a quiet Tuesday and an unusually quiet Thursday. 

HomeGuard runs an agentic loop:

**Observe → understand the person's normal → detect a meaningful deviation → decide whether more information is needed → check in → reassess → resolve or escalate.**

It does not use a simple rule like:

> *“No motion for 3 hours = alert daughter.”*

Instead, it learns a personal baseline and looks at deviations from that baseline. Every deviation has both a confidence score and human-readable `reasons[]`. 

When something looks genuinely unusual, HomeGuard doesn't immediately call the family. It starts with the person who matters most: **the resident.** It checks in through Alexa+. If there is no response, it can use the Fire TV screen as a second, more visible way to ask:

*“Are you okay?”*

The resident can simply say they're fine or tap a large *“I'm fine”* button. And that matters because a successful check-in ends the incident. No unnecessary notification. No worried phone call. No camera. Only if the situation remains unresolved does HomeGuard involve the caregiver. And when it does, it does not make medical diagnoses or claim to know that something is medically wrong. It just explains *why*.

Instead of:

> *“Something may be wrong.”*

the caregiver gets something closer to:

> *“Maria's activity is significantly different from her normal Tuesday morning pattern. Two check-ins received no response.”*
 
## How I built it

My primary track is **Alexa+**.

I wanted to demonstrate the experience locally, but I also wanted the underlying integration to be real. So I built both:

* a simulated Alexa+ experience for the demo
* a real self-hosted **MCP server** using Streamable HTTP

The MCP server is the actual brain of the system. The Echo simulator, Fire TV MCP App, and dashboard all use the same tool surface. Under the hood, the project is built in TypeScript with npm workspaces.

Some of the key pieces are:

* **Shared contracts:** Zod schemas in `event-model` define the data crossing package boundaries.
* **Behavior engine:** `computeDeviation()` deterministically calculates deviations and always provides explainable `reasons[]`.
* **Policy as data:** thresholds live in `HomeGuardPolicy`, rather than being scattered through the code.
* **Adapters:** Alexa, Ring, and Bee are isolated behind interfaces, so simulated devices can later be replaced by real integrations.
* **MCP server:** built with the official Model Context Protocol SDK, with tools such as `get_behavior_deviation`, `request_checkin`, `respond_checkin`, `get_ring_event`, and `notify_caregiver`.
* **MCP App check-in:** `request_checkin` can surface a purpose-built Fire TV interface with large, remote-friendly controls.
* **Human acknowledgement:** the caregiver's “I'm on it” action is deliberately outside the agent's tools. The agent can notify a human; it cannot pretend to be one.

The demo itself has three views:

- **Maria's home** — Echo, Fire TV, Ring and Bee
- **The agent's brain** — the decision ladder and live MCP trace
- **The caregiver's (Eleni's) phone** — the caregiver notification arriving through the real server flow

## Challenges I ran into

- One of the most important decisions I made was what **HomeGuard should not do**. The camera is **not the first thing the system reaches for.** In fact, I deliberately put it last. If Maria doesn't answer, HomeGuard doesn't immediately turn on a camera and start looking at her. That would solve the technical problem by creating a much bigger human one: **What kind of home would you want to live in if someone could look inside every time you didn't answer the phone?** So HomeGuard follows a strict escalation ladder: **Context → Voice → Screen → Camera → Family**

- **Choosing the right Alexa+ path**:  I considered an Agent Skill, the production MCP route, and the official web simulation. I chose a hybrid approach: **real MCP server + simulated Alexa+ client.** That let me demonstrate the actual integration architecture without pretending that my local simulator was a production Alexa device.

- **Getting MCP right**: I initially had to confront an important architectural detail: an MCP server shouldn't simply be a REST API with an MCP label attached. Each `POST /mcp` request gets its own `McpServer` and `StreamableHTTPServerTransport`. Only domain state is shared.

- **Building for a TV, not a desktop**:  A Fire TV interface is not just a web page stretched to 1080p. I needed large controls, D-pad navigation, visible focus states, and an experience that makes sense from several feet away.

- **Being honest about Ring**:  This was one of the biggest product decisions. A doorbell camera can tell us about the front door. It cannot tell us whether Maria is sitting safely on her sofa. I could have faked an indoor camera feed for the demo. Instead, I chose not to. I model Ring primarily around **departure and return**, and I enforce the privacy boundary on the server before any snapshot can be requested. That makes the demo less flashy but much more believable.

- **Bee is optional**: I couldn't access a real Bee account from my country (Greece), so I kept Bee optional and mocked. That actually reinforced an important principle: **HomeGuard should never depend on a wearable to work.**

## What I learned

The biggest lesson wasn't technical. It was about **trust**. A system like this is going to live in someone's home. That changes what “good AI” means.

**Context is more important than thresholds:** “Three hours without motion” means very different things for different people. A personal baseline is much more useful than a universal rule.

**Explainability matters:** A caregiver doesn't need another mysterious AI score. They need to understand: *“Why are you bothering me right now?”* That's why `reasons[]` is part of the behavior model, not an afterthought.

**Least-intrusive-first is a product principle:** When HomeGuard sees something unusual, the first question isn't: *“Should I alert the daughter?”* It's: *“Can I simply ask Maria?”* And if Maria says she's fine, the system believes her and stops.

**Privacy isn't a disclaimer:** I didn't want to build a surveillance system and then put a privacy paragraph next to it. Privacy is part of the decision-making logic itself. **The system earns the right to access more information only when less intrusive information isn't enough.**

## What's next for HomeGuard

The hackathon build is a working Alexa+ agent on a real MCP server. Next is taking the same tools into a home that isn’t a demo. I would:

- connect the MCP server to the sanctioned Alexa+ production path with HTTPS, OAuth 2.1 / PKCE, protected-resource metadata and account linking
- replace simulated Ring and Bee data with real adapters when accounts are available
- persist behavioral baselines so the system can survive restarts
- handle `insufficient_history` explicitly rather than pretending a few days of data are enough
- add quiet follow-ups when a caregiver hasn't acknowledged an unresolved event
- introduce proper consent flows for calendars and additional household members
- eventually support multiple caregivers and different time zones

The rule does not change: context before questions, questions before camera, camera before family.

---

## Built with

Devpost allows **up to 25 tags**. Add these in order (Amazon track first, then stack). Do **not** tag AWS or Bee — we did not call those runtimes.

1. Alexa+
2. Amazon Alexa
3. MCP
4. Model Context Protocol
5. Streamable HTTP
6. MCP Apps
7. Fire TV
8. Ring
9. TypeScript
10. Node.js
11. JavaScript
12. Express
13. Vite
14. Zod
15. Vitest
16. npm
17. JSON-RPC
18. Server-Sent Events
19. Web Speech API
20. HTML
21. CSS
22. tsx
23. Agentic AI
24. Privacy
25. Open Source

---

## 1. How to run

### Prerequisites

- Node.js 20+ (ESM)
- npm (workspaces — no Turborepo / pnpm / nx)

### Install & build the MCP App UI

```bash
npm install

# Bundles the check-in UI (ui/ → ui-dist/) that the MCP server serves as ui://homeguard/checkin
npm run build:ui --workspace=@homesense/homeguard-mcp
```

> Rebuild the UI after any change under `services/homeguard-mcp/ui/`. The server reads the pre-built bundle from disk; it does not compile on the fly.

### Start the self-hosted MCP server (required)

```bash
npx tsx services/homeguard-mcp/src/index.ts
```

- Endpoint: **`http://localhost:3000/mcp`**
- Transport: **Streamable HTTP** via official `@modelcontextprotocol/sdk` `^1.30.0`
- Spec target: **MCP 2025-11-25+** (Streamable HTTP; not legacy HTTP+SSE)
- Protocol surface verified live: `initialize` · `tools/list` · `tools/call` · `resources/read`

Optional interactive poke:

```bash
npx @modelcontextprotocol/inspector
```

### Recommended: Unified 3-pane dashboard

```bash
npm run dashboard
```

Open **[http://localhost:5173](http://localhost:5173)**

| Pane | What you get |
| :--- | :--- |
| **Maria's Home** | Fire TV ambient + MCP App check-in, Echo / Alexa+ LED ring + voice, Ring entrance camera with privacy gate |
| **Agent Brain** | Escalation ladder L0–L3, explainable deviation (`reasons[]`), live MCP tool trace over Streamable HTTP |
| **Eleni's Phone** | Caregiver Today / push alert (real SSE), “Why I'm checking” detail, one-tap acknowledge |

### Standalone device simulators

```bash
npm run firetv   # http://localhost:5174 — 10-foot Fire TV shell + D-pad remote + MCP Apps host
npm run alexa    # http://localhost:5175 — Echo / Alexa+ simulator + real /mcp client
```

### Tests

```bash
npm test
```

**42/42 passing** across behavior-engine, policy, homeguard-mcp tool handlers, Fire TV D-pad, Alexa voice adapter, and Ring adapter.

---

## 2. What has been achieved (features covered)

We do **not** walk through demo scripts here. Below is the **feature surface** that judges can inspect in code and in the live dashboard.

### Alexa+ primary track — agentic wellbeing loop

- **Simulated Alexa+ web experience** (official sanctioned path for this track) with a real MCP tool client talking to our self-hosted server.
- Echo-style device UI: idle / prompt / listening / resolved LED ring, TTS prompt (“Maria, are you okay?”), spoken or quick-pill reply.
- Deterministic voice intent matching → MCP `respond_checkin` with `via: "alexa_voice"`.
- Dual-channel check-in: **voice first (Alexa+)**, then **screen (Fire TV)** if unanswered.
- Honesty badge always visible: `Alexa+ SIMULATED · Web app agentic client · Real MCP (/mcp)`.

### Self-hosted MCP server (the Alexa+ integration surface)

MCP is the open standard that powers Alexa+ integrations. We built a **self-hosted MCP server** (not a REST API labeled “MCP”):

| Capability | Detail |
| :--- | :--- |
| SDK | `@modelcontextprotocol/sdk` `^1.30.0` |
| Transport | `StreamableHTTPServerTransport` at `POST /mcp` |
| Spec | Streamable HTTP (2025-11-25+ model); per-request server+transport (CVE-2026-25536-safe) |
| Tools | 10 domain tools + 1 demo helper (`demo_timeout_checkin`) |
| MCP App | `registerAppTool(request_checkin)` + `registerAppResource(ui://homeguard/checkin)` |
| Clients | Dashboard, Fire TV MCP Apps host, Alexa+ simulator — all call the same `/mcp` |

**Agent tools (semantic, not implementation-leaking):**

| Tool | Role |
| :--- | :--- |
| `get_behavior_status` | Natural-language-friendly status, presence, incident / handled-quietly summary |
| `get_daily_baseline` | Weekday-keyed personal baseline (wake / activity / out windows) |
| `get_recent_events` | Normalized multi-device event feed |
| `get_behavior_deviation` | Confidence + **`reasons[]`** + `signals[]` + optional `explainedBy` |
| `get_schedule_context` | Calendar / schedule context (consent-gated, mock source labeled) |
| `get_last_checkin` | Per-channel check-in state |
| `request_checkin` | **MCP App tool** — surfaces `ui://homeguard/checkin` in any Apps-capable host |
| `respond_checkin` | Resident reply path (`ok` / `need_help` / …) with channel tag |
| `get_ring_event` | Entrance events + presence; media only via server-enforced Ring Gate |
| `notify_caregiver` | Escalation payload with reasons, timeline, Ring summary, audit log |

Human caregiver actions (acknowledge) are **HTTP endpoints**, not agent tools — by design.

### Fire TV (supporting)

- 10-foot UI shell (1080p, large type, high contrast, D-pad first).
- Dedicated MCP Apps host (`AppBridge` + `PostMessageTransport`) pointed at live `/mcp`.
- Check-in overlay accepts **remote OK** or **voice** (“I'm fine”); responses tagged `firetv_remote` / `firetv_voice`.

### Ring (supporting)

- Entrance-camera model only: answers **“is she home or out?”** via departure / return / motion / person_detected.
- Presence derived from event log (ungated metadata).
- Snapshot media **server-gated** (four conditions: consent, dual unanswered check-in, high confidence, cooldown). Every grant/deny audited.
- Default `include_media = false`. No continuous stream. No “person on sofa” claims.

### Behavior engine & policy (under the Alexa+ agent)

- Personal baseline from **seeded synthetic 30-day history** (always labeled simulated); computation itself is real and weekday-keyed.
- `computeDeviation()` always returns explainable `reasons[]` (and `signals[]` for UI).
- `decideAgentAction()` is pure, policy-data-driven (thresholds live in `services/policy`, not scattered magic numbers).
- Escalation ladder **L0 Observe → L1 Verify → L2 Gather context → L3 Contact caregiver**.
- Least-intrusive-first: context before questions, questions before camera, camera before family.
- Successful check-in always resolves; high deviation with no check-in yet → request check-in, not immediate escalate.

### Caregiver channel

- Real SSE stream (`GET /caregiver/stream`), briefing (`/caregiver/briefing`), acknowledge (`/caregiver/incidents/:id/acknowledge`).
- Phone UI shows explainable reasons, Ring audit, and quiet “handled without notifying” entries — no medical language.

### Architecture honesty

Every integration mode is labeled in the UI at all times (Alexa+ simulated, MCP real, Ring mock, Fire TV simulator, Bee mock, baseline history seeded synthetic).

---

## 3. Under the hood

```
packages/event-model      Zod contracts: NormalizedEvent, Resident, Baseline,
                          Deviation, CheckIn, AgentAction
services/behavior-engine  computeDeviation() — deterministic, reasons[] + signals[]
services/policy           decideAgentAction() — pure, configurable HomeGuardPolicy
adapters/alexa            AlexaVoiceAdapter + SimulatedAlexaAdapter
adapters/ring             RingAdapter + MockRingAdapter (entrance + gate hooks)
adapters/bee              BeeAdapter + MockBeeAdapter (mode: "mock")
services/homeguard-mcp    Real MCP server + MCP App check-in + caregiver HTTP/SSE
apps/alexa-sim            Alexa+ Echo simulator (MCP client)
apps/firetv               Fire TV 10-foot shell + MCP Apps host
apps/dashboard            Unified 3-pane demo surface
```

**Design rules we did not violate**

1. Adapters isolate every external integration — engine/policy never import device SDKs.
2. Mock components declare `mode: "mock"` in code and UI.
3. Policy is data (`HomeGuardPolicy`), not scattered conditionals.
4. Reasoning stays explainable (`reasons[]` is a judged feature).
5. No hard-coded agent chains — re-decide after every new piece of context.
6. Real MCP with official SDK + Streamable HTTP — not a REST façade.
7. No medical claims; privacy-by-design for Ring media.

**MCP request model (important for Alexa+ readiness)**

Each `POST /mcp` creates a **fresh** `McpServer` + `StreamableHTTPServerTransport`, then discards them. Domain state (`demoState`) is shared; protocol state is not. This matches the SDK’s fix for cross-client leakage (CVE-2026-25536) and is the pattern Alexa+ / Streamable HTTP deployments expect.

---

## 4. Friction log

### FL-01 — Streamable HTTP vs legacy SSE mental model

| Field | Detail |
| :--- | :--- |
| **Task** | Stand up an Alexa+-eligible self-hosted MCP server on the current transport. |
| **Steps** | Followed older MCP tutorials and early examples that still showed standalone HTTP+SSE; compared against `@modelcontextprotocol/sdk` Streamable HTTP samples and Alexa+ MCP quickstart language. |
| **Expected** | One clear “hello world” path for remote MCP over HTTP. |
| **Actual** | Docs and blog posts mixed legacy SSE with Streamable HTTP; easy to implement the deprecated transport and only discover the mismatch when aligning to “spec 2025-11-25+”. |
| **Severity** | **High** (blocks track eligibility if wrong). |
| **Workaround** | Pinned SDK `^1.30.0`, used `StreamableHTTPServerTransport` only, verified with Inspector + curl `initialize` / `tools/list` / `tools/call`. |
| **Suggestion** | On Alexa+ and MCP getting-started pages, put a single banner: “Use Streamable HTTP only; HTTP+SSE is deprecated as of 2025-11-25,” with a copy-paste Express snippet. |

### FL-02 — Per-request server/transport reuse (CVE-2026-25536)

| Field | Detail |
| :--- | :--- |
| **Task** | Share one `McpServer` across Express requests for “simpler” stateful demos. |
| **Steps** | Initially considered hoisting `McpServer` / transport to module scope (common Express habit). Checked SDK release notes and security guidance. |
| **Expected** | Long-lived server instance like a normal HTTP app. |
| **Actual** | Reusing transport/server across clients is unsafe; SDK ≥1.26.0 refuses reuse. Domain state and protocol state must be separated. |
| **Severity** | **Critical** (security / correctness). |
| **Workaround** | Fresh `createHomeguardServer(demoState)` + transport per `POST /mcp`; keep `demoState` as the only shared singleton. Documented in `http.ts` and `AGENTS.md`. |
| **Suggestion** | Ship an official “stateless Streamable HTTP + shared domain store” Express template in the MCP TypeScript SDK examples so hackathon teams don’t invent the wrong pattern. |

### FL-03 — MCP Apps: `registerAppTool` + UI bundle lifecycle

| Field | Detail |
| :--- | :--- |
| **Task** | Surface an interactive Fire TV check-in when the agent calls `request_checkin`. |
| **Steps** | Implemented tool as a normal `server.tool`, then migrated to `registerAppTool` + `registerAppResource` from `@modelcontextprotocol/ext-apps`; built HTML with Vite singlefile. |
| **Expected** | Calling the tool automatically shows UI in any Apps-capable host. |
| **Actual** | Easy to forget `npm run build:ui`; server serves stale/missing `ui-dist` and hosts fail cryptically. App vs host responsibilities (who calls `respond_checkin`) took iteration. |
| **Severity** | **Medium**. |
| **Workaround** | Explicit build step in README; `request_checkin` is the App tool, `respond_checkin` is the real response path used by UI and Alexa voice. |
| **Suggestion** | Ext-apps should fail loudly at server start if `ui://` resources are missing on disk, with the exact rebuild command. |

### FL-04 — Alexa+ track path clarity (Agent Skill vs MCP vs web simulation)

| Field | Detail |
| :--- | :--- |
| **Task** | Choose the correct Alexa+ submission architecture without a production Alexa+ account. |
| **Steps** | Read Devpost rules, Amazon Alexa+ MCP quickstart (OAuth/PRM/tunnel latency), and the “simulate via web app” alternate path. |
| **Expected** | One recommended architecture for international hackathon teams. |
| **Actual** | Three paths (Agent Skill, self-hosted MCP with OAuth 2.1/PKCE/PRM + public URL, or simulated web experience). Production Alexa+ account-linking requirements are heavy for a weekend; the simulated path is allowed but under-emphasized relative to MCP. |
| **Severity** | **High** (decision risk early in the build). |
| **Workaround** | Primary: **real self-hosted MCP** (Streamable HTTP) + **simulated Alexa+ web client** that actually calls `/mcp` — satisfies “MCP powers Alexa+” while staying demoable locally. |
| **Suggestion** | Publish a “Hackathon Alexa+ starter”: local MCP (no OAuth) + optional cloudflared + thin Echo web simulator that must call real tools. |

### FL-05 — Bee developer access from outside the US

| Field | Detail |
| :--- | :--- |
| **Task** | Integrate Bee as a live wearable signal for the same narrative. |
| **Steps** | Reviewed Bee docs / CLI; attempted to obtain a real populated account from a Greece-based setup. |
| **Expected** | Sandbox or remote-dev account usable outside US / without iOS. |
| **Actual** | Bee ships US-only; companion app iOS-only. No path to real data for this team. |
| **Severity** | **High** for Bee track; **Low** for our Alexa+ primary (we designed Bee as optional). |
| **Workaround** | `BeeAdapter` interface + `MockBeeAdapter` with permanent `mode: "mock"` labeling; system works with zero Bee signal. |
| **Suggestion** | Provide a time-boxed hackathon sandbox dataset or EU-accessible emulator so international teams can exercise the real SDK. |

### FL-06 — Ring: entrance camera APIs vs “wellbeing” intuition

| Field | Detail |
| :--- | :--- |
| **Task** | Use Ring truthfully in a wellbeing agent without implying indoor surveillance. |
| **Steps** | Modeled entrance events; attempted to align product language with what a doorbell camera can actually know. |
| **Expected** | Clear Ring developer primitives for presence / departure / return suitable for agent tools. |
| **Actual** | Easy for product language to drift into “camera saw her on the sofa.” Real Ring API / Appstore path was not usable for our setup in time; mock was required. |
| **Severity** | **Medium**. |
| **Workaround** | `MockRingAdapter` answering only “home / away / unknown”; server-enforced Ring Gate for media; MOCK watermark on snapshots. |
| **Suggestion** | Document an official “presence from entrance events” recipe and a privacy-gated snapshot pattern for caregiver agents. |

### FL-07 — Fire TV: 10-foot web shell vs Fire OS / Vega native sample

| Field | Detail |
| :--- | :--- |
| **Task** | Host the MCP App check-in on a Fire TV–credible runtime (not a plain desktop page). |
| **Steps** | Evaluated Amazon multi-TV / Vega samples vs embedding an MCP Apps host in a Vite 10-foot shell with remote simulator. |
| **Expected** | Drop-in Fire TV starter that already speaks MCP Apps + D-pad. |
| **Actual** | Official samples optimize for app packaging; MCP Apps host examples optimize for desktop hosts. Bridging both required a custom shell + remote simulator. |
| **Severity** | **Medium**. |
| **Workaround** | Vite + TS 1080p Fire TV web app with `manifest.json`, D-pad focus, and dedicated MCP Apps host pointed at `/mcp`. |
| **Suggestion** | Ship a “Fire TV + MCP Apps host” sample that loads a remote `ui://` resource over Streamable HTTP with remote-key navigation baked in. |

### FL-08 — Browser Web Speech for Alexa voice replies

| Field | Detail |
| :--- | :--- |
| **Task** | Let the resident answer the Echo check-in by voice during live demo / video. |
| **Steps** | Wired Web Speech API + SpeechSynthesis; tested Chrome vs other browsers. |
| **Expected** | Reliable STT for “I'm fine” / “I need help”. |
| **Actual** | Recognition is flaky across browsers/locales; unacceptable risk for a recorded pitch. |
| **Severity** | **Medium** (demo reliability). |
| **Workaround** | Deterministic keyword matcher + quick-action pills that still emit the same MCP `respond_checkin` payload as real speech. |
| **Suggestion** | For Alexa+ simulators in hackathons, provide a tiny official “voice reply” stub API so demos aren’t hostage to browser STT. |

### FL-09 — Tool discovery vs domain safety (who may call Ring media)

| Field | Detail |
| :--- | :--- |
| **Task** | Prevent an agent from opening camera media too early even if it “wants to”. |
| **Steps** | First drafts put gate logic near the UI; moved enforcement into `get_ring_event` on the server. |
| **Expected** | Prompt/policy alone would keep the agent honest. |
| **Actual** | Prompts are not a safety boundary. Without server enforcement, a tool-capable client can request `include_media=true` prematurely. |
| **Severity** | **High** (privacy). |
| **Workaround** | Four-condition Ring Gate inside the MCP tool handler; audit log on every attempt; default `include_media=false`. |
| **Suggestion** | MCP / Alexa+ docs should show a reference pattern for **capability gates inside tools** (consent + state machine), not only tool schemas. |

### FL-10 — npm workspaces + multi-package MCP clients

| Field | Detail |
| :--- | :--- |
| **Task** | Run MCP server + dashboard + Fire TV + Alexa sim as one monorepo without heavy toolchain. |
| **Steps** | Chose npm workspaces; shared Zod models; three Vite apps each connecting to `localhost:3000/mcp`. |
| **Expected** | Smooth local DX. |
| **Actual** | CORS, concurrent ports, and “which process must start first” caused repeated onboarding friction for collaborators. |
| **Severity** | **Low**. |
| **Workaround** | Documented ordered quickstart (MCP first, then dashboard); CORS enabled on the MCP Express app. |
| **Suggestion** | An official `create-mcp-app` that scaffolds server + one web host + `.env.example` ports would cut hours off hackathon setup. |

---

## 5. Integration modes

| Component | Mode | Notes |
| :--- | :--- | :--- |
| **Alexa+** | SIMULATED | Web app agentic client — official track path |
| **MCP** | **REAL** | Official SDK, Streamable HTTP, `/mcp` |
| **Fire TV** | SIMULATOR | 10-foot shell + MCP Apps host |
| **Ring** | MOCK | Entrance presence + gated MOCK snapshot |
| **Bee** | MOCK | US/iOS hardware constraint |
| **Caregiver phone** | SIMULATED UI / REAL events | SSE fed by real `notify_caregiver` |
| **Baseline history** | SEEDED SYNTHETIC | Computation real; data labeled simulated |

---

## 6. Known limitations

- Ring sees the **entrance**, not the living room.
- Bee is mock-only; zero-Bee operation is supported.
- Voice STT depends on the browser; click/pill fallback exists.
- Cold-start / `insufficient_history` is flagged but not specially handled (P1).
- Single resident, single caregiver; emergency-services escalation is roadmap only and never claimed.
- No medical diagnosis language anywhere.

---

*HomeGuard — Alexa+ agentic wellbeing on a real MCP server.*  
*Primary track: Alexa+ · MCP: Streamable HTTP · Supporting: Fire TV + Ring.*
