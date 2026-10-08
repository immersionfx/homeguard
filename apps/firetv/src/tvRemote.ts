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

export type TvRemoteKey =
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "back"
  | "home"
  | "menu";

export interface TvRemoteListener {
  (key: TvRemoteKey): void;
}

export class TvRemoteController {
  private listeners: Set<TvRemoteListener> = new Set();
  private iframe: HTMLIFrameElement | null = null;
  private isListening = false;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public setIframe(iframe: HTMLIFrameElement | null): void {
    this.iframe = iframe;
  }

  public addListener(listener: TvRemoteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public start(): void {
    if (this.isListening) return;
    window.addEventListener("keydown", this.handleKeyDown);
    this.isListening = true;
  }

  public stop(): void {
    if (!this.isListening) return;
    window.removeEventListener("keydown", this.handleKeyDown);
    this.isListening = false;
  }

  /**
   * Dispatch a key event directly (used by the virtual Fire TV remote simulator).
   */
  public sendKey(key: TvRemoteKey): void {
    this.notifyListeners(key);
    this.handleRemoteAction(key);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = this.mapKey(event);
    if (!key) return;

    // Prevent default browser scrolling on TV navigation keys
    if (["up", "down", "left", "right", "select"].includes(key)) {
      event.preventDefault();
    }

    this.sendKey(key);
  }

  public mapKey(event: KeyboardEvent): TvRemoteKey | null {
    switch (event.key) {
      case "ArrowUp":
      case "Up":
        return "up";
      case "ArrowDown":
      case "Down":
        return "down";
      case "ArrowLeft":
      case "Left":
        return "left";
      case "ArrowRight":
      case "Right":
        return "right";
      case "Enter":
      case " ":
        return "select";
      case "Escape":
      case "Backspace":
      case "GoBack":
        return "back";
      case "Home":
        return "home";
      case "ContextMenu":
      case "Menu":
        return "menu";
      default:
        // Handle TV-specific keycodes if event.key is generic
        if (event.keyCode === 38) return "up";
        if (event.keyCode === 40) return "down";
        if (event.keyCode === 37) return "left";
        if (event.keyCode === 39) return "right";
        if (event.keyCode === 13) return "select";
        if (event.keyCode === 27 || event.keyCode === 8 || event.keyCode === 461) return "back";
        return null;
    }
  }

  private notifyListeners(key: TvRemoteKey): void {
    for (const listener of this.listeners) {
      try {
        listener(key);
      } catch (err) {
        console.error("TvRemoteListener error:", err);
      }
    }
  }

  /**
   * Dispatches D-pad navigation into the embedded check-in iframe.
   */
  private handleRemoteAction(key: TvRemoteKey): void {
    if (!this.iframe) return;

    try {
      const doc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
      if (!doc) return;

      const buttons = Array.from(
        doc.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
      ).filter((b) => !b.classList.contains("hidden") && b.offsetParent !== null);

      if (buttons.length === 0) return;

      const active = doc.activeElement as HTMLElement | null;
      let currentIndex = buttons.findIndex((b) => b === active);

      if (key === "down" || key === "right") {
        const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, buttons.length - 1);
        buttons[nextIndex]?.focus();
      } else if (key === "up" || key === "left") {
        const prevIndex = currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0);
        buttons[prevIndex]?.focus();
      } else if (key === "select") {
        if (active && buttons.includes(active as HTMLButtonElement)) {
          (active as HTMLButtonElement).click();
        } else if (buttons[0]) {
          buttons[0].focus();
          buttons[0].click();
        }
      }
    } catch {
      // Cross-origin fallback: post message if iframe is isolated
      this.iframe.contentWindow?.postMessage({ type: "TV_KEY", key }, "*");
    }
  }
}
