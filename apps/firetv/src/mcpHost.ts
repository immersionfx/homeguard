/**
 * mcpHost.ts — Embedded MCP Apps Host for Fire TV
 *
 * Connects to the HOMEGUARD MCP server over Streamable HTTP (/mcp),
 * fetches the 10-foot check-in UI resource (ui://homeguard/checkin),
 * and establishes the AppBridge for real two-way tool communication.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  AppBridge,
  PostMessageTransport,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/app-bridge";

export interface McpHostConfig {
  serverUrl: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface CheckinState {
  status: "idle" | "active" | "completed";
  residentId?: string;
  reason?: string;
  response?: string | null;
}

export class FireTvMcpHost {
  private client: Client | null = null;
  private appBridge: AppBridge | null = null;
  private serverUrl: string;
  private cachedHtml: string | null = null;
  private status: ConnectionStatus = "disconnected";
  private onStatusChangeCallbacks: Set<(status: ConnectionStatus) => void> = new Set();
  private onCheckinCompleteCallbacks: Set<(response: string) => void> = new Set();

  constructor(config: McpHostConfig = { serverUrl: "http://localhost:3000/mcp" }) {
    this.serverUrl = config.serverUrl;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public onStatusChange(cb: (status: ConnectionStatus) => void): () => void {
    this.onStatusChangeCallbacks.add(cb);
    return () => this.onStatusChangeCallbacks.delete(cb);
  }

  public onCheckinComplete(cb: (response: string) => void): () => void {
    this.onCheckinCompleteCallbacks.add(cb);
    return () => this.onCheckinCompleteCallbacks.delete(cb);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const cb of this.onStatusChangeCallbacks) {
      cb(status);
    }
  }

  /**
   * Connect to HOMEGUARD MCP server.
   */
  public async connect(): Promise<boolean> {
    this.setStatus("connecting");
    try {
      this.client = new Client({
        name: "Fire TV Shell",
        version: "0.1.0",
      });

      const transport = new StreamableHTTPClientTransport(new URL(this.serverUrl));
      await this.client.connect(transport);
      this.setStatus("connected");
      return true;
    } catch (err) {
      console.error("FireTvMcpHost connection error:", err);
      this.setStatus("error");
      return false;
    }
  }

  /**
   * Fetch the 10-foot check-in HTML from the MCP server's App Resource.
   */
  public async getCheckinHtml(): Promise<string> {
    if (this.cachedHtml) return this.cachedHtml;

    if (!this.client || this.status !== "connected") {
      const ok = await this.connect();
      if (!ok || !this.client) {
        throw new Error("Unable to connect to MCP server at " + this.serverUrl);
      }
    }

    const resource = await this.client.readResource({ uri: "ui://homeguard/checkin" });
    if (!resource || !resource.contents || resource.contents.length === 0) {
      throw new Error("Resource ui://homeguard/checkin not found on server");
    }

    const content = resource.contents[0];
    if (content.mimeType !== RESOURCE_MIME_TYPE) {
      throw new Error(`Unexpected MIME type: ${content.mimeType}`);
    }

    const html = "blob" in content ? atob(content.blob as string) : (content.text as string);
    this.cachedHtml = html;
    return html;
  }

  /**
   * Mount and bind the MCP App inside the Fire TV check-in iframe.
   */
  public async attachIframe(
    iframe: HTMLIFrameElement,
    initialData: { resident_id?: string; reason?: string } = {}
  ): Promise<AppBridge> {
    if (!this.client) {
      await this.connect();
    }
    if (!this.client) {
      throw new Error("MCP Client not connected");
    }

    const serverCaps = this.client.getServerCapabilities();

    // Instantiate AppBridge per ext-apps specification
    const appBridge = new AppBridge(
      this.client,
      { name: "Fire TV Host", version: "0.1.0" },
      {
        serverTools: serverCaps?.tools,
        serverResources: serverCaps?.resources,
        updateModelContext: { text: {} },
      },
      {
        hostContext: {
          theme: "dark",
          platform: "web",
          displayMode: "fullscreen",
          containerDimensions: { width: 1920, maxHeight: 1080 },
          availableDisplayModes: ["fullscreen"],
        },
      }
    );

    this.appBridge = appBridge;

    // Connect bridge via postMessage to iframe window
    await appBridge.connect(
      new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!)
    );

    // Feed initial tool result so the check-in UI transitions from "Loading..." to the questions
    appBridge.sendToolResult({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "pending",
            resident_id: initialData.resident_id ?? "maria",
            reason: initialData.reason ?? "Evening departure window elapsed without return.",
          }),
        },
      ],
    });

    // Listen to respond_checkin invocations to notify the TV shell
    const origCallTool = this.client.callTool.bind(this.client);
    this.client.callTool = async (params, resultSchema, options) => {
      const result = await origCallTool(params, resultSchema, options);
      if (params.name === "respond_checkin") {
        const resp = (params.arguments as any)?.response as string;
        for (const cb of this.onCheckinCompleteCallbacks) {
          cb(resp);
        }
      }
      return result;
    };

    return appBridge;
  }

  /**
   * Call request_checkin on the MCP server.
   */
  public async requestCheckin(residentId = "maria", reason = "Evening routine deviation"): Promise<unknown> {
    if (!this.client) {
      await this.connect();
    }
    if (!this.client) {
      throw new Error("MCP Client not connected");
    }
    return this.client.callTool({
      name: "request_checkin",
      arguments: { resident_id: residentId, reason },
    });
  }

  /**
   * Get the last check-in status from the MCP server.
   */
  public async getLastCheckin(): Promise<any> {
    if (!this.client) {
      await this.connect();
    }
    if (!this.client) {
      throw new Error("MCP Client not connected");
    }
    const res = await this.client.callTool({
      name: "get_last_checkin",
      arguments: { resident_id: "maria" },
    });
    const text = (res as any)?.content?.find((c: any) => c.type === "text")?.text;
    return text ? JSON.parse(text) : res;
  }
}
