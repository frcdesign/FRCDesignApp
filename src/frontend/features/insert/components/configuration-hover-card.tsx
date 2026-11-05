import { DataList, Loader, Text } from "@mantine/core";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import type { InsertableOut } from "@backend/features/library/contract";
import {
    type ConfigurationParameter,
    type PartialSelection
} from "@backend/features/configurations/contract";
import { displayedValues } from "@backend/features/configurations/selection";
import { AppHoverBubble } from "../../../components/app-hover-bubble";
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
            target={
                <AppIcon
                    icon={SlidersHorizontalIcon}
                    size={IconSize.SMALL}
                    color={PrimaryColor.FILLED}
                />
            }
            padding="sm"
        >
            <ConfigurationValues
                insertable={insertable}
                selection={selection ?? {}}
            />
        </AppHoverBubble>
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
        <DataList orientation="horizontal" size="sm" gap="xs">
            {displayedValues(selection, parameters).map(
                ({ parameter, value, isDefault }) => (
                    <DataList.Item key={parameter.id}>
                        <DataList.ItemLabel>
                            {parameter.name}
                        </DataList.ItemLabel>
                        {/* What was changed stands out from what was left alone. */}
                        <DataList.ItemValue
                            c="var(--mantine-color-text)"
                            fw={isDefault ? undefined : FontWeight.SEMI_BOLD}
                        >
                            {value}
                        </DataList.ItemValue>
                    </DataList.Item>
                )
            )}
        </DataList>
    );
}
