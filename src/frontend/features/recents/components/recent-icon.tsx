import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { AppIcon } from "../../../components/app-icon";
import { IconSize, PrimaryColor } from "../../../lib/style-constants";

interface RecentIconProps {
    /** @default IconSize.SMALL */
    size?: IconSize;
}

export function RecentIcon(props: RecentIconProps): ReactNode {
    const { size = IconSize.SMALL } = props;
    return (
        <AppIcon
            icon={ClockCounterClockwiseIcon}
            size={size}
            color={PrimaryColor.FILLED}
        />
    );
}
