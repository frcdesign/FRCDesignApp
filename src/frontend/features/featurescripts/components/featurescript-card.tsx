import { Group, Menu } from "@mantine/core";
import {
    ArrowSquareOutIcon,
    CodeIcon,
    PlusIcon,
    PuzzlePieceIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { CardTitle, ItemRow } from "../../../components/item-row";
import { openUrlInNewTab } from "../../../lib/url";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { RequireSignIn } from "../../auth/components/require-access";
import { openFeatureScriptMenu } from "../open-featurescript-menu";
import {
    useAddAvailability,
    useAddFeatureScriptMutation,
    useFrontendTabUrl
} from "../queries";
import { FeatureScriptAddButton } from "./featurescript-add-button";
import {
    FeatureScriptFavoriteButton,
    FeatureScriptFavoriteItem
} from "./featurescript-favorite-button";
import { FeatureScriptIcon } from "./featurescript-icon";
import { FeatureScriptStatus } from "./featurescript-status";

interface FeatureScriptCardProps {
    feature: FeatureScriptOut;
}

/** A row: its icon and name, the owner's card, then Add, the heart and the menu. */
export function FeatureScriptCard(props: FeatureScriptCardProps): ReactNode {
    const { feature } = props;
    const add = useAddFeatureScriptMutation(feature);
    const availability = useAddAvailability();
    const exampleUrl = useFrontendTabUrl(feature.exampleElementId);
    const studioUrl = useFrontendTabUrl(feature.elementId);
    const { sourceUrl } = feature;

    return (
        <ItemRow
            onClick={() => openFeatureScriptMenu(feature)}
            left={
                <CardTitle
                    title={feature.name}
                    thumbnail={
                        <FeatureScriptIcon
                            iconUrl={feature.iconUrl}
                            size={IconSize.CONTROL}
                        />
                    }
                    badge={<FeatureScriptStatus feature={feature} />}
                />
            }
            menuItems={
                <>
                    {availability.offered && (
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
                    {exampleUrl && (
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
                    <RequireSignIn>
                        <FeatureScriptFavoriteItem feature={feature} />
                    </RequireSignIn>
                </>
            }
            actions={
                <Group gap={4} wrap="nowrap">
                    <FeatureScriptAddButton feature={feature} />
                    <RequireSignIn>
                        <FeatureScriptFavoriteButton feature={feature} />
                    </RequireSignIn>
                </Group>
            }
        />
    );
}
