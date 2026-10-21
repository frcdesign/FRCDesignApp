import { describe, expect, it } from "vitest";
import {
    parseOnshapeDocumentId,
    parseOnshapeUrl,
    parseOnshapeWorkspace
} from "./onshape-url";

const DOCUMENT = "https://cad.onshape.com/documents/abc123";
const WORKSPACE = `${DOCUMENT}/w/ws456`;
const TAB = `${WORKSPACE}/e/el789`;

describe("parseOnshapeUrl", () => {
    it("reads a link to a document", () => {
        expect(parseOnshapeUrl(DOCUMENT)).toEqual({ documentId: "abc123" });
    });

    it("reads the instance and the tab when the url carries them", () => {
        expect(parseOnshapeUrl(TAB)).toEqual({
            documentId: "abc123",
            instanceType: "w",
            instanceId: "ws456",
            elementId: "el789"
        });
    });

    it("reads a version and a microversion as well as a workspace", () => {
        expect(parseOnshapeUrl(`${DOCUMENT}/v/v1`)?.instanceType).toBe("v");
        expect(parseOnshapeUrl(`${DOCUMENT}/m/m1`)?.instanceType).toBe("m");
    });

    it("keeps whatever follows the document out of the way", () => {
        // Onshape hangs a configuration and a selection off the same url.
        expect(parseOnshapeUrl(`${TAB}?configuration=size%3D2`)).toEqual({
            documentId: "abc123",
            instanceType: "w",
            instanceId: "ws456",
            elementId: "el789"
        });
    });

    it("drops a half-written instance rather than half-reading it", () => {
        expect(parseOnshapeUrl(`${DOCUMENT}/w`)).toEqual({
            documentId: "abc123"
        });
        // Not an instance type Onshape uses, so the document is all it names.
        expect(parseOnshapeUrl(`${DOCUMENT}/x/whatever`)).toEqual({
            documentId: "abc123"
        });
    });

    it("answers nothing for a url that names no document", () => {
        expect(parseOnshapeUrl("https://cad.onshape.com/")).toBeUndefined();
        expect(
            parseOnshapeUrl("https://cad.onshape.com/documents")
        ).toBeUndefined();
        expect(parseOnshapeUrl("not a url at all")).toBeUndefined();
        expect(parseOnshapeUrl("")).toBeUndefined();
    });
});

describe("parseOnshapeDocumentId", () => {
    it("takes the document from any of its urls", () => {
        expect(parseOnshapeDocumentId(DOCUMENT)).toBe("abc123");
        expect(parseOnshapeDocumentId(TAB)).toBe("abc123");
    });
});

describe("parseOnshapeWorkspace", () => {
    it("takes a workspace, tab and all", () => {
        expect(parseOnshapeWorkspace(TAB)).toEqual({
            documentId: "abc123",
            instanceId: "ws456",
            instanceType: "w"
        });
    });

    it("refuses what cannot be written to", () => {
        expect(parseOnshapeWorkspace(`${DOCUMENT}/v/v1`)).toBeUndefined();
        expect(parseOnshapeWorkspace(`${DOCUMENT}/m/m1`)).toBeUndefined();
        // A document alone: resolving it to the default workspace would pick a
        // different one than whoever copied the link was looking at.
        expect(parseOnshapeWorkspace(DOCUMENT)).toBeUndefined();
    });
});
