import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { WarningIcon } from "@phosphor-icons/react";
import { AppTitle } from "./app-title";
import { IconSize, StatusColor } from "../lib/style-constants";
import { AppIcon } from "./app-icon";

interface OpenWarningAlertProps {
    title: string;
    text: string;
}

function openWarningAlert(props: OpenWarningAlertProps): void {
    modals.openConfirmModal({
        title: (
            <AppTitle
                icon={
                    <AppIcon
                        icon={WarningIcon}
                        size={IconSize.MEDIUM}
                        color={StatusColor.WARNING}
                    />
                }
                title={props.title}
            />
        ),
        children: (
            <Text data-autofocus tabIndex={-1} size="sm">
                {props.text}
            </Text>
        ),
        labels: { confirm: "Close", cancel: null },
        centered: true,
        cancelProps: { display: "none" },
        confirmProps: { color: "yellow" }
    });
}

export function openCannotDeriveAssemblyAlert(): void {
    openWarningAlert({
        title: "Cannot derive assembly",
        text: "This element is an assembly, which cannot be derived into a part studio."
    });
}

export function openCannotReorderAlert(): void {
    openWarningAlert({
        title: "Cannot reorder favorites",
        text: "To prevent confusion, favorites cannot be reordered while filters are active."
    });
}

export function openCannotEditDefaultConfigurationAlert(): void {
    openWarningAlert({
        title: "Cannot edit configuration",
        text: "This element is not configurable, so its default configuration cannot be changed."
    });
}
