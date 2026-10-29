import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import { Hint } from "@backend/features/hints/contract";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { queryClient } from "../../../lib/query-client";
import {
    accessDataQueryKey,
    insertLocationQueryKey
} from "../../../lib/query-keys";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { apiPost } from "../../../lib/api-client";
import { InsertLocationStatus } from "./insert-location-status";

vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

vi.mock("../../../lib/api-client", () => ({
    apiGet: vi.fn(() => new Promise(() => undefined)),
    apiPost: vi.fn(() => Promise.resolve({}))
}));

const ASSEMBLY = {
    documentId: "doc",
    instanceId: "w",
    instanceType: "w",
    elementId: "asm",
    elementType: ElementType.ASSEMBLY
} as const;

function seed(seenHints: Hint[]) {
    queryClient.setQueryData<AccessData>(accessDataQueryKey(DEFAULT_LIBRARY), {
        maxAccessLevel: AccessLevel.USER,
        signedIn: true,
        seenHints
    });
    queryClient.setQueryData(insertLocationQueryKey(ASSEMBLY), {});
}

const dot = () => document.querySelector(".mantine-Indicator-indicator");

describe("InsertLocationStatus", () => {
    beforeEach(() => {
        useOnshapeLaunch.setState(ASSEMBLY);
    });

    afterEach(() => {
        queryClient.clear();
        vi.mocked(apiPost).mockClear();
    });

    it("stops pointing itself out once its card has been opened and closed", async () => {
        const user = userEvent.setup();
        seed([]);
        renderWithProviders(<InsertLocationStatus />, queryClient);
        expect(dot()).not.toBeNull();

        const target = document.querySelector("svg")!;
        await user.hover(target);
        expect(await screen.findByText("New")).not.toBeNull();
        expect(dot()).not.toBeNull();

        await user.unhover(target);
        await waitFor(() => expect(dot()).toBeNull());
        expect(apiPost).toHaveBeenCalledWith("/seen-hints", {
            body: { hint: Hint.OPENED_INSERT_LOCATION }
        });

        await user.hover(target);
        expect(
            await screen.findByText("No insert location found")
        ).not.toBeNull();
        expect(screen.queryByText("New")).toBeNull();
    });

    it("sends nothing for a hint already seen", async () => {
        const user = userEvent.setup();
        seed([Hint.OPENED_INSERT_LOCATION]);
        renderWithProviders(<InsertLocationStatus />, queryClient);
        expect(dot()).toBeNull();

        const target = document.querySelector("svg")!;
        await user.hover(target);
        await screen.findByText("No insert location found");
        await user.unhover(target);

        await waitFor(() =>
            expect(screen.queryByText("No insert location found")).toBeNull()
        );
        expect(apiPost).not.toHaveBeenCalled();
    });
});
