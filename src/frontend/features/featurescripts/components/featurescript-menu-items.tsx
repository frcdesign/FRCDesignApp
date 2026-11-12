import { Menu } from "@mantine/core";
import {
    ArrowSquareOutIcon,
    CodeIcon,
    PuzzlePieceIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { openUrlInNewTab } from "../../../lib/url";
import { m } from "../../../paraglide/messages";
import { useFrontendTabUrl } from "../queries";

interface FeatureScriptMenuItemsProps {
    feature: FeatureScriptOut;
    /** In the popup, which has its own Open example button. */
    inPopup?: boolean;
}

/**
 * A row's ⋯ and right-click menu, and the popup's ⋯: only what isn't a button
 * beside them already, so adding and favoriting are left to theirs.
 */
export function FeatureScriptMenuItems(
    props: FeatureScriptMenuItemsProps
): ReactNode {
    const { feature, inPopup = false } = props;
    const exampleUrl = useFrontendTabUrl(feature.exampleElementId);
    const studioUrl = useFrontendTabUrl(feature.elementId);
    const { sourceUrl } = feature;

    return (
        <>
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
