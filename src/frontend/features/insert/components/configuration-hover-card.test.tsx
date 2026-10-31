import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InsertableOut } from "@backend/features/library/contract";
import type { ConfigurationResult } from "@backend/features/configurations/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    boolParam,
    enumParam
} from "../../../../__test_utils__/configuration-fixtures";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { configurationQueryKey } from "../../../lib/query-keys";
import { ConfigurationHoverCard } from "./configuration-hover-card";

const INSERTABLE: InsertableOut = {
    id: "ins",
    elementId: "el",
    groupId: "group",
    documentId: "doc",
    versionId: "v",
    path: {
        documentId: "doc",
        instanceType: "v",
        instanceId: "v",
        elementId: "el"
    },
    name: "Spacer",
    microversionId: "mv",
    isVisible: true,
    supportsFasten: false,
    elementType: ElementType.PART_STUDIO,
    isConfigurable: true,
    vendors: []
};

const CONFIGURATION: ConfigurationResult = {
    parameters: [
        enumParam("size", ["s", "l"], {
            name: "Size",
            options: [
                { id: "s", name: "Small" },
                { id: "l", name: "Large" }
            ]
        }),
        { ...boolParam("flanged"), name: "Flanged" }
    ],
    records: []
};

function renderCard(
    insertable: InsertableOut,
    selection?: Record<string, string>
) {
    const { queryClient, container } = renderWithProviders(
        <ConfigurationHoverCard insertable={insertable} selection={selection} />
    );
    queryClient.setQueryData(
        configurationQueryKey(insertable.id, insertable.microversionId),
        CONFIGURATION
    );
    return container;
}

describe("ConfigurationHoverCard", () => {
    it("lists the configuration a row opens on when its icon is hovered", async () => {
        const user = userEvent.setup();
        const container = renderCard(INSERTABLE, { size: "l" });

        await user.hover(container.querySelector("svg")!);

        expect(await screen.findByText("Large")).not.toBeNull();
        expect(screen.getByText("Size")).not.toBeNull();
        // Left at its default, so still listed.
        expect(screen.getByText("Flanged")).not.toBeNull();
        expect(screen.getByText("No")).not.toBeNull();
    });

    it("shows the defaults for a row without a selection", async () => {
        const user = userEvent.setup();
        const container = renderCard(INSERTABLE);

        await user.hover(container.querySelector("svg")!);

        expect(await screen.findByText("Small")).not.toBeNull();
    });

    it("shows nothing for a part with nothing to configure", () => {
        const container = renderCard({ ...INSERTABLE, isConfigurable: false });
        expect(container.querySelector("svg")).toBeNull();
    });
});
