import { describe, it, expect, vi, beforeEach } from "vitest";
import { TvRemoteController } from "./tvRemote.js";

describe("TvRemoteController", () => {
  let controller: TvRemoteController;

  beforeEach(() => {
    controller = new TvRemoteController();
  });

  describe("Key Mapping", () => {
    it("maps standard keyboard arrow keys to TV D-pad keys", () => {
      expect(controller.mapKey({ key: "ArrowUp" } as KeyboardEvent)).toBe("up");
      expect(controller.mapKey({ key: "ArrowDown" } as KeyboardEvent)).toBe("down");
      expect(controller.mapKey({ key: "ArrowLeft" } as KeyboardEvent)).toBe("left");
      expect(controller.mapKey({ key: "ArrowRight" } as KeyboardEvent)).toBe("right");
    });

    it("maps Enter and Space to select", () => {
      expect(controller.mapKey({ key: "Enter" } as KeyboardEvent)).toBe("select");
      expect(controller.mapKey({ key: " " } as KeyboardEvent)).toBe("select");
    });

    it("maps Escape, Backspace, GoBack to back", () => {
      expect(controller.mapKey({ key: "Escape" } as KeyboardEvent)).toBe("back");
      expect(controller.mapKey({ key: "Backspace" } as KeyboardEvent)).toBe("back");
      expect(controller.mapKey({ key: "GoBack" } as KeyboardEvent)).toBe("back");
    });

    it("maps Home and Menu keys", () => {
      expect(controller.mapKey({ key: "Home" } as KeyboardEvent)).toBe("home");
      expect(controller.mapKey({ key: "Menu" } as KeyboardEvent)).toBe("menu");
      expect(controller.mapKey({ key: "ContextMenu" } as KeyboardEvent)).toBe("menu");
    });

    it("maps TV-specific numeric keycodes as fallback", () => {
      expect(controller.mapKey({ key: "Unidentified", keyCode: 38 } as any)).toBe("up");
      expect(controller.mapKey({ key: "Unidentified", keyCode: 40 } as any)).toBe("down");
      expect(controller.mapKey({ key: "Unidentified", keyCode: 37 } as any)).toBe("left");
      expect(controller.mapKey({ key: "Unidentified", keyCode: 39 } as any)).toBe("right");
      expect(controller.mapKey({ key: "Unidentified", keyCode: 13 } as any)).toBe("select");
      expect(controller.mapKey({ key: "Unidentified", keyCode: 461 } as any)).toBe("back");
    });

    it("returns null for non-TV keys", () => {
      expect(controller.mapKey({ key: "a" } as KeyboardEvent)).toBeNull();
      expect(controller.mapKey({ key: "Shift" } as KeyboardEvent)).toBeNull();
    });
  });

  describe("Listener notification", () => {
    it("notifies listeners when a key is sent", () => {
      const listener = vi.fn();
      const unsubscribe = controller.addListener(listener);

      controller.sendKey("down");
      expect(listener).toHaveBeenCalledWith("down");

      controller.sendKey("select");
      expect(listener).toHaveBeenCalledWith("select");

      unsubscribe();
      controller.sendKey("up");
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe("D-pad navigation on buttons", () => {
    it("navigates down and up between buttons in iframe document", () => {
      const btn1 = {
        focus: vi.fn(),
        click: vi.fn(),
        classList: { contains: () => false },
        offsetParent: {},
      };
      const btn2 = {
        focus: vi.fn(),
        click: vi.fn(),
        classList: { contains: () => false },
        offsetParent: {},
      };
      const btn3 = {
        focus: vi.fn(),
        click: vi.fn(),
        classList: { contains: () => false },
        offsetParent: {},
      };

      const mockIframe = {
        contentDocument: {
          querySelectorAll: vi.fn().mockReturnValue([btn1, btn2, btn3]),
          activeElement: btn1,
        },
      } as any;

      controller.setIframe(mockIframe);

      controller.sendKey("down");
      expect(btn2.focus).toHaveBeenCalled();

      mockIframe.contentDocument.activeElement = btn2;
      controller.sendKey("down");
      expect(btn3.focus).toHaveBeenCalled();

      mockIframe.contentDocument.activeElement = btn3;
      controller.sendKey("up");
      expect(btn2.focus).toHaveBeenCalledTimes(2);
    });

    it("clicks active button on select", () => {
      const btn = {
        focus: vi.fn(),
        click: vi.fn(),
        classList: { contains: () => false },
        offsetParent: {},
      };

      const mockIframe = {
        contentDocument: {
          querySelectorAll: vi.fn().mockReturnValue([btn]),
          activeElement: btn,
        },
      } as any;

      controller.setIframe(mockIframe);
      controller.sendKey("select");
      expect(btn.click).toHaveBeenCalled();
    });
  });
});
