import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import type { DemoResidentState } from "./demoState.js";
import * as handlers from "./toolHandlers.js";

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// The ui:// scheme tells MCP App-capable hosts this tool has an
// interactive UI. Bundled by `npm run build:ui` (vite + singlefile)
// into ui-dist/mcp-app.html, served by registerAppResource below.
const CHECKIN_RESOURCE_URI = "ui://homeguard/checkin";

/**
 * Builds a fresh McpServer bound to the given (shared) domain state.
 * MUST be called once per HTTP request — see http.ts. The server
 * instance itself is cheap and stateless; only `state` persists.
 */
export function createHomeguardServer(state: DemoResidentState): McpServer {
  const server = new McpServer({
    name: "homeguard-mcp",
    version: "0.1.0",
  });

  server.tool(
    "get_behavior_status",
    "Get a natural-language-friendly summary of the resident's current behavioral status.",
    { resident_id: z.string() },
    async () => textResult(handlers.getBehaviorStatus(state))
  );

  server.tool(
    "get_daily_baseline",
    "Get the resident's learned behavioral baseline (usual departure/return windows, expected evening activity).",
    { resident_id: z.string() },
    async () => textResult(handlers.getDailyBaseline(state))
  );

  server.tool(
    "get_recent_events",
    "Get normalized recent events (Ring, Fire TV, Alexa, Bee) for the resident.",
    { resident_id: z.string() },
    async () => textResult(handlers.getRecentEvents(state))
  );

  server.tool(
    "get_behavior_deviation",
    "Analyze current behavior against the baseline and return a severity, confidence, and explainable reasons array.",
    { resident_id: z.string() },
    async () => textResult(handlers.getBehaviorDeviation(state))
  );

  server.tool(
    "get_schedule_context",
    "Get resident's daily calendar and schedule context (requires consent).",
    { resident_id: z.string() },
    async () => textResult(handlers.getScheduleContext(state))
  );

  server.tool(
    "get_last_checkin",
    "Get the status of the most recent resident check-in across voice and screen channels.",
    { resident_id: z.string() },
    async () => textResult(handlers.getLastCheckin(state))
  );

  // request_checkin is an MCP App tool: calling it surfaces the
  // check-in UI (ui://homeguard/checkin) in any MCP Apps-capable host
  // (Claude, the ext-apps basic-host, and eventually the Fire TV app).
  registerAppTool(
    server,
    "request_checkin",
    {
      title: "Request Check-in",
      description:
        "Initiate a resident check-in (surfaces the Fire TV check-in UI). Call this when get_behavior_deviation indicates more information is needed.",
      inputSchema: { resident_id: z.string(), reason: z.string() },
      _meta: { ui: { resourceUri: CHECKIN_RESOURCE_URI } },
    },
    async ({ reason }) => textResult(handlers.requestCheckin(state, reason))
  );

  // Called BY the check-in UI when the resident presses a button or speaks via Alexa.
  server.tool(
    "respond_checkin",
    "Record the resident's response to a check-in (called by check-in UI or Alexa voice channel).",
    {
      response: z.enum(["ok", "on_my_way", "need_help"]),
      via: z.enum(["alexa_voice", "firetv_remote", "firetv_voice"]).optional(),
    },
    async ({ response, via }) => textResult(handlers.respondToCheckin(state, response, via))
  );

  server.tool(
    "get_ring_event",
    "Retrieve Ring doorbell events and gated snapshots (server-enforced gate).",
    {
      resident_id: z.string(),
      include_media: z.boolean().default(false),
      reason: z.string().default(""),
    },
    async ({ include_media, reason }) =>
      textResult(handlers.getRingEvent(state, include_media, reason))
  );

  server.tool(
    "notify_caregiver",
    "Escalate to the caregiver. Only call this after a check-in was attempted and came back unanswered, or the resident explicitly requested help.",
    {
      resident_id: z.string(),
      severity: z.string(),
      reason: z.string(),
      incident_id: z.string().optional(),
    },
    async ({ severity, reason, incident_id }) =>
      textResult(handlers.notifyCaregiver(state, severity, reason, incident_id))
  );

  // Demo-only: simulate the check-in timing out unanswered
  server.tool(
    "demo_timeout_checkin",
    "[DEMO ONLY] Simulate a pending check-in timing out unanswered.",
    { channel: z.enum(["voice", "screen", "both"]).optional() },
    async ({ channel }) => textResult(handlers.timeoutCheckin(state, channel ?? "both"))
  );


  // Serves the bundled check-in UI HTML. Run `npm run build:ui` first.
  registerAppResource(
    server,
    CHECKIN_RESOURCE_URI,
    CHECKIN_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(
        path.join(import.meta.dirname, "..", "ui-dist", "ui", "mcp-app.html"),
        "utf-8"
      );
      return {
        contents: [
          { uri: CHECKIN_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    }
  );

  return server;
}

