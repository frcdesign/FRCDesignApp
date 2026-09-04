import {
    Badge,
    Divider,
    Group,
    ScrollArea,
    Stack,
    Text,
    Tooltip
} from "@mantine/core";
import { CheckIcon, FileXIcon, XIcon } from "@phosphor-icons/react";
import { ReactNode, useMemo } from "react";
import { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import { getVendorName, Vendor } from "@backend/features/library/vendors";
import {
    ConfigurationParameter,
    ParameterType
} from "@backend/features/configurations/models";
import {
    type ConfigurationCount,
    countCombinations,
    countConfigurations,
    MAX_COUNTED_CONFIGURATIONS
} from "@backend/features/configurations/combinations";
import { IconSize, NO_SHRINK, StatusColor } from "../../../lib/style-constants";
import { AppIcon } from "../../../components/app-icon";
import { SectionHeader } from "./sections";

/** Discriminated so `StateValue` renders each kind its own way. */
type StateRowValue =
    | { kind: "bool"; value: boolean }
    | { kind: "text"; text: string; dimmed?: boolean }
    | { kind: "vendors"; vendors: Vendor[] };

/**
 * Enumerated rather than stored: the same shared routine the load path uses,
 * and it only runs when a hover card opens.
 */
export function useConfigurationCount(
    status: InsertableBuildStatus
): ConfigurationCount {
    const parameters = status.configuration?.parameters;
    return useMemo(() => countConfigurations(parameters ?? []), [parameters]);
}

/** The true total, which runs past the index cap the band is decided by. */
function useDisplayedConfigurationCount(
    status: InsertableBuildStatus
): number | null {
    const parameters = status.configuration?.parameters;
    return useMemo(() => countCombinations(parameters ?? []), [parameters]);
}

/** Open-ended only past the counting cap, which nothing real reaches. */
function configurationCountValue(count: number | null): StateRowValue {
    if (count === null) {
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
                    label="Configurations"
                    value={configurationCountValue(count)}
                />
            </Stack>
        </>
    );
}

interface ConfigurationSectionProps {
    parameters?: ConfigurationParameter[];
}

/** Each parameter's name, the type it takes, and whether indexing varies it. */
export function ConfigurationSection(
    props: ConfigurationSectionProps
): ReactNode {
    const { parameters } = props;
    if (!parameters || parameters.length === 0) return null;
    return (
        <>
            <Divider />
            <Stack gap={6}>
                <SectionHeader>Configurations</SectionHeader>
                <ScrollArea.Autosize mah={220} type="auto">
                    <Stack gap={4}>
                        {parameters.map((parameter) => (
                            <Group
                                key={parameter.id}
                                gap="xl"
                                wrap="nowrap"
                                justify="space-between"
                            >
                                <Text size="sm">{parameter.name}</Text>
                                <Group gap={4} wrap="nowrap">
                                    <ExcludedFromPropertiesIcon
                                        parameter={parameter}
                                    />
                                    <ParameterTypeBadge parameter={parameter} />
                                </Group>
                            </Group>
                        ))}
                    </Stack>
                </ScrollArea.Autosize>
            </Stack>
        </>
    );
}

interface ExcludedFromPropertiesIconProps {
    parameter: ConfigurationParameter;
}

/**
 * Onshape's "exclude from affecting configured properties", the lever on the
 * count. Part studios only, which Onshape itself enforces.
 */
function ExcludedFromPropertiesIcon(
    props: ExcludedFromPropertiesIconProps
): ReactNode {
    const { parameter } = props;
    if (!parameter.isCosmetic) {
        return null;
    }
    return (
        <Tooltip
            label="Excluded from affecting part properties in Onshape"
            multiline
            maw={260}
            withArrow
            events={{ hover: true, focus: true, touch: true }}
        >
            <AppIcon
                icon={FileXIcon}
                size={IconSize.SMALL}
                color={StatusColor.DIMMED}
                style={NO_SHRINK}
            />
        </Tooltip>
    );
}

interface ParameterTypeBadgeProps {
    parameter: ConfigurationParameter;
}

/**
 * The parameter's type. An enum also carries its option count, and lists the
 * options on hover — the values that drive its share of the configuration count.
 */
function ParameterTypeBadge(props: ParameterTypeBadgeProps): ReactNode {
    const { parameter } = props;
    const isEnum = parameter.type === ParameterType.ENUM;
    const label = isEnum
        ? `${getParameterTypeLabel(parameter.type)} (${parameter.options.length})`
        : getParameterTypeLabel(parameter.type);

    const badge = (
        <Badge size="xs" variant="light" color={StatusColor.NEUTRAL}>
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
            withArrow
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
        <Group gap="xl" wrap="nowrap" justify="space-between">
            <Text size="sm">{label}</Text>
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
            <Text size="sm" c={value.dimmed ? "dimmed" : undefined}>
                {value.text}
            </Text>
        );
    }

    if (value.vendors.length === 0) {
        return (
            <Text size="sm" c={StatusColor.DIMMED}>
                None
            </Text>
        );
    }
    return (
        <Group gap={4} wrap="wrap" justify="flex-end">
            {value.vendors.map((vendor) => (
                <Badge
                    key={vendor}
                    size="sm"
                    variant="light"
                    color={StatusColor.INFO}
                    title={getVendorName(vendor)}
                >
                    {vendor}
                </Badge>
            ))}
        </Group>
    );
}
