import {
    Badge,
    Button,
    Center,
    Checkbox,
    Group,
    ScrollArea,
    Stack,
    Switch,
    Table,
    Text,
    Tooltip
} from "@mantine/core";
import { ReactNode, useMemo } from "react";
import { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import {
    ParameterType,
    type ConfigurationParameter
} from "@backend/features/configurations/contract";
import {
    AUTO_INDEX_THRESHOLD,
    countCombinations,
    countConfigurations,
    IndexingBand,
    isIndexedParameter,
    MAX_COUNTED_CONFIGURATIONS,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "@backend/features/configurations/combinations";
import {
    ParameterRoleIcon,
    ParameterRoleLabel
} from "../../../components/parameter-role";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { useIndexingMutation } from "../queries";
import {
    clearIndexingDraft,
    editIndexingDraft,
    type IndexingView,
    useIndexingView
} from "../indexing-draft";
import { ControlRow } from "./sections";
import { IssueIcon } from "./issues";
import { CardSection } from "./card-section";
import { CardSectionId } from "../card-section-id";
import { getParameterTypeLabel } from "../parameter-type-label";
import styles from "../../../lib/styles.module.css";

/** Tall enough for a handful of parameters before the table starts scrolling. */
const TABLE_MAX_HEIGHT = 240;

/** Fits "Enum · 12", the widest type badge. Both short columns centre under their headings. */
const TYPE_COLUMN_WIDTH = 84;

/** Fits the "Indexed" heading. */
const INDEXED_COLUMN_WIDTH = 64;

interface ConfigurationSectionProps {
    insertableId: string;
    status: InsertableBuildStatus;
    parameters: ConfigurationParameter[];
}

/**
 * Every parameter, with whether search indexes it. Edits collect as a draft
 * and save in one reindex.
 */
export function ConfigurationSection(
    props: ConfigurationSectionProps
): ReactNode {
    const { insertableId, status, parameters } = props;
    const view = useIndexingView(insertableId, status);
    return (
        <CardSection
            id={CardSectionId.CONFIGURATION}
            title="Configuration"
            actions={
                <SectionSummary
                    parameterCount={parameters.length}
                    changeCount={view.changeCount}
                />
            }
        >
            <ConfigurationEditor
                insertableId={insertableId}
                status={status}
                parameters={parameters}
                view={view}
            />
        </CardSection>
    );
}

interface SectionSummaryProps {
    parameterCount: number;
    changeCount: number;
}

/** Unsaved edits show here, so they are noticed with the section closed. */
function SectionSummary(props: SectionSummaryProps): ReactNode {
    const { parameterCount, changeCount } = props;
    if (changeCount > 0) {
        return (
            <Badge color={StatusColor.WARNING} className={styles.noShrink}>
                {changeCount} unsaved
            </Badge>
        );
    }
    return (
        <Text size="xs" c={StatusColor.DIMMED} className={styles.noShrink}>
            {parameterCount === 1
                ? "1 parameter"
                : `${parameterCount} parameters`}
        </Text>
    );
}

interface ConfigurationEditorProps extends ConfigurationSectionProps {
    view: IndexingView;
}

function ConfigurationEditor(props: ConfigurationEditorProps): ReactNode {
    const { insertableId, status, parameters, view } = props;
    const { excludedParameterIds } = view;

    // Counted with the load's own routine, so the card and the load agree.
    const band = useMemo(
        () => countConfigurations(parameters, excludedParameterIds).band,
        [parameters, excludedParameterIds]
    );
    const count = useMemo(
        () => countCombinations(parameters, excludedParameterIds),
        [parameters, excludedParameterIds]
    );

    const toggleParameter = (parameterId: string) => {
        const isExcluded = excludedParameterIds.includes(parameterId);
        editIndexingDraft(insertableId, status, {
            excludedParameterIds: isExcluded
                ? excludedParameterIds.filter((id) => id !== parameterId)
                : [...excludedParameterIds, parameterId]
        });
    };

    return (
        <Stack gap="sm">
            <ControlRow
                label="Index configurations"
                description={describeCount(count, band)}
                control={
                    <IndexingControl
                        band={band}
                        checked={view.indexConfigurations}
                        onToggle={() =>
                            editIndexingDraft(insertableId, status, {
                                indexConfigurations: !view.indexConfigurations
                            })
                        }
                    />
                }
            />
            <ScrollArea.Autosize mah={TABLE_MAX_HEIGHT} type="auto">
                <Table
                    layout="fixed"
                    withRowBorders={false}
                    verticalSpacing={4}
                    horizontalSpacing={0}
                >
                    <Table.Thead>
                        {/* The weight of the card's other labels, not Mantine's bold. */}
                        <Table.Tr c={StatusColor.DIMMED}>
                            <Table.Th fw={FontWeight.SEMI_BOLD}>
                                Parameter
                            </Table.Th>
                            <Table.Th
                                w={TYPE_COLUMN_WIDTH}
                                fw={FontWeight.SEMI_BOLD}
                                ta="center"
                            >
                                Type
                            </Table.Th>
                            <Table.Th
                                w={INDEXED_COLUMN_WIDTH}
                                fw={FontWeight.SEMI_BOLD}
                                ta="center"
                            >
                                Indexed
                            </Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {parameters.map((parameter) => (
                            <ParameterRow
                                key={parameter.id}
                                parameter={parameter}
                                isIndexed={isIndexedParameter(
                                    parameter,
                                    excludedParameterIds
                                )}
                                onToggle={() => toggleParameter(parameter.id)}
                            />
                        ))}
                    </Table.Tbody>
                </Table>
            </ScrollArea.Autosize>
            <SaveButtons insertableId={insertableId} view={view} />
        </Stack>
    );
}

function describeCount(count: number | undefined, band: IndexingBand): string {
    if (count === undefined) {
        return `Over ${MAX_COUNTED_CONFIGURATIONS.toLocaleString()} configurations`;
    }
    if (count === 0) {
        return "Nothing to index";
    }
    const counted =
        count === 1
            ? "1 configuration"
            : `${count.toLocaleString()} configurations`;
    switch (band) {
        case IndexingBand.AUTOMATIC:
            return `${counted}, indexed automatically`;
        case IndexingBand.MANUAL:
            return counted;
        case IndexingBand.EXCEEDED:
            return `${counted}, over the limit of ${MAX_PART_NUMBER_CONFIGURATIONS}`;
    }
}

interface IndexingControlProps {
    band: IndexingBand;
    checked: boolean;
    onToggle: () => void;
}

/** A switch only where enabling is the admin's call; otherwise an icon says why. */
function IndexingControl(props: IndexingControlProps): ReactNode {
    const { band, checked, onToggle } = props;
    if (band === IndexingBand.EXCEEDED) {
        return (
            <BandIcon
                severity={BuildIssueSeverity.ERROR}
                tooltip={`At most ${MAX_PART_NUMBER_CONFIGURATIONS} configurations can be indexed. Uncheck parameters until it is under the limit.`}
            />
        );
    }
    if (band === IndexingBand.AUTOMATIC) {
        return (
            <BandIcon
                tooltip={`Under ${AUTO_INDEX_THRESHOLD}, so every load indexes it.`}
            />
        );
    }
    return (
        <Switch
            size="sm"
            checked={checked}
            onChange={onToggle}
            withThumbIndicator={false}
        />
    );
}

interface BandIconProps {
    severity?: BuildIssueSeverity;
    tooltip: string;
}

/** The build-check icons, so it reads like the callouts. */
function BandIcon(props: BandIconProps): ReactNode {
    const { severity, tooltip } = props;
    return (
        <Tooltip label={tooltip} multiline maw={240}>
            <IssueIcon severity={severity} className={styles.noShrink} />
        </Tooltip>
    );
}

interface ParameterRowProps {
    parameter: ConfigurationParameter;
    isIndexed: boolean;
    onToggle: () => void;
}

function ParameterRow(props: ParameterRowProps): ReactNode {
    const { parameter, isIndexed, onToggle } = props;
    return (
        <Table.Tr>
            <Table.Td pr="xs">
                <Text truncate title={parameter.name}>
                    {parameter.name}
                </Text>
            </Table.Td>
            <Table.Td>
                <Center>
                    <ParameterKind parameter={parameter} />
                </Center>
            </Table.Td>
            <Table.Td>
                <Center>
                    <IndexCheckbox
                        parameter={parameter}
                        checked={isIndexed}
                        onToggle={onToggle}
                    />
                </Center>
            </Table.Td>
        </Table.Tr>
    );
}

interface IndexCheckboxProps {
    parameter: ConfigurationParameter;
    checked: boolean;
    onToggle: () => void;
}

/** Disabled for a parameter search never varies, with the reason on hover. */
function IndexCheckbox(props: IndexCheckboxProps): ReactNode {
    const { parameter, checked, onToggle } = props;
    if (isIndexedParameter(parameter)) {
        return <Checkbox size="xs" checked={checked} onChange={onToggle} />;
    }
    const reason = parameter.role ? (
        <ParameterRoleLabel
            role={parameter.role}
            suffix=", so never indexed."
        />
    ) : (
        `${getParameterTypeLabel(parameter.type)} parameters aren't indexed.`
    );
    return (
        <Tooltip label={reason}>
            <Checkbox size="xs" checked={false} disabled readOnly />
        </Tooltip>
    );
}

interface ParameterKindProps {
    parameter: ConfigurationParameter;
}

/**
 * A role says more than the type it implies, and the parameter's name usually
 * spells it already, so a role's badge holds only its icon.
 */
function ParameterKind(props: ParameterKindProps): ReactNode {
    const { parameter } = props;
    const { role } = parameter;
    if (role) {
        return (
            <Tooltip label={<ParameterRoleLabel role={role} />}>
                <Badge size="xs">
                    {/* A block, or it sits on the label's baseline, high in the pill. */}
                    <ParameterRoleIcon
                        role={role}
                        size={IconSize.TINY}
                        style={{ display: "block" }}
                    />
                </Badge>
            </Tooltip>
        );
    }
    return <ParameterTypeBadge parameter={parameter} />;
}

interface ParameterTypeBadgeProps {
    parameter: ConfigurationParameter;
}

/** An enum lists its options on hover. */
function ParameterTypeBadge(props: ParameterTypeBadgeProps): ReactNode {
    const { parameter } = props;
    const isEnum = parameter.type === ParameterType.ENUM;
    const label = isEnum
        ? `${getParameterTypeLabel(parameter.type)} · ${parameter.options.length}`
        : getParameterTypeLabel(parameter.type);

    const badge = <Badge size="xs">{label}</Badge>;
    if (!isEnum || parameter.options.length === 0) {
        return badge;
    }
    return (
        <Tooltip
            label={parameter.options.map((option) => option.name).join(", ")}
            multiline
            maw={260}
        >
            {badge}
        </Tooltip>
    );
}

interface SaveButtonsProps {
    insertableId: string;
    view: IndexingView;
}

/** Always shown, and disabled with nothing to save, so the form keeps its shape. */
function SaveButtons(props: SaveButtonsProps): ReactNode {
    const { insertableId, view } = props;
    const mutation = useIndexingMutation(insertableId);
    const hasChanges = view.changeCount > 0;

    const save = () => {
        mutation.mutate(view.change);
        clearIndexingDraft(insertableId);
    };

    return (
        <Group justify="flex-end" gap="xs">
            <Button
                size="xs"
                variant="default"
                disabled={!hasChanges}
                onClick={() => clearIndexingDraft(insertableId)}
            >
                Discard
            </Button>
            <Button
                size="xs"
                variant="filled"
                disabled={!hasChanges}
                onClick={save}
            >
                Save
            </Button>
        </Group>
    );
}
