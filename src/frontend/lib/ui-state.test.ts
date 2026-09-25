import { beforeEach, describe, expect, it, vi } from "vitest";

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

let local: ReturnType<typeof fakeStorage>;
let session: ReturnType<typeof fakeStorage>;

/** A fresh module, so the state it caches is read back from these stores. */
async function loadUiState() {
    vi.resetModules();
    return import("./ui-state");
}

const stored = (storage: Storage, key: string): Record<string, unknown> =>
    JSON.parse(storage.getItem(key) ?? "{}") as Record<string, unknown>;

beforeEach(() => {
    local = fakeStorage();
    session = fakeStorage();
    vi.stubGlobal("window", { localStorage: local, sessionStorage: session });
});

describe("ui state", () => {
    it("writes a field to the storage its scope names", async () => {
        const { updateUiState } = await loadUiState();

        updateUiState({ searchQuery: "gear", justSignedIn: true });

        expect(stored(local, "uiState").searchQuery).toBe("gear");
        expect(stored(session, "uiSessionState").justSignedIn).toBe(true);
        expect(stored(local, "uiState")).not.toHaveProperty("justSignedIn");
        expect(stored(session, "uiSessionState")).not.toHaveProperty(
            "searchQuery"
        );
    });

    it("reads both stores back as one state", async () => {
        local.setItem("uiState", JSON.stringify({ searchQuery: "gear" }));
        session.setItem(
            "uiSessionState",
            JSON.stringify({ justSignedIn: true })
        );
        const { getUiState } = await loadUiState();

        expect(getUiState()).toMatchObject({
            searchQuery: "gear",
            justSignedIn: true
        });
    });

    // The "system" theme is gone; the tab someone picked shouldn't go with it.
    it("defaults a field it can't use without losing the rest", async () => {
        local.setItem(
            "uiState",
            JSON.stringify({
                version: 4,
                theme: "system",
                tabId: "ftc-design-lib"
            })
        );
        const { getUiState, Theme } = await loadUiState();

        expect(getUiState()).toMatchObject({
            theme: Theme.DARK,
            tabId: "ftc-design-lib"
        });
    });

    it("falls back to the defaults for a store it cannot read", async () => {
        local.setItem("uiState", "{ not json");
        const { getUiState } = await loadUiState();

        expect(getUiState().searchQuery).toBe("");
        expect(getUiState().tabId).toBeUndefined();
    });

    it("leaves a store alone when the update names none of its fields", async () => {
        const { updateUiState } = await loadUiState();
        updateUiState({ justSignedIn: true });

        expect(session.getItem("uiSessionState")).not.toBeNull();
        expect(local.getItem("uiState")).toBeNull();
    });

    it("serves the session from memory when storage is blocked", async () => {
        local.failing = true;
        session.failing = true;
        const { getUiState, updateUiState } = await loadUiState();

        expect(() => updateUiState({ searchQuery: "gear" })).not.toThrow();
        expect(getUiState().searchQuery).toBe("gear");
    });
});
