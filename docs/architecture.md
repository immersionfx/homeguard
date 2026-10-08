# Architecture — as built

This diagram matches what is **actually running** in the repo today
(Alexa+ primary track, real MCP, supporting Fire TV + Ring).

## System context

```mermaid
flowchart LR
  subgraph maria["Maria's home"]
    Echo["Alexa+ Echo sim<br/>apps/alexa-sim"]
    FTV["Fire TV shell<br/>apps/firetv<br/>MCP Apps host"]
    Ring["Ring entrance<br/>MockRingAdapter"]
    Bee["Bee wearable<br/>MockBeeAdapter"]
  end

  subgraph brain["HomeGuard brain"]
    MCP["homeguard-mcp<br/>Streamable HTTP /mcp"]
    Eng["behavior-engine<br/>computeDeviation"]
    Pol["policy<br/>decideAgentAction"]
    Model["event-model<br/>Zod contracts"]
  end

  subgraph eleni["Eleni — caregiver"]
    Phone["Phone UI<br/>dashboard pane 3"]
  end

  Dash["Unified dashboard<br/>apps/dashboard :5173"]

  Echo -->|tools/call| MCP
  FTV -->|AppBridge + tools/call| MCP
  Dash -->|tools/call + SSE| MCP
  Ring -.->|events via adapters / demoState| MCP
  Bee -.->|optional mock signal| Eng
  MCP --> Eng
  MCP --> Pol
  Eng --> Model
  Pol --> Model
  MCP -->|notify_caregiver → SSE| Phone
  Phone -->|HTTP acknowledge| MCP
```

## Request path (MCP)

```mermaid
sequenceDiagram
  participant Client as Alexa sim / Fire TV / Dashboard
  participant HTTP as Express POST /mcp
  participant Srv as McpServer (fresh per request)
  participant State as demoState (shared)
  participant Eng as behavior-engine / policy

  Client->>HTTP: JSON-RPC (initialize / tools/list / tools/call)
  HTTP->>Srv: createHomeguardServer(demoState) + StreamableHTTPServerTransport
  Srv->>State: read/write domain signals
  Srv->>Eng: computeDeviation / decideAgentAction (as needed)
  Eng-->>Srv: Deviation reasons[] / AgentAction
  Srv-->>Client: tool result JSON
  Note over Srv: Server + transport discarded after response<br/>(CVE-2026-25536-safe)
```

## Escalation ladder (runtime)

| Level | Name | What runs | Who is affected |
| :---: | :--- | :--- | :--- |
| L0 | Observe | `get_behavior_status`, baseline, events, deviation, schedule, Ring metadata | Nobody |
| L1 | Verify | `request_checkin` → Alexa voice then Fire TV overlay; `respond_checkin` | Maria |
| L2 | Gather context | Gated `get_ring_event(include_media=true)` | Maria’s privacy (audited) |
| L3 | Contact caregiver | `notify_caregiver` → SSE → phone UI | Eleni |

Human acknowledge is **not** an MCP tool.

## Package map

```
packages/event-model       Shared Zod types
services/behavior-engine   Deterministic deviation scoring
services/policy            Pure decideAgentAction + HomeGuardPolicy
services/homeguard-mcp     MCP server, MCP App UI, caregiver HTTP/SSE
adapters/alexa             SimulatedAlexaAdapter
adapters/ring              MockRingAdapter (entrance + snapshot placeholder)
adapters/bee               MockBeeAdapter (mode: "mock")
apps/dashboard             3-pane demo (Maria / Brain / Eleni)
apps/firetv                10-foot shell + MCP Apps host
apps/alexa-sim             Echo / Alexa+ simulator + MCP client
```

## Integration modes (enforced in UI)

| Component | Mode |
| :--- | :--- |
| Alexa+ | SIMULATED (web agentic client) |
| MCP | **REAL** (SDK Streamable HTTP) |
| Fire TV | SIMULATOR |
| Ring | MOCK + server Ring Gate |
| Bee | MOCK |
| Caregiver phone | SIMULATED view of real notify/SSE |
| Baseline history | SEEDED SYNTHETIC (computation real) |

## Deliberately not in this build

- Production Alexa+ OAuth 2.1 / PKCE / PRM account linking
- AWS hosting (Lambda / API Gateway / Bedrock)
- Real Bee or Ring cloud accounts
- SQLite persistence (in-memory `demoState` only)
- Level-4 re-notify / emergency services (roadmap, never claimed)

## Related

- Privacy rules: `docs/privacy.md`
- Submission / friction / feedback: `SUBMISSION.md`
