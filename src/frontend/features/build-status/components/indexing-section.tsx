import { Divider, Stack, Switch, Text, Tooltip } from "@mantine/core";
import { ReactNode, useMemo } from "react";
import { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import {
    ParameterType,
    type ConfigurationParameter
} from "@backend/features/configurations/contract";
import {
    countCombinations,
    countConfigurations,
    IndexingBand,
    isIndexedParameter,
    MAX_COUNTED_CONFIGURATIONS,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "@backend/features/configurations/combinations";
import { StatusColor } from "../../../lib/style-constants";
import {
    useExcludedParametersMutation,
    useIndexConfigurationsMutation
} from "../queries";
import { ControlRow, SectionHeader, SwitchRow } from "./sections";
import { IssueIcon } from "./issues";
import { getParameterTypeLabel } from "./parsed-section";
import styles from "../../../lib/styles.module.css";

interface IndexingSectionProps {
    insertableId: string;
    status: InsertableBuildStatus;
}

/** Whether search indexes an insertable's configurations, and which parameters it varies. */
export function IndexingSection(props: IndexingSectionProps): ReactNode {
    const { insertableId, status } = props;
    const { excludedParameterIds } = status;
    const parameters = status.configuration?.parameters;

    // Both are enumerated on demand with the load path's routine; the total
    // runs past the index cap the band is decided by.
    const band = useMemo(
        () => countConfigurations(parameters ?? [], excludedParameterIds).band,
        [parameters, excludedParameterIds]
    );
    const count = useMemo(
        () => countCombinations(parameters ?? [], excludedParameterIds),
        [parameters, excludedParameterIds]
    );
    const indexable = (parameters ?? []).filter((parameter) =>
        isIndexedParameter(parameter)
    );

    return (
        <>
            <Divider />
            <Stack gap="sm">
                <SectionHeader>Indexing</SectionHeader>
                <IndexingRow
                    insertableId={insertableId}
                    status={status}
                    band={band}
                />
                <ControlRow
                    label="Indexable configurations"
                    control={<ConfigurationCountText count={count} />}
                />
                {indexable.map((parameter) => (
                    <ParameterSwitch
                        key={parameter.id}
                        insertableId={insertableId}
                        excludedParameterIds={excludedParameterIds}
                        parameter={parameter}
                    />
                ))}
            </Stack>
        </>
    );
}

interface IndexingRowProps {
    insertableId: string;
    status: InsertableBuildStatus;
    band: IndexingBand;
}

/** A switch only where enabling is the admin's call; otherwise an icon says why. */
function IndexingRow(props: IndexingRowProps): ReactNode {
    const { insertableId, status, band } = props;
    const mutation = useIndexConfigurationsMutation(insertableId);

    let control: ReactNode;
    if (band === IndexingBand.EXCEEDED) {
        control = (
            <IndexingIcon
                severity={BuildIssueSeverity.ERROR}
                tooltip={`More than ${MAX_PART_NUMBER_CONFIGURATIONS} configurations cannot be indexed. To resolve, stop indexing parameters below.`}
            />
        );
    } else if (band === IndexingBand.AUTOMATIC) {
        control = (
            <IndexingIcon tooltip="Metadata is indexed from every configuration." />
        );
    } else {
        control = (
            <Switch
                size="sm"
                checked={status.indexConfigurations}
                disabled={mutation.isPending}
                onChange={() => mutation.mutate(!status.indexConfigurations)}
                withThumbIndicator={false}
            />
        );
    }

    return (
        <ControlRow
            label="Enable indexing"
            description="Index metadata for search"
            control={control}
        />
    );
}

interface IndexingIconProps {
    severity?: BuildIssueSeverity;
    tooltip: string;
}

/** Reuses the build-check icons so it reads like the callouts. */
function IndexingIcon(props: IndexingIconProps): ReactNode {
    const { severity, tooltip } = props;
    return (
        <Tooltip label={tooltip}>
            <IssueIcon severity={severity} className={styles.noShrink} />
        </Tooltip>
    );
}

interface ConfigurationCountTextProps {
    count: number | undefined;
}

/** Open-ended only past the counting cap, which nothing real reaches. */
function ConfigurationCountText(props: ConfigurationCountTextProps): ReactNode {
    const { count } = props;
    if (count === undefined) {
        return <Text>Over {MAX_COUNTED_CONFIGURATIONS.toLocaleString()}</Text>;
    }
    if (count === 0) {
        return <Text c={StatusColor.DIMMED}>None</Text>;
    }
    return <Text>{count.toLocaleString()}</Text>;
}

interface ParameterSwitchProps {
    insertableId: string;
    excludedParameterIds: string[];
    parameter: ConfigurationParameter;
}

function ParameterSwitch(props: ParameterSwitchProps): ReactNode {
    const { insertableId, excludedParameterIds, parameter } = props;
    const mutation = useExcludedParametersMutation(insertableId);
    const isIndexed = !excludedParameterIds.includes(parameter.id);
    const typeLabel = getParameterTypeLabel(parameter.type);
    const description =
        parameter.type === ParameterType.ENUM
            ? `${typeLabel}, ${parameter.options.length} options`
            : typeLabel;
    return (
        <SwitchRow
            label={`Index ${parameter.name}`}
            description={description}
            checked={isIndexed}
            disabled={mutation.isPending}
            onToggle={() =>
                mutation.mutate(
                    isIndexed
                        ? [...excludedParameterIds, parameter.id]
                        : excludedParameterIds.filter(
                              (id) => id !== parameter.id
                          )
                )
            }
        />
    );
}
