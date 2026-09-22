import { describe, expect, it } from "vitest";
import { makeUrl } from "./url";

describe("makeUrl", () => {
    const element = {
        documentId: "doc",
        instanceId: "ws",
        instanceType: "w",
        elementId: "el"
    } as const;

    it("addresses a document, an instance and an element in turn", () => {
        expect(makeUrl({ documentId: "doc" })).toBe(
            "https://cad.onshape.com/documents/doc"
        );
        expect(makeUrl(element)).toBe(
            "https://cad.onshape.com/documents/doc/w/ws/e/el"
        );
    });

    // Once, by the url: a quantity that reaches Onshape as `%2520m` is the
    // value `0.381%20m`, which is no quantity.
    it("escapes a configuration once", () => {
        const url = makeUrl({
            ...element,
            selection: { Effective_Length: "0.381 m", List_7A7: "Hex" }
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
