import { Group } from "@mantine/core";
import { type ReactNode } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { CardTitle, ItemRow } from "../../../components/item-row";
import { IconSize } from "../../../lib/style-constants";
import { RequireSignIn } from "../../auth/components/require-access";
import { openFeatureScriptMenu } from "../open-featurescript-menu";
import { FeatureScriptAddButton } from "./featurescript-add-button";
import { FeatureScriptFavoriteButton } from "./featurescript-favorite-button";
import { FeatureScriptIcon } from "./featurescript-icon";
import { FeatureScriptMenuItems } from "./featurescript-menu-items";
import { FeatureScriptStatus } from "./featurescript-status";

interface FeatureScriptCardProps {
    feature: FeatureScriptOut;
}

/** A row: its icon and name, the owner's card, then Add, the heart and the menu. */
export function FeatureScriptCard(props: FeatureScriptCardProps): ReactNode {
    const { feature } = props;
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
            menuItems={<FeatureScriptMenuItems feature={feature} />}
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
