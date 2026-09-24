import { beforeEach, describe, expect, it, vi } from "vitest";
import { Theme } from "@backend/features/settings/settings";

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
    it("writes a field to the store its scope names", async () => {
        const { updateUiState } = await loadUiState();

        updateUiState({ searchQuery: "gear", justSignedIn: true });

        expect(stored(local, "uiState").searchQuery).toBe("gear");
        expect(stored(session, "uiSessionState").justSignedIn).toBe(true);
        // Neither store holds the other's fields, whatever it was written with.
        expect(stored(local, "uiState")).not.toHaveProperty("justSignedIn");
        expect(stored(session, "uiSessionState")).not.toHaveProperty(
            "searchQuery"
        );
    });

    it("reads both stores back as one state", async () => {
        local.setItem(
            "uiState",
            JSON.stringify({ version: 4, searchQuery: "gear" })
        );
        session.setItem(
            "uiSessionState",
            JSON.stringify({ version: 4, justSignedIn: true })
        );
        const { getUiState } = await loadUiState();

        expect(getUiState()).toMatchObject({
            searchQuery: "gear",
            justSignedIn: true
        });
    });

    it("keeps what a store written before the split holds", async () => {
        local.setItem(
            "uiState",
            JSON.stringify({
                version: 4,
                theme: "dark",
                searchQuery: "bearing",
                justSignedIn: true
            })
        );
        const { getUiState } = await loadUiState();

        expect(getUiState()).toMatchObject({
            theme: "dark",
            searchQuery: "bearing"
        });
        // Session fields are the session store's, wherever they were found.
        expect(getUiState().justSignedIn).toBe(false);
    });

    it("falls back to the defaults for a store it cannot use", async () => {
        local.setItem("uiState", "{ not json");
        const { getUiState } = await loadUiState();

        expect(getUiState().searchQuery).toBe("");
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

describe("synced fields", () => {
    it("sends a changed field to the caller's row, and stores it too", async () => {
        const { setSettingsSync, updateUiState } = await loadUiState();
        const sent: unknown[] = [];
        setSettingsSync((settings) => sent.push(settings));

        updateUiState({ theme: Theme.DARK });

        expect(sent).toEqual([{ theme: "dark" }]);
        expect(stored(local, "uiState").theme).toBe("dark");
    });

    it("sends nothing for a field that did not move", async () => {
        const { setSettingsSync, updateUiState } = await loadUiState();
        updateUiState({ groupId: "group-1" });
        const sent: unknown[] = [];
        setSettingsSync((settings) => sent.push(settings));

        updateUiState({ groupId: "group-1" });

        expect(sent).toEqual([]);
    });

    it("sends only the synced fields the update moved", async () => {
        const { setSettingsSync, updateUiState } = await loadUiState();
        const sent: unknown[] = [];
        setSettingsSync((settings) => sent.push(settings));

        updateUiState({ theme: Theme.DARK, searchQuery: "gear" });

        expect(sent).toEqual([{ theme: "dark" }]);
    });

    it("sends nothing back for a value the row is what seeded", async () => {
        const { setSettingsSync, updateUiState } = await loadUiState();
        const sent: unknown[] = [];
        setSettingsSync((settings) => sent.push(settings));

        updateUiState({ theme: Theme.DARK }, { sync: false });

        expect(sent).toEqual([]);
        // Stored all the same: the store is still what the app reads.
        expect(stored(local, "uiState").theme).toBe("dark");
    });
});
