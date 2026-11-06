import { act, cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import type * as Zustand from "zustand";

const storeResets = vi.hoisted(() => new Set<() => void>());

// Stores live at module level, so each goes back to its initial state after every test.
vi.mock("zustand", async (importOriginal) => {
    const actual = await importOriginal<typeof Zustand>();
    const track = <T>(store: Zustand.UseBoundStore<Zustand.StoreApi<T>>) => {
        const initial = store.getInitialState();
        storeResets.add(() => store.setState(initial, true));
        return store;
    };
    const create = (<T>(creator?: Zustand.StateCreator<T>) =>
        creator
            ? track(actual.create(creator))
            : (later: Zustand.StateCreator<T>) =>
                  track(actual.create(later))) as typeof Zustand.create;
    return { ...actual, create };
});

// jsdom lacks what Mantine measures and positions with.
window.matchMedia ??= (query: string) =>
    ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
    }) as MediaQueryList;

const ignore = () => undefined;

globalThis.ResizeObserver ??= class {
    observe = ignore;
    unobserve = ignore;
    disconnect = ignore;
};

// An autosizing Textarea listens for fonts loading.
if (!("fonts" in document)) {
    Object.assign(document, {
        fonts: { addEventListener: ignore, removeEventListener: ignore }
    });
}

if (!("scrollIntoView" in Element.prototype)) {
    Object.assign(Element.prototype, { scrollIntoView: ignore });
}

afterEach(() => {
    cleanup();
    act(() => storeResets.forEach((reset) => reset()));
    window.localStorage.clear();
    window.sessionStorage.clear();
});
