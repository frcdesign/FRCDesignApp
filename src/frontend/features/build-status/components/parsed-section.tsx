import {
    Badge,
    Checkbox,
    Divider,
    Group,
    ScrollArea,
    Stack,
    Text,
    Tooltip
} from "@mantine/core";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import {
    ParameterRoleLabel,
    ROLE_ICONS
} from "../../../components/parameter-role";
import { ReactNode, useMemo } from "react";
import { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import { getVendorName, Vendor } from "@backend/features/library/vendors";
import {
    ConfigurationParameter,
    ParameterType
} from "@backend/features/configurations/contract";
import {
    type ConfigurationCount,
    countCombinations,
    countConfigurations,
    effectiveExclusions,
    MAX_COUNTED_CONFIGURATIONS
} from "@backend/features/configurations/combinations";
import {
    CATEGORY_COLOR,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { AppIcon } from "../../../components/app-icon";
import { SectionHeader } from "./sections";
import { useExcludedParametersMutation } from "../queries";
import { ElementType } from "@backend/lib/onshape/element-type";
import styles from "../../../lib/styles.module.css";

/** Discriminated so `StateValue` renders each kind its own way. */
type StateRowValue =
    | { kind: "bool"; value: boolean }
    | { kind: "text"; text: string; dimmed?: boolean }
    | { kind: "vendors"; vendors: Vendor[] };

/** Enumerated on demand, with the load path's routine, when a hover card opens. */
export function useConfigurationCount(
    status: InsertableBuildStatus
): ConfigurationCount {
    const { elementType, excludedParameterIds } = status;
    const parameters = status.configuration?.parameters;
    return useMemo(
        () =>
            countConfigurations(
                parameters ?? [],
                effectiveExclusions(elementType, excludedParameterIds)
            ),
        [parameters, elementType, excludedParameterIds]
    );
}

/** The true total, which runs past the index cap the band is decided by. */
function useDisplayedConfigurationCount(
    status: InsertableBuildStatus
): number | undefined {
    const { elementType, excludedParameterIds } = status;
    const parameters = status.configuration?.parameters;
    return useMemo(
        () =>
            countCombinations(
                parameters ?? [],
                effectiveExclusions(elementType, excludedParameterIds)
            ),
        [parameters, elementType, excludedParameterIds]
    );
}

/** Open-ended only past the counting cap, which nothing real reaches. */
function configurationCountValue(count: number | undefined): StateRowValue {
    if (count === undefined) {
        return {
            kind: "text",
            text: `Over ${MAX_COUNTED_CONFIGURATIONS.toLocaleString()}`
        };
    }
    if (count === 0) {
        return { kind: "text", text: "None", dimmed: true };
    }
    return { kind: "text", text: count.toLocaleString() };
}

interface InsertableParsedSectionProps {
    status: InsertableBuildStatus;
}

/** The read-only auto-detected facts for an insertable. */
export function InsertableParsedSection(
    props: InsertableParsedSectionProps
): ReactNode {
    const { status } = props;
    const count = useDisplayedConfigurationCount(status);
    return (
        <>
            <Divider />
            <Stack gap={6}>
                <SectionHeader>Parsed</SectionHeader>
                <ParsedRow
                    label="Vendors"
                    value={{ kind: "vendors", vendors: status.vendors }}
                />
                <ParsedRow
                    label="Indexable Configurations"
                    value={configurationCountValue(count)}
                />
            </Stack>
        </>
    );
}

/** Tall enough for a handful of parameters before the list starts scrolling. */
const PARAMETER_LIST_MAX_HEIGHT = 220;

interface ConfigurationSectionProps {
    insertableId: string;
    status: InsertableBuildStatus;
}

/** Each parameter's name, the type it takes, and whether indexing varies it. */
export function ConfigurationSection(
    props: ConfigurationSectionProps
): ReactNode {
    const { insertableId, status } = props;
    const parameters = status.configuration?.parameters;
    if (!parameters || parameters.length === 0) return null;
    return (
        <>
            <Divider />
            <Stack gap={6}>
                <SectionHeader>Configurations</SectionHeader>
                <ScrollArea.Autosize
                    mah={PARAMETER_LIST_MAX_HEIGHT}
                    type="auto"
                >
                    <Stack gap={4}>
                        {parameters.map((parameter) => (
                            <ParameterRow
                                key={parameter.id}
                                insertableId={insertableId}
                                status={status}
                                parameter={parameter}
                            />
                        ))}
                    </Stack>
                </ScrollArea.Autosize>
            </Stack>
        </>
    );
}

interface ParameterRowProps {
    insertableId: string;
    status: InsertableBuildStatus;
    parameter: ConfigurationParameter;
}

/** One parameter: its name, its type, and whether indexing varies it. */
function ParameterRow(props: ParameterRowProps): ReactNode {
    const { parameter } = props;
    return (
        <Group gap="xl" justify="space-between">
            <Text>{parameter.name}</Text>
            <Group gap={6}>
                <ParameterTypeBadge parameter={parameter} />
                <IndexedControl {...props} />
            </Group>
        </Group>
    );
}

/** Only enums and booleans are enumerated, and only a part studio's can be excluded. */
function IndexedControl(props: ParameterRowProps): ReactNode {
    const { insertableId, status, parameter } = props;
    const mutation = useExcludedParametersMutation(insertableId);

    const role = parameter.role;
    if (role) {
        return (
            <Tooltip
                label={
                    <ParameterRoleLabel
                        role={role}
                        suffix=", so never indexed"
                    />
                }
                events={{ hover: true, focus: true, touch: true }}
            >
                <AppIcon
                    icon={ROLE_ICONS[role]}
                    size={IconSize.SMALL}
                    color={StatusColor.DIMMED}
                    className={styles.noShrink}
                />
            </Tooltip>
        );
    }
    if (
        parameter.type !== ParameterType.ENUM &&
        parameter.type !== ParameterType.BOOLEAN
    ) {
        return null;
    }
    if (status.elementType === ElementType.ASSEMBLY) {
        return null;
    }

    const excluded = status.excludedParameterIds;
    const isIndexed = !excluded.includes(parameter.id);
    return (
        <Tooltip label={isIndexed ? "Indexed" : "Not indexed"}>
            <Checkbox
                size="xs"
                checked={isIndexed}
                disabled={mutation.isPending}
                onChange={() =>
                    mutation.mutate(
                        isIndexed
                            ? [...excluded, parameter.id]
                            : excluded.filter((id) => id !== parameter.id)
                    )
                }
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
        ? `${getParameterTypeLabel(parameter.type)} (${parameter.options.length})`
        : getParameterTypeLabel(parameter.type);

    const badge = (
        <Badge size="xs" color={CATEGORY_COLOR}>
            {label}
        </Badge>
    );
    if (!isEnum || parameter.options.length === 0) {
        return badge;
    }
    return (
        <Tooltip
            label={parameter.options.map((option) => option.name).join(", ")}
            events={{ hover: true, focus: true, touch: true }}
        >
            {badge}
        </Tooltip>
    );
}

/** The short label for a parameter's type, shown as a badge. */
function getParameterTypeLabel(type: ParameterType): string {
    switch (type) {
        case ParameterType.ENUM:
            return "Enum";
        case ParameterType.BOOLEAN:
            return "Boolean";
        case ParameterType.QUANTITY:
            return "Quantity";
        case ParameterType.STRING:
            return "Text";
    }
}

interface ParsedRowProps {
    label: string;
    value: StateRowValue;
}

/** A read-only label/value row in the "Parsed" section. */
function ParsedRow(props: ParsedRowProps): ReactNode {
    const { label, value } = props;
    return (
        <Group gap="xl" justify="space-between">
            <Text>{label}</Text>
            <StateValue value={value} />
        </Group>
    );
}

interface StateValueProps {
    value: StateRowValue;
}

/** Renders a parsed value: a check/cross for booleans, badges for vendors. */
function StateValue(props: StateValueProps): ReactNode {
    const { value } = props;
    if (value.kind === "bool") {
        return value.value ? (
            <AppIcon
                icon={CheckIcon}
                size={IconSize.SMALL}
                color={StatusColor.SUCCESS}
            />
        ) : (
            <AppIcon
                icon={XIcon}
                size={IconSize.SMALL}
                color={StatusColor.ERROR}
            />
        );
    }

    if (value.kind === "text") {
        return (
            <Text c={value.dimmed ? "dimmed" : undefined}>{value.text}</Text>
        );
    }

    if (value.vendors.length === 0) {
        return <Text c={StatusColor.DIMMED}>None</Text>;
    }
    return (
        <Group gap={4} wrap="wrap" justify="flex-end">
            {value.vendors.map((vendor) => (
                <Badge
                    key={vendor}
                    color={StatusColor.INFO}
                    title={getVendorName(vendor)}
                >
                    {vendor}
                </Badge>
            ))}
        </Group>
    );
}
