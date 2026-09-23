/**
 * Factories for the load pipeline's insertable shapes. Import directly: the
 * barrel re-exports Workers-only helpers these tests cannot resolve.
 */
import type { InsertableTarget } from "@backend/features/load/context";
import type { ParsedInsertable } from "@backend/features/load/load-insertable";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    TEST_PART_STUDIO_PATH,
    TEST_VERSION_CREATED_AT
} from "./seed";

/** A part-studio {@link InsertableTarget}; override any field under test. */
export function insertableTarget(
    overrides: Partial<InsertableTarget> = {}
): InsertableTarget {
    return {
        insertableId: TEST_PART_STUDIO_ID,
        libraryId: TEST_LIBRARY_ID,
        groupId: TEST_GROUP_ID,
        elementPath: TEST_PART_STUDIO_PATH,
        thumbnailPath: {
            ...TEST_PART_STUDIO_PATH,
            instanceId: "w-thumbnails",
            instanceType: "w"
        },
        versionCreatedAt: TEST_VERSION_CREATED_AT,
        elementType: ElementType.PART_STUDIO,
        name: "Test part studio",
        microversionId: "mv-1",
        sortOrder: 0,
        ...overrides
    };
}

/** A {@link ParsedInsertable} with nothing loaded; override any field under test. */
export function parsedInsertable(
    overrides: Partial<ParsedInsertable> = {}
): ParsedInsertable {
    return {
        vendors: [],
        thumbnailUrls: null,
        fastenInfo: null,
        isOpenComposite: false,
        buildIssues: [],
        partMetadata: null,
        configuration: { parameters: [], records: [] },
        ...overrides
    };
}
