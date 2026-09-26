import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { createPersistedStore } from "./persisted-store";

/** A Storage the tests can read back, and break on demand. */
function fakeStorage() {
    const entries = new Map<string, string>();
    return {
        failing: false,
        get length() {
            return entries.size;
        },
        key: (index: number) => [...entries.keys()][index] ?? null,
        clear: () => entries.clear(),
        getItem(key: string): string | null {
            if (this.failing) throw new Error("storage is blocked");
            return entries.get(key) ?? null;
        },
        setItem(key: string, value: string): void {
            if (this.failing) throw new Error("storage is blocked");
            entries.set(key, value);
        },
        removeItem: (key: string) => void entries.delete(key)
    };
}

let storage: ReturnType<typeof fakeStorage>;

const Schema = z.object({
    query: z.string().catch(""),
    open: z.boolean().catch(true)
});

const createStore = () =>
    createPersistedStore(Schema, "state", () => storage as Storage);

const stored = (): unknown => JSON.parse(storage.getItem("state") ?? "null");

beforeEach(() => {
    storage = fakeStorage();
});

describe("createPersistedStore", () => {
    it("starts from what is stored, and stores each change", () => {
        storage.setItem("state", JSON.stringify({ query: "gear" }));
        const store = createStore();

        expect(store.getState()).toEqual({ query: "gear", open: true });
        store.setState({ open: false });
        expect(stored()).toEqual({ query: "gear", open: false });
    });

    it("defaults a field it can't use without losing the rest", () => {
        storage.setItem(
            "state",
            JSON.stringify({ query: "gear", open: "yes", retired: 1 })
        );
        expect(createStore().getState()).toEqual({ query: "gear", open: true });
    });

    it("falls back to the defaults for what it cannot read", () => {
        storage.setItem("state", "{ not json");
        expect(createStore().getState()).toEqual({ query: "", open: true });
    });

    it("serves the session from memory when storage is blocked", () => {
        storage.failing = true;
        const store = createStore();

        expect(() => store.setState({ query: "gear" })).not.toThrow();
        expect(store.getState().query).toBe("gear");
    });
});

describe("the stored ui state", () => {
    // The "system" theme is gone; the tab someone picked shouldn't go with it.
    it("defaults a retired theme to dark and keeps the tab", async () => {
        storage.setItem(
            "uiState",
            JSON.stringify({ theme: "system", tabId: "ftc-design-lib" })
        );
        vi.stubGlobal("window", { localStorage: storage });
        vi.resetModules();
        const { getUiState, Theme } = await import("./ui-state");

        expect(getUiState()).toMatchObject({
            theme: Theme.DARK,
            tabId: "ftc-design-lib"
        });
        vi.unstubAllGlobals();
    });
});
