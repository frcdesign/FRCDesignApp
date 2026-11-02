import type { PartUsageOut } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";

/** An unused, visible part; override any field, or just its element id. */
export function partUsage({
    elementId = "e-1",
    ...overrides
}: Partial<PartUsageOut> & { elementId?: string } = {}): PartUsageOut {
    return {
        libraryId: LibraryId.FRC_DESIGN_LIB,
        path: {
            documentId: "doc-1",
            instanceId: "v-1",
            instanceType: "v",
            elementId
        },
        name: "Part",
        groupName: "Gearboxes",
        isVisible: true,
        insertCount: 0,
        usesPerMonth: 0,
        favorites: 0,
        recent: [],
        ...overrides
    };
}
