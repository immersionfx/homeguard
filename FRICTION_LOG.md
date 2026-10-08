
# Friction log

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