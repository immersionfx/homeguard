/**
 * tvRemote.ts — Fire TV D-pad and Remote Control Navigation
 *
 * Implements Amazon Fire TV remote control key handling according to
 * the 10-foot TV navigation specification:
 * - D-pad Up / Down / Left / Right (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
 * - Select / Center Button (Enter, Space, keyCode 13)
 * - Back Button (Escape, Backspace, keyCode 27 / 8 / 461 / 10009)
 * - Menu Button (keyCode 82, ContextMenu)
 * - Home Button (keyCode 36)
 *
 * Bridges remote actions to the embedded MCP App check-in iframe.
 */
export type TvRemoteKey = "up" | "down" | "left" | "right" | "select" | "back" | "home" | "menu";
export interface TvRemoteListener {
    (key: TvRemoteKey): void;
}
export declare class TvRemoteController {
    private listeners;
    private iframe;
    private isListening;
    constructor();
    setIframe(iframe: HTMLIFrameElement | null): void;
    addListener(listener: TvRemoteListener): () => void;
    start(): void;
    stop(): void;
    /**
     * Dispatch a key event directly (used by the virtual Fire TV remote simulator).
     */
    sendKey(key: TvRemoteKey): void;
    private handleKeyDown;
    mapKey(event: KeyboardEvent): TvRemoteKey | null;
    private notifyListeners;
    /**
     * Dispatches D-pad navigation into the embedded check-in iframe.
     */
    private handleRemoteAction;
}
