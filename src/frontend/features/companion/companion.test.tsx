import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
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
import { useOnshapeLaunch } from "../../lib/onshape-params";
import { getUiState, updateUiState } from "../../lib/ui-state";
import { COMPANION_URL } from "../../lib/url";

const showTipToast = vi.hoisted(() => vi.fn());
vi.mock("../../lib/notifications", () => ({
    showTipToast,
    renderNotification: (message: string) => message
}));
vi.mock("../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { CompanionButton } = await import("./components/companion-button");
const { resetCompanionTip, useCompanionTip } = await import("./companion-tip");
const { useCompanion } = await import("./connection");

const CHROME =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const FIREFOX =
    "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";

function TipButton(): ReactNode {
    const showTip = useCompanionTip();
    return <button onClick={showTip}>Insert</button>;
}

function renderWithAccess(ui: ReactNode, seenHints: Hint[] = []) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData<AccessData>(accessDataQueryKey(DEFAULT_LIBRARY), {
        maxAccessLevel: AccessLevel.USER,
        signedIn: true,
        seenHints
    });
    return renderWithProviders(ui, queryClient);
}

function inOnshape() {
    useOnshapeLaunch.setState({
        documentId: "doc",
        instanceId: "ws",
        instanceType: "w",
        elementId: "asm",
        elementType: "ASSEMBLY" as never
    });
}

beforeEach(() => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(CHROME);
    vi.spyOn(window, "open").mockImplementation(() => null);
    showTipToast.mockClear();
    resetCompanionTip();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("CompanionButton", () => {
    it("gets the extension until it's connected", async () => {
        const user = userEvent.setup();
        inOnshape();
        renderWithAccess(<CompanionButton />);

        await user.hover(screen.getByRole("button"));
        expect(await screen.findByText("Get the extension")).toBeTruthy();
        await user.click(screen.getByRole("button"));
        expect(window.open).toHaveBeenCalledWith(COMPANION_URL, "_blank");
    });

    it("says the extension is connected once it answers", async () => {
        const user = userEvent.setup();
        inOnshape();
        useCompanion.setState({ isConnected: true });
        renderWithAccess(<CompanionButton />);

        await user.hover(screen.getByRole("button"));
        expect(await screen.findByText("Extension connected")).toBeTruthy();
    });

    it.each([
        ["outside Onshape", false, CHROME],
        ["in a browser that can't install it", true, FIREFOX]
    ])("shows nothing %s", (_name, isInOnshape, userAgent) => {
        if (isInOnshape) {
            inOnshape();
        }
        vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);

        renderWithAccess(<CompanionButton />);

        expect(screen.queryByRole("button")).toBeNull();
    });
});

describe("useCompanionTip", () => {
    it("offers the extension once a page load, at most three times", async () => {
        const user = userEvent.setup();
        inOnshape();
        renderWithAccess(<TipButton />);

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByRole("button"));
        expect(showTipToast).toHaveBeenCalledOnce();
        expect(getUiState().companionTipCount).toBe(1);

        resetCompanionTip();
        updateUiState({ companionTipCount: 3 });
        await user.click(screen.getByRole("button"));
        expect(showTipToast).toHaveBeenCalledOnce();
    });

    it.each([
        ["it's connected here", [], true],
        [
            "it has connected on another computer",
            [Hint.CONNECTED_COMPANION],
            false
        ]
    ])("offers nothing once %s", async (_name, seenHints, isConnected) => {
        const user = userEvent.setup();
        inOnshape();
        useCompanion.setState({ isConnected });
        renderWithAccess(<TipButton />, seenHints);

        await user.click(screen.getByRole("button"));

        expect(showTipToast).not.toHaveBeenCalled();
    });
});
