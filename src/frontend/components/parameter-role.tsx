import { Group, Text } from "@mantine/core";
import {
    GitForkIcon,
    type Icon,
    PaletteIcon,
    PolygonIcon,
    SwatchesIcon
} from "@phosphor-icons/react";
import { ReactNode } from "react";
import { ParameterRole } from "@backend/features/configurations/contract";
import { IconSize } from "../lib/style-constants";
import { AppIcon, type AppIconProps } from "./app-icon";

const ROLE_LABELS: Record<ParameterRole, string> = {
    [ParameterRole.DERIVATION_VARIABLE]: "Derivation variable",
    [ParameterRole.COLOR]: "Color",
    [ParameterRole.COLOR_CHANNEL]: "Color channel",
    [ParameterRole.TESSELLATION]: "Tessellation quality"
};

const ROLE_ICONS: Record<ParameterRole, Icon> = {
    [ParameterRole.DERIVATION_VARIABLE]: GitForkIcon,
    [ParameterRole.COLOR]: PaletteIcon,
    [ParameterRole.COLOR_CHANNEL]: SwatchesIcon,
    [ParameterRole.TESSELLATION]: PolygonIcon
};

interface ParameterRoleIconProps extends Omit<AppIconProps, "icon"> {
    role: ParameterRole;
}

export function ParameterRoleIcon(props: ParameterRoleIconProps): ReactNode {
    const { role, ...others } = props;
    return <AppIcon icon={ROLE_ICONS[role]} {...others} />;
}

interface ParameterRoleLabelProps {
    role: ParameterRole;
    /** What follows the role's name, e.g. ", so never indexed." */
    suffix?: string;
}

/** A role's icon and name, for a tooltip. */
export function ParameterRoleLabel(props: ParameterRoleLabelProps): ReactNode {
    const { role, suffix = "" } = props;
    const RoleIcon = ROLE_ICONS[role];
    return (
        <Group gap={6}>
            <RoleIcon size={IconSize.SMALL} />
            <Text inherit>{ROLE_LABELS[role] + suffix}</Text>
        </Group>
    );
}
