import { Loader, Stack, Text } from "@mantine/core";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import type { InsertableOut } from "@backend/features/library/contract";
import {
    type ConfigurationParameter,
    type PartialSelection
} from "@backend/features/configurations/contract";
import { displayedValues } from "@backend/features/configurations/selection";
import {
    AppHoverBubble,
    HoverBubbleRow
} from "../../../components/app-hover-bubble";
import { AppIcon } from "../../../components/app-icon";
import {
    FontWeight,
    IconSize,
    PrimaryColor,
    StatusColor
} from "../../../lib/style-constants";
import { useConfigurationQuery } from "../queries";

interface ConfigurationHoverCardProps {
    insertable: InsertableOut;
    /** The configuration the row opens on; absent for the element's defaults. */
    selection?: PartialSelection;
}

/** An icon whose card lists the configuration a row opens on. Nothing for a part with none. */
export function ConfigurationHoverCard(
    props: ConfigurationHoverCardProps
): ReactNode {
    const { insertable, selection } = props;

    if (!insertable.isConfigurable) {
        return null;
    }

    return (
        <AppHoverBubble
            target={<ConfigurationIcon size={IconSize.SMALL} />}
            icon={<ConfigurationIcon size={IconSize.CONTROL} />}
            title="Configuration"
        >
            <ConfigurationValues
                insertable={insertable}
                selection={selection ?? {}}
            />
        </AppHoverBubble>
    );
}

interface ConfigurationIconProps {
    size: IconSize;
}

function ConfigurationIcon(props: ConfigurationIconProps): ReactNode {
    const { size } = props;
    return (
        <AppIcon
            icon={SlidersHorizontalIcon}
            size={size}
            color={PrimaryColor.FILLED}
        />
    );
}

interface ConfigurationValuesProps {
    insertable: InsertableOut;
    selection: PartialSelection;
}

/** Mounted only while the card is open, so the parameters are fetched on first hover. */
function ConfigurationValues(props: ConfigurationValuesProps): ReactNode {
    const { insertable, selection } = props;

    const configurationQuery = useConfigurationQuery(
        insertable.id,
        insertable.microversionId
    );

    if (configurationQuery.isPending) {
        return <Loader size={IconSize.SMALL} />;
    } else if (configurationQuery.isError) {
        return (
            <Text c={StatusColor.ERROR}>Failed to load the configuration.</Text>
        );
    }
    return (
        <ValueRows
            selection={selection}
            parameters={configurationQuery.data.parameters}
        />
    );
}

interface ValueRowsProps {
    selection: PartialSelection;
    parameters: ConfigurationParameter[];
}

function ValueRows(props: ValueRowsProps): ReactNode {
    const { selection, parameters } = props;
    return (
        <Stack gap={4}>
            {displayedValues(selection, parameters).map(
                ({ parameter, value, isDefault }) => (
                    <HoverBubbleRow key={parameter.id} label={parameter.name}>
                        {/* What was changed stands out from what was left alone. */}
                        <Text
                            c={isDefault ? StatusColor.DIMMED : undefined}
                            fw={isDefault ? undefined : FontWeight.SEMI_BOLD}
                        >
                            {value}
                        </Text>
                    </HoverBubbleRow>
                )
            )}
        </Stack>
    );
}
