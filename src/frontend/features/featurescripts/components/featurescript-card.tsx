import { Menu, Text } from "@mantine/core";
import { ArrowSquareOutIcon, PlusIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { CardTitle, ItemRow } from "../../../components/item-row";
import { openUrlInNewTab } from "../../../lib/url";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import {
    useAddFeatureScriptMutation,
    useCannotAddReason,
    useExampleUrl
} from "../queries";
import { RequireSignIn } from "../../auth/components/require-access";
import { FeatureScriptBadges } from "./featurescript-badges";
import {
    FeatureScriptFavoriteButton,
    FeatureScriptFavoriteItem
} from "./featurescript-favorite-button";
import { FeatureScriptIcon } from "./featurescript-icon";

/** Where the description starts; the details show the rest. */
function firstLine(description: string): string {
    return description.split("\n")[0];
}

interface FeatureScriptCardProps {
    feature: FeatureScriptOut;
}

export function FeatureScriptCard(props: FeatureScriptCardProps): ReactNode {
    const { feature } = props;
    const navigate = useNavigate();
    const add = useAddFeatureScriptMutation(feature);
    const cannotAddReason = useCannotAddReason();
    const exampleUrl = useExampleUrl(feature);

    const openDetails = () => {
        void navigate({
            to: "/app/featurescripts/$featureId",
            params: { featureId: feature.id }
        });
    };

    return (
        <ItemRow
            onClick={openDetails}
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
                    <Menu.Item
                        leftSection={<PlusIcon />}
                        disabled={cannotAddReason !== undefined}
                        onClick={() => add.mutate()}
                    >
                        {m.featureScriptsAdd()}
                    </Menu.Item>
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
                </>
            }
            rightSection={
                <RequireSignIn>
                    <FeatureScriptFavoriteButton feature={feature} />
                </RequireSignIn>
            }
        />
    );
}
