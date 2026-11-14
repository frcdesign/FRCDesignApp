import { describe, expect, it } from "vitest";
import {
    type OnshapeDocumentContents,
    type OnshapeElement,
    type OnshapeElementGroup,
    type OnshapeFolderEntry,
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../../lib/onshape/types";
import {
    categoryOf,
    findExample,
    findManifestTab,
    MANIFEST_TAB_NAME,
    parseManifest
} from "./manifest";

const { FEATURE_STUDIO, PART_STUDIO, BLOB } = OnshapeElementType;

function tab(
    id: string,
    elementType: OnshapeElementType,
    name = id
): OnshapeElement {
    return { id, name, elementType, microversionId: `mv-${id}` };
}

function ref(elementId: string): OnshapeFolderEntry {
    return { btType: OnshapeFolderEntryType.ELEMENT, elementId };
}

function folder(
    groupName: string,
    ...entries: OnshapeFolderEntry[]
): OnshapeElementGroup {
    return { btType: OnshapeFolderEntryType.GROUP, groupName, groups: entries };
}

/** The tree from the tabs, in the order given, with folders as given. */
function contents(
    elements: OnshapeElement[],
    ...entries: OnshapeFolderEntry[]
): OnshapeDocumentContents {
    return {
        elements,
        folders: { btType: OnshapeFolderEntryType.GROUP, groups: entries }
    };
}

function exampleOf(
    document: OnshapeDocumentContents,
    studioId: string,
    name: string
): string | undefined {
    return findExample(document, studioId, name)?.id;
}

describe("findExample", () => {
    const extrude = tab("extrude", FEATURE_STUDIO, "multiExtrude.fs");
    const revolve = tab("revolve", FEATURE_STUDIO, "multiRevolve.fs");

    it("takes the Part Studio named for the feature, in any case", () => {
        const document = contents(
            [
                extrude,
                tab("other", PART_STUDIO),
                tab("ex", PART_STUDIO, "multi extrude")
            ],
            ref("extrude"),
            ref("other"),
            ref("ex")
        );
        expect(exampleOf(document, "extrude", "Multi Extrude")).toBe("ex");
    });

    it("shares the example after several features in their folder", () => {
        const document = contents(
            [extrude, revolve, tab("ex", PART_STUDIO, "Multi extrude")],
            folder(
                "Basic operations",
                ref("extrude"),
                ref("revolve"),
                ref("ex")
            )
        );
        expect(exampleOf(document, "extrude", "Multi extrude")).toBe("ex");
        expect(exampleOf(document, "revolve", "Multi revolve")).toBe("ex");
    });

    it("prefers a named Part Studio after the feature in its folder to one elsewhere", () => {
        const document = contents(
            [
                tab("early", PART_STUDIO, "Multi extrude"),
                extrude,
                tab("late", PART_STUDIO, "Multi extrude")
            ],
            ref("early"),
            folder("Basic operations", ref("extrude"), ref("late"))
        );
        expect(exampleOf(document, "extrude", "Multi extrude")).toBe("late");
    });

    it("takes a named Part Studio anywhere over the next one in the folder", () => {
        const document = contents(
            [
                extrude,
                tab("next", PART_STUDIO, "Something"),
                tab("named", PART_STUDIO, "Multi extrude")
            ],
            folder("Basic operations", ref("extrude"), ref("next")),
            folder("Examples", ref("named"))
        );
        expect(exampleOf(document, "extrude", "Multi extrude")).toBe("named");
    });

    it("looks after the feature only, and only in its own folder", () => {
        const document = contents(
            [tab("before", PART_STUDIO), extrude, tab("nested", PART_STUDIO)],
            folder(
                "Basic operations",
                ref("before"),
                ref("extrude"),
                folder("Inner", ref("nested"))
            )
        );
        expect(exampleOf(document, "extrude", "Multi extrude")).toBeUndefined();
    });

    it("finds a feature missing from the tree its example by name alone", () => {
        const document = contents(
            [
                extrude,
                tab("next", PART_STUDIO, "Other"),
                tab("ex", PART_STUDIO, "Multi extrude")
            ],
            ref("next"),
            ref("ex")
        );
        expect(exampleOf(document, "extrude", "Multi extrude")).toBe("ex");
    });
});

describe("categoryOf", () => {
    it("is the outermost folder, and none at the top level", () => {
        const document = contents(
            [tab("a", FEATURE_STUDIO), tab("b", FEATURE_STUDIO)],
            ref("a"),
            folder("Parts", folder("Belts", ref("b")))
        );
        expect(categoryOf(document, "a")).toBeUndefined();
        expect(categoryOf(document, "b")).toBe("Parts");
    });
});

describe("findManifestTab", () => {
    it("is the blob tab of that name at the top level only", () => {
        const nested = tab("nested", BLOB, MANIFEST_TAB_NAME);
        const top = tab("top", BLOB, MANIFEST_TAB_NAME);
        expect(
            findManifestTab(contents([nested], folder("Old", ref("nested"))))
        ).toBeUndefined();
        expect(
            findManifestTab(
                contents(
                    [nested, top],
                    folder("Old", ref("nested")),
                    ref("top")
                )
            )?.id
        ).toBe("top");
    });
});

describe("parseManifest", () => {
    const feature = {
        studioElementId: "s",
        featureType: "robotFrame",
        name: "Robot frame",
        description: "Add tube.",
        version: "1.3.0",
        iconElementId: null,
        sourceUrl: "https://github.com/robot-education/robot-code/blob/x"
    };

    it("reads a manifest of its own schema version", () => {
        expect(
            parseManifest({ schemaVersion: 1, features: [feature] }).features
        ).toEqual([feature]);
    });

    it("refuses another schema version rather than guess", () => {
        expect(() =>
            parseManifest({ schemaVersion: 2, features: [feature] })
        ).toThrow();
    });
});
