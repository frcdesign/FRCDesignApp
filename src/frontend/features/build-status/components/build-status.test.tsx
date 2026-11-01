import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { boolParam } from "../../../../__test_utils__/configuration-fixtures";
import type { LibraryBuildStatus } from "@backend/features/build-checker/contract";
import { insertableBuildStatus } from "../../../../__test_utils__/build-status-fixtures";

const status = insertableBuildStatus({
    configuration: { parameters: [boolParam("holes")] }
});

const buildStatus: LibraryBuildStatus = {
    groups: {},
    insertables: { i1: status }
};

vi.mock("../queries", () => ({
    useBuildStatusQuery: () => ({ data: buildStatus })
}));
vi.mock("../../library/queries", () => ({
    useIsGroupLoading: () => false
}));
vi.mock("../../auth/components/require-access", () => ({
    RequireAccessLevel: (props: PropsWithChildren) => props.children
}));

const { InsertableStatusBadge } = await import("./build-status");
const { clearIndexingDraft, editIndexingDraft } =
    await import("../indexing-draft");

/** Mantine draws the dot as its own element beside the badge's icon. */
function hasDot(container: HTMLElement): boolean {
    return container.querySelector(".mantine-Indicator-indicator") !== null;
}

describe("insertable status badge", () => {
    afterEach(() => clearIndexingDraft("i1"));

    it("dots the badge while the card holds unsaved edits", () => {
        const { container } = renderWithProviders(
            <InsertableStatusBadge insertableId="i1" groupId="g" name="Part" />
        );
        expect(hasDot(container)).toBe(false);

        act(() =>
            editIndexingDraft("i1", status, { excludedParameterIds: ["holes"] })
        );
        expect(hasDot(container)).toBe(true);

        act(() => clearIndexingDraft("i1"));
        expect(hasDot(container)).toBe(false);
    });
});
