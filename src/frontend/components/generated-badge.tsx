import { Tooltip } from "@mantine/core";
import { CodeIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { AppIcon } from "./app-icon";
import { IconSize, StatusColor } from "../lib/style-constants";
import { m } from "../paraglide/messages";

/** Marks a part FeatureScript generates, whose configurations and part numbers come from its code. */
export function GeneratedBadge(): ReactNode {
    return (
        <Tooltip label={m.generatedBadgeTooltip()}>
            <AppIcon
                icon={CodeIcon}
                size={IconSize.SMALL}
                color={StatusColor.INFO}
            />
        </Tooltip>
    );
}
