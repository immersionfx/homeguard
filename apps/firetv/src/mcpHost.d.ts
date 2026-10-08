/**
 * mcpHost.ts — Embedded MCP Apps Host for Fire TV
 *
 * Connects to the HOMEGUARD MCP server over Streamable HTTP (/mcp),
 * fetches the 10-foot check-in UI resource (ui://homeguard/checkin),
 * and establishes the AppBridge for real two-way tool communication.
 */
import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
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
export declare class FireTvMcpHost {
    private client;
    private appBridge;
    private serverUrl;
    private cachedHtml;
    private status;
    private onStatusChangeCallbacks;
    private onCheckinCompleteCallbacks;
    constructor(config?: McpHostConfig);
    getStatus(): ConnectionStatus;
    onStatusChange(cb: (status: ConnectionStatus) => void): () => void;
    onCheckinComplete(cb: (response: string) => void): () => void;
    private setStatus;
    /**
     * Connect to HOMEGUARD MCP server.
     */
    connect(): Promise<boolean>;
    /**
     * Fetch the 10-foot check-in HTML from the MCP server's App Resource.
     */
    getCheckinHtml(): Promise<string>;
    /**
     * Mount and bind the MCP App inside the Fire TV check-in iframe.
     */
    attachIframe(iframe: HTMLIFrameElement, initialData?: {
        resident_id?: string;
        reason?: string;
    }): Promise<AppBridge>;
    /**
     * Call request_checkin on the MCP server.
     */
    requestCheckin(residentId?: string, reason?: string): Promise<unknown>;
    /**
     * Get the last check-in status from the MCP server.
     */
    getLastCheckin(): Promise<any>;
}
