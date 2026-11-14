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
import type { FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import {
    featureScriptsQueryKey,
    featureScriptsVersionQueryKey
} from "../../../lib/query-keys";
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

const FEATURE: FeatureScriptOut = {
    id: "frame",
    elementId: "e-frame",
    name: "Robot frame",
    description: "Add tube.",
    isVisible: true,
    problems: []
};

const PART_CALLOUT = /Report an issue button in the configuration menu/;

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

        // The app and its libraries are separate choices, then the library.
        await user.click(screen.getByRole("combobox", { name: "About" }));
        expect(screen.queryByRole("option", { name: "MKCad" })).toBeNull();
        await user.click(screen.getByRole("option", { name: "Part library" }));
        const library = screen.getByRole<HTMLInputElement>("combobox", {
            name: "Library"
        });
        expect(library.value).toBe("FRCDesignLib");
        await user.click(library);
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
        expect(screen.getByRole("option", { name: "Kudos" })).toBeTruthy();
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
        const title = screen.getByRole<HTMLInputElement>("textbox", {
            name: /Title/
        });
        expect(title.value).toBe("");
        expect(title.placeholder).toBe("What is this request about?");

        await user.type(
            screen.getByRole("textbox", { name: /Description/ }),
            "  Pull is slow.  "
        );
        // A title is required, and general feedback has none until written.
        expect(send).toHaveProperty("disabled", true);
        await user.type(title, "Slow pulls");
        await user.type(
            screen.getByRole("textbox", { name: /Team number/ }),
            "254"
        );
        await user.click(send);

        expect(sent()).toMatchObject({
            topic: FeedbackTopic.VERSION_MANAGER,
            category: FeedbackCategory.BUG,
            source: FeedbackSource.GENERAL,
            title: "Slow pulls",
            message: "Pull is slow.",
            teamNumber: 254
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
            screen.getByRole("textbox", { name: /Description/ }),
            "Sizes over 1 in fail."
        );
        // A title is required, so clearing it can't send.
        expect(screen.getByRole("button", { name: "Send" })).toHaveProperty(
            "disabled",
            true
        );

        await user.type(title, "Large sizes fail");
        await user.click(screen.getByRole("combobox", { name: "Type" }));
        expect(
            screen.queryByRole("option", { name: "Wrong or missing thumbnail" })
        ).toBeNull();
        await user.click(
            screen.getByRole("option", { name: "Incorrect geometry" })
        );
        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent()).toMatchObject({
            title: "Large sizes fail",
            category: FeedbackCategory.INCORRECT_GEOMETRY
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
        await user.type(
            screen.getByRole("textbox", { name: /Description/ }),
            "Wrong length."
        );

        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent()).toMatchObject({
            topic: FeedbackTopic.FRC_DESIGN_LIB,
            category: FeedbackCategory.METADATA,
            part: {
                insertableId: "ins",
                selection: { size: "1/2 in" }
            }
        });

        mutate.mockReset();
        await user.click(
            screen.getByRole("checkbox", { name: "Include configuration" })
        );
        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent().part).toEqual({ insertableId: "ins" });
    });

    it("offers no configuration from a menu with none on screen", async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.FRC_DESIGN_LIB}
                source={FeedbackSource.PART}
                part={{ insertable: INSERTABLE }}
            />
        );
        expect(
            screen.queryByRole("checkbox", { name: "Include configuration" })
        ).toBeNull();

        await user.type(
            screen.getByRole("textbox", { name: /Description/ }),
            "Wrong length."
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
        // An error is the app's, adding a FeatureScript included.
        await user.click(screen.getByRole("combobox", { name: "About" }));
        expect(
            screen.queryByRole("option", { name: "FeatureScripts" })
        ).toBeNull();
        await user.click(screen.getByRole("option", { name: "FRCDesignApp" }));

        await user.click(screen.getByRole("button", { name: "Send" }));

        expect(sent().message).toBe("");
        expect(sent().teamNumber).toBeUndefined();
        expect(sent().diagnostics.error).toEqual(error);
    });

    it("sends a failed insert's part and configuration with its error, to the app", async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.APP}
                source={FeedbackSource.ERROR}
                error={{ shown: "Unexpectedly failed to insert Hex shaft." }}
                part={{
                    insertable: INSERTABLE,
                    selection: { size: "1/2 in" }
                }}
            />
        );

        await user.click(screen.getByRole("button", { name: "Send" }));

        expect(sent()).toMatchObject({
            topic: FeedbackTopic.APP,
            source: FeedbackSource.ERROR,
            title: "Unexpectedly failed to insert Hex shaft",
            part: { insertableId: "ins", selection: { size: "1/2 in" } }
        });
    });

    it("sends a FeatureScript picked under FeatureScripts, or none", async () => {
        const user = userEvent.setup();
        const queryClient = createTestQueryClient();
        queryClient.setQueryData(featureScriptsVersionQueryKey(), 3);
        queryClient.setQueryData(featureScriptsQueryKey(3), {
            features: [FEATURE]
        });
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.APP}
                source={FeedbackSource.GENERAL}
            />,
            queryClient
        );

        await user.click(screen.getByRole("combobox", { name: "About" }));
        await user.click(
            screen.getByRole("option", { name: "FeatureScripts" })
        );
        await user.type(
            screen.getByRole("textbox", { name: /Title/ }),
            "Ideas"
        );
        await user.type(
            screen.getByRole("textbox", { name: /Description/ }),
            "More gussets."
        );
        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent()).toMatchObject({ topic: FeedbackTopic.FEATURESCRIPTS });
        expect(sent().featureScript).toBeUndefined();

        mutate.mockReset();
        await user.click(
            screen.getByRole("combobox", { name: "FeatureScript" })
        );
        await user.click(screen.getByRole("option", { name: "Robot frame" }));
        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent().featureScript).toEqual({ featureScriptId: "frame" });

        // Leaving the area drops the feature with it.
        mutate.mockReset();
        await user.click(screen.getByRole("combobox", { name: "About" }));
        await user.click(screen.getByRole("option", { name: "FRCDesignApp" }));
        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent().topic).toBe(FeedbackTopic.APP);
        expect(sent().featureScript).toBeUndefined();
    });

    it("reports a FeatureScript from its menu without asking what it is about", async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.FEATURESCRIPTS}
                source={FeedbackSource.FEATURESCRIPT}
                featureScript={FEATURE}
            />
        );
        expect(screen.queryByRole("combobox", { name: "About" })).toBeNull();
        expect(
            screen.getByRole<HTMLInputElement>("textbox", { name: /Title/ })
                .value
        ).toBe("Bug: Robot frame");

        await user.type(
            screen.getByRole("textbox", { name: /Description/ }),
            "Fails on curved faces."
        );
        await user.click(screen.getByRole("button", { name: "Send" }));
        expect(sent()).toMatchObject({
            topic: FeedbackTopic.FEATURESCRIPTS,
            source: FeedbackSource.FEATURESCRIPT,
            category: FeedbackCategory.BUG,
            featureScript: { featureScriptId: "frame" }
        });
    });

    it("offers another report on the feedback page, where there is nothing to close", () => {
        answer.data = { reportId: "r" };
        renderWithProviders(
            <FeedbackForm
                initialTopic={FeedbackTopic.APP}
                source={FeedbackSource.GENERAL}
                onPage
            />
        );
        expect(
            screen.getByRole("button", { name: "Send another" })
        ).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });
});
