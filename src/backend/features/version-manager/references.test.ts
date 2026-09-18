import { describe, expect, it } from "vitest";
import type { OnshapeExternalReferences } from "../../lib/onshape/types";
import { toWorkspacePath } from "./contract";
import { planReferenceUpdates } from "./references";

const WORKSPACE = toWorkspacePath("this-doc", "this-w");

/**
 * One tab referencing one instance of one document, which is the shape every
 * case here varies from.
 */
function externalReferences(
    reference: Partial<
        OnshapeExternalReferences["elementExternalReferences"][string][number]
    > = {},
    latestVersions: { documentId: string; id: string }[] = [
        { documentId: "library", id: "v2" }
    ]
): OnshapeExternalReferences {
    return {
        elementExternalReferences: {
            tab: [
                {
                    documentId: "library",
                    id: "v1",
                    isOutOfDate: true,
                    referencedElements: ["part-studio"],
                    ...reference
                }
            ]
        },
        latestVersions
    };
}

describe("planReferenceUpdates", () => {
    it("moves an out-of-date reference onto the latest version", () => {
        const plans = planReferenceUpdates(WORKSPACE, externalReferences());
        expect(plans).toHaveLength(1);
        expect(plans[0].elementPath).toEqual({
            ...WORKSPACE,
            elementId: "tab"
        });
        expect(plans[0].updates).toEqual([
            {
                fromReference: {
                    documentId: "library",
                    instanceId: "v1",
                    instanceType: "v",
                    elementId: "part-studio"
                },
                toReference: {
                    documentId: "library",
                    instanceId: "v2",
                    instanceType: "v",
                    elementId: "part-studio"
                }
            }
        ]);
    });

    it("leaves a reference Onshape calls current alone", () => {
        expect(
            planReferenceUpdates(
                WORKSPACE,
                externalReferences({ isOutOfDate: false })
            )
        ).toEqual([]);
    });

    it("skips a document the caller did not ask about", () => {
        expect(
            planReferenceUpdates(WORKSPACE, externalReferences(), {
                onlyDocumentIds: ["some-other-doc"]
            })
        ).toEqual([]);
    });

    it("takes a pinned version over the latest one Onshape reports", () => {
        const plans = planReferenceUpdates(WORKSPACE, externalReferences(), {
            pinnedVersions: { library: "v3" }
        });
        expect(plans[0].updates[0].toReference.instanceId).toBe("v3");
    });

    it("moves onto a pinned version Onshape has not flagged yet", () => {
        // What a push runs into: the version was cut moments ago, so the flag
        // may still say the reference is current.
        const plans = planReferenceUpdates(
            WORKSPACE,
            externalReferences({ isOutOfDate: false }),
            { pinnedVersions: { library: "v3" } }
        );
        expect(plans[0].updates[0].toReference.instanceId).toBe("v3");
    });

    it("does nothing when the reference already points at the pinned version", () => {
        expect(
            planReferenceUpdates(WORKSPACE, externalReferences(), {
                pinnedVersions: { library: "v1" }
            })
        ).toEqual([]);
    });

    it("skips a document with no version to move to", () => {
        expect(
            planReferenceUpdates(WORKSPACE, externalReferences({}, []))
        ).toEqual([]);
    });

    it("carries one update per referenced tab", () => {
        const plans = planReferenceUpdates(
            WORKSPACE,
            externalReferences({ referencedElements: ["one", "two"] })
        );
        expect(plans[0].updates.map((u) => u.fromReference.elementId)).toEqual([
            "one",
            "two"
        ]);
    });
});
