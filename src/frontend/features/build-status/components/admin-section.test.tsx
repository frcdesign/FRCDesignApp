import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { insertableBuildStatus } from "../../../../__test_utils__/build-status-fixtures";
import type { LibraryBuildStatus } from "@backend/features/build-checker/contract";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { buildStatusQueryKey } from "../../../lib/query-keys";

const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
    showSuccessToast: vi.fn()
}));
vi.mock("../../../lib/api-client", () => ({
    apiPost: mocks.apiPost,
    apiGet: vi.fn()
}));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));
vi.mock("../../../lib/refresh", () => ({
    useRefreshLibrary: () => () => Promise.resolve()
}));
vi.mock("../../../lib/notifications", () => ({
    showLoadingToast: vi.fn(),
    showInfoToast: vi.fn(),
    showSuccessToast: mocks.showSuccessToast,
    showErrorToast: vi.fn()
}));

const { InsertableSettings } = await import("./admin-section");
const { useBuildStatusQuery } = await import("../queries");
const { queryClient } = await import("../../../lib/query-client");

/** Reads the status from the cache, as the card does, so a patch re-renders it. */
function Settings(): ReactNode {
    const { data } = useBuildStatusQuery();
    const status = data?.insertables.i1;
    return status && <InsertableSettings insertableId="i1" status={status} />;
}

describe("visibility switch", () => {
    afterEach(() => {
        mocks.apiPost.mockReset();
        mocks.showSuccessToast.mockReset();
        queryClient.clear();
    });

    it("says the part was shown once showing it lands", async () => {
        queryClient.setQueryData<LibraryBuildStatus>(
            buildStatusQueryKey(DEFAULT_LIBRARY, 0),
            {
                groups: {},
                insertables: { i1: insertableBuildStatus({ isVisible: false }) }
            }
        );
        const request = Promise.withResolvers<object>();
        mocks.apiPost.mockReturnValue(request.promise);
        renderWithProviders(<Settings />, queryClient);
        // The first switch in the card; it carries no name of its own
        const visible = () =>
            screen.getAllByRole<HTMLInputElement>("switch")[0];

        await userEvent.click(visible());
        await waitFor(() => expect(visible().checked).toBe(true));
        request.resolve({});

        await waitFor(() =>
            expect(mocks.showSuccessToast).toHaveBeenCalledWith(
                "Part shown.",
                "set-visibility"
            )
        );
        expect(mocks.apiPost).toHaveBeenCalledWith(
            expect.stringContaining("/set-insertable-visibility"),
            { body: { insertableIds: ["i1"], isVisible: true } }
        );
    });
});
