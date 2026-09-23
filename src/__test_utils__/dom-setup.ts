import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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

if (!("scrollIntoView" in Element.prototype)) {
    Object.assign(Element.prototype, { scrollIntoView: ignore });
}

afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
});
