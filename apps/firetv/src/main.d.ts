/**
 * main.ts — HOMEGUARD Fire TV App Shell
 *
 * Implements the 10-foot TV state machine:
 * - Ambient / Idle Screen
 * - Check-in Overlay Screen with embedded MCP Apps Host
 * - Interactive Fire TV Remote Simulator & D-pad Controller
 */
export declare function showCheckinScreen(reason?: string): Promise<void>;
export declare function hideCheckinScreen(): void;
