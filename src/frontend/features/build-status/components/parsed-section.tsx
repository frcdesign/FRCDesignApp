import {
    Badge,
    Divider,
    Group,
    ScrollArea,
    Stack,
    Text,
    Tooltip
} from "@mantine/core";
import {
    ParameterRoleLabel,
    ROLE_ICONS
} from "../../../components/parameter-role";
import { ReactNode } from "react";
import { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import { getVendorName, Vendor } from "@backend/features/library/vendors";
import {
    ConfigurationParameter,
    ParameterType
} from "@backend/features/configurations/contract";
import {
    CATEGORY_COLOR,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { AppIcon } from "../../../components/app-icon";
import { SectionHeader } from "./sections";
import styles from "../../../lib/styles.module.css";

interface InsertableParsedSectionProps {
    status: InsertableBuildStatus;
}

/** The read-only auto-detected facts for an insertable. */
export function InsertableParsedSection(
    props: InsertableParsedSectionProps
): ReactNode {
    const { status } = props;
    return (
        <>
            <Divider />
            <Stack gap={6}>
                <SectionHeader>Parsed</SectionHeader>
                <Group gap="xl" justify="space-between">
                    <Text>Vendors</Text>
                    <VendorBadges vendors={status.vendors} />
                </Group>
            </Stack>
        </>
    );
}

/** Tall enough for a handful of parameters before the list starts scrolling. */
const PARAMETER_LIST_MAX_HEIGHT = 220;

interface ConfigurationSectionProps {
    status: InsertableBuildStatus;
}

/** Each parameter's name and the type it takes. */
export function ConfigurationSection(
    props: ConfigurationSectionProps
): ReactNode {
    const { status } = props;
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
    parameter: ConfigurationParameter;
}

function ParameterRow(props: ParameterRowProps): ReactNode {
    const { parameter } = props;
    return (
        <Group gap="xl" justify="space-between">
            <Text>{parameter.name}</Text>
            <Group gap={6}>
                <ParameterTypeBadge parameter={parameter} />
                <RoleIcon parameter={parameter} />
            </Group>
        </Group>
    );
}

interface RoleIconProps {
    parameter: ConfigurationParameter;
}

function RoleIcon(props: RoleIconProps): ReactNode {
    const role = props.parameter.role;
    if (!role) return null;
    return (
        <Tooltip
            label={
                <ParameterRoleLabel role={role} suffix=", so never indexed" />
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
export function getParameterTypeLabel(type: ParameterType): string {
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

interface VendorBadgesProps {
    vendors: Vendor[];
}

function VendorBadges(props: VendorBadgesProps): ReactNode {
    const { vendors } = props;
    if (vendors.length === 0) {
        return <Text c={StatusColor.DIMMED}>None</Text>;
    }
    return (
        <Group gap={4} wrap="wrap" justify="flex-end">
            {vendors.map((vendor) => (
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
