import { Loader, Table, Text } from "@mantine/core";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import type { InsertableOut } from "@backend/features/library/contract";
import { type PartialSelection } from "@backend/features/configurations/contract";
import { displayedValues } from "@backend/features/configurations/selection";
import { AppHoverCard } from "../../../components/app-hover-card";
import { AppIcon } from "../../../components/app-icon";
import { IconSize, StatusColor } from "../../../lib/style-constants";
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
        <AppHoverCard
            openDelay={150}
            closeDelay={50}
            position="right"
            arrowSize={20}
            padding="xs"
            target={
                <AppIcon
                    icon={SlidersHorizontalIcon}
                    size={IconSize.SMALL}
                    color={StatusColor.DIMMED}
                />
            }
        >
            <ConfigurationCard
                insertable={insertable}
                selection={selection ?? {}}
            />
        </AppHoverCard>
    );
}

interface ConfigurationCardProps {
    insertable: InsertableOut;
    selection: PartialSelection;
}

/** Mounted only while the card is open, so the parameters are fetched on first hover. */
function ConfigurationCard(props: ConfigurationCardProps): ReactNode {
    const { insertable, selection } = props;

    const configurationQuery = useConfigurationQuery(
        insertable.id,
        insertable.microversionId
    );

    if (configurationQuery.isPending) {
        return <Loader size={IconSize.SMALL} />;
    } else if (configurationQuery.isError) {
        return (
            <Text size="sm" c={StatusColor.ERROR}>
                Failed to load the configuration.
            </Text>
        );
    }

    const values = displayedValues(
        selection,
        configurationQuery.data.parameters
    );

    return (
        <Table
            withRowBorders={false}
            verticalSpacing={2}
            horizontalSpacing="xs"
            fz="sm"
        >
            <Table.Tbody>
                {values.map(({ parameter, value, isDefault }) => (
                    <Table.Tr key={parameter.id}>
                        <Table.Td c={StatusColor.DIMMED}>
                            {parameter.name}
                        </Table.Td>
                        {/* What was changed stands out from what was left alone. */}
                        <Table.Td
                            c={isDefault ? StatusColor.DIMMED : undefined}
                            fw={isDefault ? undefined : 500}
                        >
                            {value}
                        </Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );
}
