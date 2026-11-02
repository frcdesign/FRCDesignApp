import type { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import { ElementType } from "@backend/lib/onshape/element-type";

/** A visible part studio with nothing to report; override any field under test. */
export function insertableBuildStatus(
    overrides: Partial<InsertableBuildStatus> = {}
): InsertableBuildStatus {
    return {
        buildIssues: [],
        elementPath: {
            documentId: "d",
            instanceType: "v",
            instanceId: "v",
            elementId: "e"
        },
        elementType: ElementType.PART_STUDIO,
        isVisible: true,
        supportsFasten: false,
        fastenDisabled: false,
        indexConfigurations: false,
        excludedParameterIds: [],
        vendors: [],
        ...overrides
    };
}
