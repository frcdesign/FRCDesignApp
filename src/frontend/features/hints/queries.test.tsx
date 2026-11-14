import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import { Hint } from "@backend/features/hints/contract";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../__test_utils__/render";
import { accessDataQueryKey } from "../../lib/query-keys";

const apiPost = vi.hoisted(() => vi.fn(() => Promise.resolve({})));
vi.mock("../../lib/api-client", () => ({ apiPost }));
vi.mock("../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { useHasSeenHint, useMarkHintSeen } = await import("./queries");

const HINT = Hint.OPENED_REPORT_ISSUE;

function HintButton(): ReactNode {
    const seen = useHasSeenHint(HINT);
    const markSeen = useMarkHintSeen(HINT);
    return <button onClick={markSeen}>{seen ? "seen" : "new"}</button>;
}

function renderHint(signedIn: boolean) {
    const queryClient = createTestQueryClient();
    const answer = (seenHints: Hint[]) =>
        queryClient.setQueryData<AccessData>(
            accessDataQueryKey(DEFAULT_LIBRARY),
            { maxAccessLevel: AccessLevel.USER, signedIn, seenHints }
        );
    answer([]);
    renderWithProviders(<HintButton />, queryClient);
    return answer;
}

describe("hints", () => {
    beforeEach(() => {
        apiPost.mockClear();
    });

    it("stay seen when access is refetched without them", async () => {
        const user = userEvent.setup();
        const answer = renderHint(true);

        await user.click(screen.getByRole("button", { name: "new" }));
        // The server's list, before the seen hint has reached it.
        act(() => {
            answer([]);
        });

        expect(screen.getByRole("button", { name: "seen" })).toBeTruthy();
        expect(apiPost).toHaveBeenCalledTimes(1);
    });

    it("point nothing out signed out", async () => {
        const user = userEvent.setup();
        renderHint(false);

        await user.click(screen.getByRole("button", { name: "seen" }));

        expect(apiPost).not.toHaveBeenCalled();
    });
});
