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

    // The split moved a field out of the local blob and added three more, which
    // the stored shape tolerates: nobody's theme or filters reset over it.
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
