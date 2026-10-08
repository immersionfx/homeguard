# Privacy & safety — HomeGuard

HomeGuard is positioned as **understanding routine**, not surveillance.
This document formalizes the privacy rules already enforced in code
(`services/homeguard-mcp` Ring gate, adapters, caregiver payloads).

## Principles

1. **Least intrusive first.** Context → questions → camera → family.
2. **No continuous video.** Ring media is on-demand only.
3. **Default deny for media.** `include_media` defaults to `false` on `get_ring_event`.
4. **Server enforces policy.** The agent may propose; the MCP tool handler disposes.
5. **No medical claims.** Language stays behavioral: “unusual activity”,
   “unable to reach resident” — never stroke, fall, or medical emergency.
6. **Mock honesty.** Simulated media carries a visible `MOCK` label and is
   never presentable as a real person’s photo.

## Ring: entrance only

Ring answers one question other devices cannot: **is she home or out?**

| Signal | Gated? | Notes |
| :--- | :--- | :--- |
| Event log (departure / return / motion / person_detected) | No | Metadata used at L0 Observe |
| Derived `presence`: `home` \| `away` \| `unknown` | No | From entrance event sequence; stale → `unknown` |
| Snapshot / media (`include_media: true`) | **Yes** | Static snapshot only — never a live stream |

Ring is **not** an indoor camera. Product copy and UI must never imply
“person on sofa”, “unusual movement inside”, or fall detection.

## Ring Gate (server-enforced)

`get_ring_event(..., include_media: true)` is granted only if **all** hold:

1. `consent.ringSnapshotOnUnanswered === true` (resident opted in advance)
2. Check-in is `unanswered` on **both** voice and screen channels
3. `deviation.confidence >= highThreshold` (policy default `0.8`)
4. Snapshot cooldown is not active for this incident

Otherwise the tool returns:

```json
{ "error": "RING_ACCESS_DENIED", "failedChecks": ["…"] }
```

**Every** attempt — granted or denied — is written to the access audit log
and surfaced to the caregiver as camera-access history (timestamp + reason).

## Check-in channels (resident privacy)

| Channel | Intrusion cost | Timeout (policy) |
| :--- | :--- | :--- |
| Alexa+ voice | Low — spoken prompt in-room | `voiceTimeoutSeconds` (45) |
| Fire TV screen | Medium — on-screen overlay | `screenTimeoutSeconds` (75) |
| Ring snapshot | High — visual of entrance | Only after both unanswered |
| Caregiver notify | Highest — involves another person | Only if still unresolved / help requested |

A successful check-in **always resolves** the anomaly; no further climb.

## Caregiver boundary

- Devices never notify the caregiver directly.
- Only `notify_caregiver` reaches Eleni (via caregiver channel / SSE).
- Acknowledge / “I’m on my way” are **HTTP endpoints**, not agent tools —
  the agent cannot acknowledge on the caregiver’s behalf.
- Notification copy is generated from engine output (reasons, signals,
  presence) — non-medical headlines only.

## Data in this hackathon build

| Data | Reality |
| :--- | :--- |
| 30-day baseline history | Seeded synthetic, always labeled simulated |
| Ring snapshots | MOCK entrance placeholder |
| Bee activity | Mock adapter (`mode: "mock"`) |
| Calendar | Mock source, consent-gated |
| In-memory `demoState` | Local demo only — no production PII store |

## Related code

- Gate + audit: `services/homeguard-mcp/src/toolHandlers.ts` (`getRingEvent`)
- Policy thresholds / consent: `services/policy` (`HomeGuardPolicy`)
- Adapter: `adapters/ring` (`MockRingAdapter`)
- Submission overview: `SUBMISSION.md`
