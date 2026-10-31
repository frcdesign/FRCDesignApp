import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    FeedbackCategory,
    type FeedbackIn,
    FeedbackSource,
    FeedbackTopic
} from "@backend/features/feedback/contract";
import type { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../../__test_utils__/render";

const mutate = vi.hoisted(() => vi.fn<(body: FeedbackIn) => void>());
vi.mock("../queries", () => ({
    useSendFeedbackMutation: () => ({ mutate, isPending: false })
}));

const { FeedbackForm } = await import("./feedback-form");

const INSERTABLE: InsertableOut = {
    id: "ins",
    elementId: "el",
    groupId: "group",
    documentId: "doc",
    versionId: "ver",
    path: {
        documentId: "doc",
        instanceType: "v",
        instanceId: "ver",
        elementId: "el"
    },
    name: "Hex shaft",
    microversionId: "mv",
    isVisible: true,
    supportsFasten: false,
    elementType: ElementType.PART_STUDIO,
    isConfigurable: true,
    vendors: []
};

const PART_CALLOUT = /Report an issue in that part's menu/;

function sent(): FeedbackIn {
    return mutate.mock.calls[0][0];
}

describe("FeedbackForm", () => {
    afterEach(() => {
        mutate.mockReset();
    });

    it("points a library's feedback at the part menu", async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.APP}
                source={FeedbackSource.GENERAL}
            />
        );
        expect(screen.queryByText(PART_CALLOUT)).toBeNull();

        await user.click(screen.getByRole("combobox", { name: "About" }));
        await user.click(screen.getByRole("option", { name: "MKCad" }));

        expect(screen.getByText(PART_CALLOUT)).toBeTruthy();
        // A library offers its own kinds, and keeps a kind both offer.
        const type = screen.getByRole<HTMLInputElement>("combobox", {
            name: "Type"
        });
        expect(type.value).toBe("Bug");
        await user.click(type);
        expect(
            screen.getByRole("option", { name: "Part request" })
        ).toBeTruthy();
    });

    it("sends what was typed, about the chosen topic", async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.VERSION_MANAGER}
                source={FeedbackSource.GENERAL}
            />
        );
        const send = screen.getByRole("button", { name: "Send" });
        expect(send).toHaveProperty("disabled", true);

        await user.type(
            screen.getByRole("textbox", { name: /Details/ }),
            "  Pull is slow.  "
        );
        await user.click(send);

        expect(sent()).toMatchObject({
            topic: FeedbackTopic.VERSION_MANAGER,
            category: FeedbackCategory.BUG,
            source: FeedbackSource.GENERAL,
            message: "Pull is slow."
        });
        expect(sent().part).toBeUndefined();
        expect(sent().diagnostics.url).toBe(window.location.href);
    });

    it("sends a part's configuration unless it is left out", async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.FRC_DESIGN_LIB}
                source={FeedbackSource.PART}
                part={{
                    insertable: INSERTABLE,
                    selection: { size: "1/2 in", length: undefined }
                }}
            />
        );
        expect(screen.getByText("Hex shaft")).toBeTruthy();
        await user.type(
            screen.getByRole("textbox", { name: /Details/ }),
            "Wrong length."
        );

        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent()).toMatchObject({
            topic: FeedbackTopic.FRC_DESIGN_LIB,
            category: FeedbackCategory.METADATA,
            part: { insertableId: "ins", selection: { size: "1/2 in" } }
        });

        mutate.mockReset();
        await user.click(
            screen.getByRole("checkbox", { name: "Include the configuration" })
        );
        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent().part).toEqual({ insertableId: "ins" });
    });

    it("sends an error report with nothing typed, carrying the error", async () => {
        const user = userEvent.setup();
        const error = { shown: "Failed to insert.", detail: "boom" };
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.APP}
                source={FeedbackSource.ERROR}
                error={error}
            />
        );
        expect(screen.getByText(/Failed to insert\./)).toBeTruthy();

        await user.click(screen.getByRole("button", { name: "Send" }));

        expect(sent().message).toBe("");
        expect(sent().diagnostics.error).toEqual(error);
    });
});
