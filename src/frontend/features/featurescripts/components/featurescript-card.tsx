import { Group, Menu, Text } from "@mantine/core";
import { ArrowSquareOutIcon, PlusIcon } from "@phosphor-icons/react";
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
    useExampleUrl,
    useIsOwner
} from "../queries";
import { FeatureScriptAddButton } from "./featurescript-add-button";
import { FeatureScriptBadges } from "./featurescript-badges";
import {
    FeatureScriptFavoriteButton,
    FeatureScriptFavoriteItem
} from "./featurescript-favorite-button";
import { FeatureScriptIcon } from "./featurescript-icon";
import { FeatureScriptVisibilityItem } from "./featurescript-visibility-item";

/** Where the description starts; the popup shows the rest. */
function firstLine(description: string): string {
    return description.split("\n")[0];
}

interface FeatureScriptCardProps {
    feature: FeatureScriptOut;
}

export function FeatureScriptCard(props: FeatureScriptCardProps): ReactNode {
    const { feature } = props;
    const add = useAddFeatureScriptMutation(feature);
    const availability = useAddAvailability();
    const exampleUrl = useExampleUrl(feature);
    const isOwner = useIsOwner();

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
                    badge={<FeatureScriptBadges feature={feature} />}
                    subtitle={
                        <Text size="xs" c="dimmed" truncate>
                            {firstLine(feature.description)}
                        </Text>
                    }
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
                    {exampleUrl && (
                        <Menu.Item
                            leftSection={<ArrowSquareOutIcon />}
                            onClick={() => openUrlInNewTab(exampleUrl)}
                        >
                            {m.featureScriptsOpenExample()}
                        </Menu.Item>
                    )}
                    <RequireSignIn>
                        <FeatureScriptFavoriteItem feature={feature} />
                    </RequireSignIn>
                    {isOwner && (
                        <FeatureScriptVisibilityItem feature={feature} />
                    )}
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
