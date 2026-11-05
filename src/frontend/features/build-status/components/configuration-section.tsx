import {
    Badge,
    Button,
    Center,
    Checkbox,
    Group,
    ScrollArea,
    Stack,
    Table,
    Text,
    Tooltip
} from "@mantine/core";
import { ReactNode, useMemo } from "react";
import { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import {
    ParameterType,
    type ConfigurationParameter,
    type EnumParameter
} from "@backend/features/configurations/contract";
import {
    bandOf,
    countCombinations,
    IndexingBand,
    isIndexedParameter,
    MAX_COUNTED_CONFIGURATIONS,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "@backend/features/configurations/combinations";
import {
    ParameterRoleIcon,
    ParameterRoleLabel
} from "../../../components/parameter-role";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { useIndexingMutation } from "../queries";
import {
    clearIndexingDraft,
    editIndexingDraft,
    type IndexingView,
    useIndexingView
} from "../indexing-draft";
import { RowSwitch } from "./sections";
import {
    AppHoverBubble,
    HoverBubbleRow
} from "../../../components/app-hover-bubble";
import { IssueIcon } from "./issues";
import { CardSection } from "./card-section";
import { SectionId } from "../../../lib/ui-state";
import { getParameterTypeLabel } from "../parameter-type-label";
import { m } from "../../../paraglide/messages";
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
    /** Not empty: an element without parameters has no section. */
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
            id={SectionId.CONFIGURATION}
            title={m.adminCardConfiguration()}
            actions={<UnsavedBadge isUnsaved={view.isUnsaved} />}
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

interface UnsavedBadgeProps {
    isUnsaved: boolean;
}

/** In the header, so unsaved edits are noticed with the section closed. */
function UnsavedBadge(props: UnsavedBadgeProps): ReactNode {
    if (!props.isUnsaved) return null;
    return (
        <Badge color={StatusColor.WARNING} className={styles.noShrink}>
            {m.adminCardUnsaved()}
        </Badge>
    );
}

interface ConfigurationEditorProps extends ConfigurationSectionProps {
    view: IndexingView;
}

function ConfigurationEditor(props: ConfigurationEditorProps): ReactNode {
    const { insertableId, status, parameters, view } = props;
    const { excludedParameterIds } = view;

    // Banded as the load bands it, so the card and the load agree.
    const count = useMemo(
        () => countCombinations(parameters, excludedParameterIds),
        [parameters, excludedParameterIds]
    );
    const band = bandOf(count);

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
            <HoverBubbleRow
                label={m.adminCardIndexConfigurations()}
                description={describeCount(count, band)}
            >
                <IndexingControl
                    band={band}
                    checked={view.indexConfigurations}
                    onToggle={() =>
                        editIndexingDraft(insertableId, status, {
                            indexConfigurations: !view.indexConfigurations
                        })
                    }
                />
            </HoverBubbleRow>
            <ScrollArea.Autosize mah={TABLE_MAX_HEIGHT} type="auto">
                <Table
                    layout="fixed"
                    withRowBorders={false}
                    verticalSpacing={4}
                    horizontalSpacing={0}
                >
                    <Table.Thead>
                        <Table.Tr c={StatusColor.DIMMED}>
                            <Table.Th>{m.adminCardParameter()}</Table.Th>
                            <Table.Th w={TYPE_COLUMN_WIDTH} ta="center">
                                {m.adminCardType()}
                            </Table.Th>
                            <Table.Th w={INDEXED_COLUMN_WIDTH} ta="center">
                                {m.adminCardIndexed()}
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
        return m.adminCardCountUncounted({ max: MAX_COUNTED_CONFIGURATIONS });
    }
    if (count === 0) {
        return m.adminCardCountNothing();
    }
    switch (band) {
        case IndexingBand.AUTOMATIC:
            return m.adminCardCountAutomatic({ count });
        case IndexingBand.MANUAL:
            return m.adminCardCountManual({ count });
        case IndexingBand.EXCEEDED:
            return m.adminCardCountExceeded({
                count,
                max: MAX_PART_NUMBER_CONFIGURATIONS
            });
    }
}

interface IndexingControlProps {
    band: IndexingBand;
    checked: boolean;
    onToggle: () => void;
}

/** A switch only where enabling is the admin's call; otherwise the build-check icon for the band. */
function IndexingControl(props: IndexingControlProps): ReactNode {
    const { band, checked, onToggle } = props;
    if (band === IndexingBand.EXCEEDED) {
        return (
            <Tooltip
                label={m.adminCardIndexLimit({
                    max: MAX_PART_NUMBER_CONFIGURATIONS
                })}
            >
                <IssueIcon
                    severity={BuildIssueSeverity.ERROR}
                    className={styles.noShrink}
                />
            </Tooltip>
        );
    }
    if (band === IndexingBand.AUTOMATIC) {
        return <IssueIcon className={styles.noShrink} />;
    }
    return <RowSwitch checked={checked} onToggle={onToggle} />;
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
            suffix={m.adminCardRoleNotIndexed()}
        />
    ) : (
        m.adminCardTypeNotIndexed({
            type: getParameterTypeLabel(parameter.type)
        })
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
                {/* No line of text to sit on, so the icon centres. */}
                <Badge size="xs" lh={0}>
                    <ParameterRoleIcon role={role} size={IconSize.TINY} />
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
    if (
        parameter.type !== ParameterType.ENUM ||
        parameter.options.length === 0
    ) {
        return <Badge size="xs">{getParameterTypeLabel(parameter.type)}</Badge>;
    }
    return (
        <AppHoverBubble
            padding="sm"
            below
            target={
                <Badge size="xs">
                    {m.adminCardEnumBadge({
                        type: getParameterTypeLabel(parameter.type),
                        count: parameter.options.length
                    })}
                </Badge>
            }
        >
            <EnumOptions parameter={parameter} />
        </AppHoverBubble>
    );
}

interface EnumOptionsProps {
    parameter: EnumParameter;
}

function EnumOptions(props: EnumOptionsProps): ReactNode {
    const { parameter } = props;
    return (
        <Stack gap={4}>
            {parameter.options.map((option) => (
                <Group key={option.id} gap="xs" wrap="nowrap">
                    <Text size="sm">{option.name}</Text>
                    {option.id === parameter.default && (
                        <Text size="xs" c={StatusColor.DIMMED}>
                            {m.adminCardDefaultOption()}
                        </Text>
                    )}
                </Group>
            ))}
        </Stack>
    );
}

interface SaveButtonsProps {
    insertableId: string;
    view: IndexingView;
}

/** Only while edits are pending. */
function SaveButtons(props: SaveButtonsProps): ReactNode {
    const { insertableId, view } = props;
    const mutation = useIndexingMutation(insertableId);

    const save = () => {
        mutation.mutate({
            indexConfigurations: view.indexConfigurations,
            excludedParameterIds: view.excludedParameterIds
        });
        clearIndexingDraft(insertableId);
    };

    if (!view.isUnsaved) {
        return null;
    }
    return (
        <Group justify="flex-end" gap="xs">
            <Button
                size="xs"
                variant="default"
                onClick={() => clearIndexingDraft(insertableId)}
            >
                {m.adminCardDiscard()}
            </Button>
            <Button size="xs" variant="filled" onClick={save}>
                {m.adminCardSave()}
            </Button>
        </Group>
    );
}
