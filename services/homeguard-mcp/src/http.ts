import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createHomeguardServer } from "./server.js";
import { demoState, createInitialState } from "./demoState.js";
import * as handlers from "./toolHandlers.js";
import {
  addCaregiverListener,
  publishCaregiverEvent,
  getCaregiverListenerCount,
} from "./eventBus.js";


export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    // SECURITY: a fresh McpServer + StreamableHTTPServerTransport is
    // created for EVERY request and discarded after. Do not hoist
    // these outside the handler — reusing either across requests is
    // exactly the CVE-2026-25536 cross-client data leak (fixed in SDK
    // >=1.26.0, which now throws if you try to reuse a transport).
    // The `demoState` domain object is fine to share; it's app state,
    // not protocol state.
    const server = createHomeguardServer(demoState);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Caregiver Phone Endpoints (§13)
  app.get("/caregiver/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    const listener = (event: { type: string; data: unknown }) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    };
    const unsubscribe = addCaregiverListener(listener);

    // Initial greeting / state on connect
    const status = handlers.getBehaviorStatus(demoState);
    res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);

    req.on("close", () => {
      unsubscribe();
    });
  });


  app.get("/caregiver/briefing", (_req, res) => {
    const status = handlers.getBehaviorStatus(demoState);
    res.json({
      date: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      status: status.status,
      confidence: status.confidence,
      summary: status.summary,
      handledQuietly: [
        { t: "08:10", note: "Alexa morning routine completed normally" },
        { t: "10:16", note: "Soft voice check-in answered ('I am fine, just resting')" },
      ],
    });
  });

  // Human actions are HTTP endpoints, NOT agent tools (§3b)
  app.post("/caregiver/incidents/:id/acknowledge", (req, res) => {
    const result = handlers.acknowledgeIncident(demoState);
    publishCaregiverEvent("acknowledged", {
      incidentId: req.params.id,
      timestamp: result.timestamp,
    });
    res.json({ success: true, ...result });
  });

  // Scenario Loader API (for Dashboard & Video Pitch)
  app.post("/scenario/load", (req, res) => {
    const scenario = req.body?.scenario as "A" | "B" | "C1" | "C1_NO_DEP" | "C2" | "RESET";

    // Reset to base
    Object.assign(demoState, createInitialState());

    if (scenario === "A") {
      // Scenario A: "Quiet afternoon" (harmless)
      demoState.departureDetected = false;
      demoState.returnDetected = false;
      demoState.alexaActive = false; // no Alexa 3h
      demoState.fireTvActive = true;  // Fire TV playing
      demoState.wearableActive = true; // Bee moving
    } else if (scenario === "B") {
      // Scenario B: "Sudden stop" (incident)
      demoState.departureDetected = false;
      demoState.returnDetected = false;
      demoState.alexaActive = false;
      demoState.fireTvActive = false;
      demoState.wearableActive = false;
      demoState.suddenInactivity = true;
    } else if (scenario === "C1") {
      // Scenario C1: "Quiet Tuesday" (explained by calendar)
      demoState.departureDetected = true;
      demoState.departureTimestamp = new Date(Date.now() - 75 * 60_000).toISOString();
      demoState.returnDetected = false;
      demoState.schedule = {
        hasAppointmentAway: true,
        appointmentTitle: "Physiotherapy",
        isWithinWindow: true,
        departureCorroborated: true,
      };
    } else if (scenario === "C1_NO_DEP") {
      // Scenario C1 Variant: appointment away but NO departure observed
      demoState.departureDetected = false;
      demoState.returnDetected = false;
      demoState.morningInactivity = true;
      demoState.schedule = {
        hasAppointmentAway: true,
        appointmentTitle: "Physiotherapy",
        isWithinWindow: true,
        departureCorroborated: false,
      };
    } else if (scenario === "C2") {
      // Scenario C2: "Silent Thursday"
      demoState.departureDetected = false;
      demoState.returnDetected = false;
      demoState.alexaActive = false;
      demoState.fireTvActive = false;
      demoState.morningInactivity = true;
    }

    const currentStatus = handlers.getBehaviorStatus(demoState);
    publishCaregiverEvent("scenario_loaded", {
      scenario,
      status: currentStatus,
      nextAction: handlers.computeNextAction(demoState),
    });

    res.json({
      success: true,
      scenario,
      status: currentStatus,
      nextAction: handlers.computeNextAction(demoState),
    });
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      mode: "REAL MCP (official SDK, Streamable HTTP)",
      caregiverSseClients: getCaregiverListenerCount(),
    });
  });


  return app;
}

