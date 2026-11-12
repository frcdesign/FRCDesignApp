import { Menu } from "@mantine/core";
import {
    ArrowSquareOutIcon,
    CodeIcon,
    PlusIcon,
    PuzzlePieceIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { openUrlInNewTab } from "../../../lib/url";
import { m } from "../../../paraglide/messages";
import {
    useAddAvailability,
    useAddFeatureScriptMutation,
    useFrontendTabUrl
} from "../queries";

interface FeatureScriptMenuItemsProps {
    feature: FeatureScriptOut;
    /** In the popup, which has its own Add and Open example buttons. */
    inPopup?: boolean;
}

/** A row's ⋯ and right-click menu, and the popup's ⋯, as a part's are one menu. */
export function FeatureScriptMenuItems(
    props: FeatureScriptMenuItemsProps
): ReactNode {
    const { feature, inPopup = false } = props;
    const add = useAddFeatureScriptMutation(feature);
    const availability = useAddAvailability();
    const exampleUrl = useFrontendTabUrl(feature.exampleElementId);
    const studioUrl = useFrontendTabUrl(feature.elementId);
    const { sourceUrl } = feature;

    return (
        <>
            {!inPopup && availability.offered && (
                <Menu.Item
                    leftSection={<PlusIcon />}
                    disabled={availability.disabledReason !== undefined}
                    onClick={() => add.mutate()}
                >
                    {m.featureScriptsAdd()}
                </Menu.Item>
            )}
            {studioUrl && (
                <Menu.Item
                    leftSection={<PuzzlePieceIcon />}
                    onClick={() => openUrlInNewTab(studioUrl)}
                >
                    {m.featureScriptsGet()}
                </Menu.Item>
            )}
            {!inPopup && exampleUrl && (
                <Menu.Item
                    leftSection={<ArrowSquareOutIcon />}
                    onClick={() => openUrlInNewTab(exampleUrl)}
                >
                    {m.featureScriptsOpenExample()}
                </Menu.Item>
            )}
            {sourceUrl && (
                <Menu.Item
                    leftSection={<CodeIcon />}
                    onClick={() => openUrlInNewTab(sourceUrl)}
                >
                    {m.featureScriptsViewCode()}
                </Menu.Item>
            )}
        </>
    );
}
