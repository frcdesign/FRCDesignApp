import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    FeedbackCategory,
    type FeedbackIn,
    type FeedbackOut,
    FeedbackSource,
    FeedbackTopic
} from "@backend/features/feedback/contract";
import type { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../../__test_utils__/render";
import {
    DISCORD_FORUMS,
    DISCORD_INVITE_URL,
    DiscordForum
} from "@backend/features/feedback/discord-forums";

const mutate = vi.hoisted(() => vi.fn<(body: FeedbackIn) => void>());
/** What the server answered, once the report has gone. */
const answer = vi.hoisted(() => ({
    data: undefined as FeedbackOut | undefined
}));
vi.mock("../queries", () => ({
    useSendFeedbackMutation: () => ({
        mutate,
        isPending: false,
        data: answer.data
    })
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
        answer.data = undefined;
        vi.restoreAllMocks();
    });

    it("says which channel the report is in once it is sent", async () => {
        const user = userEvent.setup();
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        answer.data = { reportId: "r" };
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.MKCAD}
                source={FeedbackSource.GENERAL}
            />
        );

        expect(screen.getByText("Report sent!")).toBeTruthy();
        // MKCad shares FRCDesignLib's forum.
        const forum = DISCORD_FORUMS[DiscordForum.LIBRARY];
        expect(
            screen.getByText(
                `You can find your report in #${forum.channel} if you want to follow up in Discord.`
            )
        ).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Open Discord" }));
        expect(open).toHaveBeenCalledWith(
            forum.invite ?? DISCORD_INVITE_URL,
            "_blank"
        );
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
            screen.getByRole("option", { name: "New part request" })
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
            title: "Bug: Version Manager",
            message: "Pull is slow."
        });
        expect(sent().part).toBeUndefined();
        expect(sent().diagnostics.url).toBe(window.location.pathname);
    });

    it("suggests a title that follows the type until it is written over", async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.FRC_DESIGN_LIB}
                source={FeedbackSource.PART}
                part={{ insertable: INSERTABLE }}
            />
        );
        const title = screen.getByRole<HTMLInputElement>("textbox", {
            name: /Title/
        });
        expect(title.value).toBe("Missing or incorrect metadata: Hex shaft");

        await user.click(screen.getByRole("combobox", { name: "Type" }));
        await user.click(
            screen.getByRole("option", { name: "Broken configuration" })
        );
        expect(title.value).toBe("Broken configuration: Hex shaft");

        await user.clear(title);
        await user.type(
            screen.getByRole("textbox", { name: /Details/ }),
            "Sizes over 1 in fail."
        );
        // A title is required, so clearing it can't send.
        expect(screen.getByRole("button", { name: "Send" })).toHaveProperty(
            "disabled",
            true
        );

        await user.type(title, "Large sizes fail");
        await user.click(screen.getByRole("combobox", { name: "Type" }));
        await user.click(screen.getByRole("option", { name: "Insert fails" }));
        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent()).toMatchObject({
            title: "Large sizes fail",
            category: FeedbackCategory.INSERT_FAILED
        });
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
