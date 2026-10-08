import { describe, it, expect, vi, beforeEach } from "vitest";
import { TvRemoteController } from "./tvRemote.js";
describe("TvRemoteController", () => {
    let controller;
    beforeEach(() => {
        controller = new TvRemoteController();
    });
    describe("Key Mapping", () => {
        it("maps standard keyboard arrow keys to TV D-pad keys", () => {
            expect(controller.mapKey({ key: "ArrowUp" })).toBe("up");
            expect(controller.mapKey({ key: "ArrowDown" })).toBe("down");
            expect(controller.mapKey({ key: "ArrowLeft" })).toBe("left");
            expect(controller.mapKey({ key: "ArrowRight" })).toBe("right");
        });
        it("maps Enter and Space to select", () => {
            expect(controller.mapKey({ key: "Enter" })).toBe("select");
            expect(controller.mapKey({ key: " " })).toBe("select");
        });
        it("maps Escape, Backspace, GoBack to back", () => {
            expect(controller.mapKey({ key: "Escape" })).toBe("back");
            expect(controller.mapKey({ key: "Backspace" })).toBe("back");
            expect(controller.mapKey({ key: "GoBack" })).toBe("back");
        });
        it("maps Home and Menu keys", () => {
            expect(controller.mapKey({ key: "Home" })).toBe("home");
            expect(controller.mapKey({ key: "Menu" })).toBe("menu");
            expect(controller.mapKey({ key: "ContextMenu" })).toBe("menu");
        });
        it("maps TV-specific numeric keycodes as fallback", () => {
            expect(controller.mapKey({ key: "Unidentified", keyCode: 38 })).toBe("up");
            expect(controller.mapKey({ key: "Unidentified", keyCode: 40 })).toBe("down");
            expect(controller.mapKey({ key: "Unidentified", keyCode: 37 })).toBe("left");
            expect(controller.mapKey({ key: "Unidentified", keyCode: 39 })).toBe("right");
            expect(controller.mapKey({ key: "Unidentified", keyCode: 13 })).toBe("select");
            expect(controller.mapKey({ key: "Unidentified", keyCode: 461 })).toBe("back");
        });
        it("returns null for non-TV keys", () => {
            expect(controller.mapKey({ key: "a" })).toBeNull();
            expect(controller.mapKey({ key: "Shift" })).toBeNull();
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
            };
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
            };
            controller.setIframe(mockIframe);
            controller.sendKey("select");
            expect(btn.click).toHaveBeenCalled();
        });
    });
});
