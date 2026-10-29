import { describe, expect, it } from "vitest";
import { DEFAULT_ONSHAPE_ORIGIN, makeUrl, toOnshapeOrigin } from "./url";

describe("makeUrl", () => {
    const element = {
        documentId: "doc",
        instanceId: "ws",
        instanceType: "w",
        elementId: "el"
    } as const;

    it("addresses a document, an instance and an element in turn", () => {
        expect(makeUrl(DEFAULT_ONSHAPE_ORIGIN, { documentId: "doc" })).toBe(
            "https://cad.onshape.com/documents/doc"
        );
        expect(makeUrl(DEFAULT_ONSHAPE_ORIGIN, element)).toBe(
            "https://cad.onshape.com/documents/doc/w/ws/e/el"
        );
    });

    // Escaped twice, `0.381 m` would reach Onshape as `0.381%20m`.
    it("escapes a configuration once", () => {
        const url = makeUrl(DEFAULT_ONSHAPE_ORIGIN, element, {
            Effective_Length: "0.381 m",
            List_7A7: "Hex"
        });

        expect(url).toBe(
            "https://cad.onshape.com/documents/doc/w/ws/e/el" +
                "?configuration=Effective_Length%3D0.381%20m%3BList_7A7%3DHex"
        );
        expect(decodeURIComponent(url)).toContain(
            "configuration=Effective_Length=0.381 m"
        );
    });
});

describe("toOnshapeOrigin", () => {
    it("keeps a company's own Onshape", () => {
        expect(toOnshapeOrigin("https://frcdesign.onshape.com")).toBe(
            "https://frcdesign.onshape.com"
        );
        expect(toOnshapeOrigin("https://frcdesign.onshape.com/")).toBe(
            "https://frcdesign.onshape.com"
        );
    });

    // The launch is a url anyone can write, and these links open as Onshape's.
    it.each([
        undefined,
        "",
        "not a url",
        "http://frcdesign.onshape.com",
        "https://onshape.com.example.com",
        "https://evilonshape.com"
    ])("falls back to cad for %s", (server) => {
        expect(toOnshapeOrigin(server)).toBe(DEFAULT_ONSHAPE_ORIGIN);
    });
});
