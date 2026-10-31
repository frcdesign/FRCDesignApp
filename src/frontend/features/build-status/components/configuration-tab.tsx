import {
    Badge,
    Button,
    Checkbox,
    Group,
    ScrollArea,
    Stack,
    Switch,
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
    CATEGORY_COLOR,
    FontWeight,
    IconSize,
    PrimaryColor,
    StatusColor
} from "../../../lib/style-constants";
import { useIndexingMutation } from "../queries";
import {
    clearIndexingDraft,
    editIndexingDraft,
    type IndexingView,
    useIndexingView
} from "../indexing-draft";
import { ControlRow, SectionHeader } from "./sections";
import { IssueIcon } from "./issues";
import { getParameterTypeLabel } from "../parameter-type-label";
import styles from "../../../lib/styles.module.css";

/** Tall enough for a handful of parameters before the list starts scrolling. */
const PARAMETER_LIST_MAX_HEIGHT = 240;

interface ConfigurationTabProps {
    insertableId: string;
    status: InsertableBuildStatus;
    parameters: ConfigurationParameter[];
}

/**
 * Every parameter, with whether search indexes it. Edits collect as a draft
 * and apply in one reindex.
 */
export function ConfigurationTab(props: ConfigurationTabProps): ReactNode {
    const { insertableId, status, parameters } = props;
    const view = useIndexingView(insertableId, status);
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
            <Stack gap={4}>
                <Group justify="space-between" gap="xs">
                    <SectionHeader>Parameters</SectionHeader>
                    <SectionHeader>Indexed</SectionHeader>
                </Group>
                <ScrollArea.Autosize
                    mah={PARAMETER_LIST_MAX_HEIGHT}
                    type="auto"
                    offsetScrollbars="y"
                >
                    <Stack gap={2}>
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
                    </Stack>
                </ScrollArea.Autosize>
            </Stack>
            <ApplyBar insertableId={insertableId} view={view} />
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
        <Group gap="xs" mih={26}>
            <Text truncate title={parameter.name} flex={1} miw={0}>
                {parameter.name}
            </Text>
            <RoleIcon parameter={parameter} />
            <ParameterTypeBadge parameter={parameter} />
            <IndexCheckbox
                parameter={parameter}
                checked={isIndexed}
                onToggle={onToggle}
            />
        </Group>
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
        return (
            <Checkbox
                size="xs"
                checked={checked}
                onChange={onToggle}
                className={styles.noShrink}
            />
        );
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
            <Checkbox
                size="xs"
                checked={false}
                disabled
                readOnly
                className={styles.noShrink}
            />
        </Tooltip>
    );
}

interface RoleIconProps {
    parameter: ConfigurationParameter;
}

function RoleIcon(props: RoleIconProps): ReactNode {
    const role = props.parameter.role;
    if (!role) return null;
    return (
        <Tooltip label={<ParameterRoleLabel role={role} />}>
            <ParameterRoleIcon
                role={role}
                size={IconSize.SMALL}
                color={StatusColor.DIMMED}
                className={styles.noShrink}
            />
        </Tooltip>
    );
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

    const badge = (
        <Badge size="xs" color={CATEGORY_COLOR} className={styles.noShrink}>
            {label}
        </Badge>
    );
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

interface ApplyBarProps {
    insertableId: string;
    view: IndexingView;
}

/** Shown while there is something to apply. */
function ApplyBar(props: ApplyBarProps): ReactNode {
    const { insertableId, view } = props;
    const mutation = useIndexingMutation(insertableId);
    if (view.changeCount === 0) return null;

    const apply = () => {
        mutation.mutate(view.change);
        clearIndexingDraft(insertableId);
    };

    return (
        <Group
            justify="space-between"
            gap="xs"
            p="xs"
            bg={PrimaryColor.LIGHT}
            bdrs="sm"
        >
            <Text size="sm" fw={FontWeight.SEMI_BOLD}>
                {view.changeCount === 1
                    ? "1 change"
                    : `${view.changeCount} changes`}
            </Text>
            <Group gap={6}>
                <Button
                    size="compact-sm"
                    variant="subtle"
                    color={StatusColor.NEUTRAL}
                    onClick={() => clearIndexingDraft(insertableId)}
                >
                    Discard
                </Button>
                <Button size="compact-sm" variant="filled" onClick={apply}>
                    Apply and reindex
                </Button>
            </Group>
        </Group>
    );
}
