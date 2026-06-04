import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";

interface OpenWarningAlertProps {
    title: string;
    text: string;
}

function openWarningAlert(props: OpenWarningAlertProps): void {
    modals.openConfirmModal({
        title: props.title,
        children: <Text size="sm">{props.text}</Text>,
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
        title: "Cannot reorder favorties",
        text: "To prevent confusion, favorites cannot be reordered while filters are active."
    });
}

export function openCannotEditDefaultConfigurationAlert(): void {
    openWarningAlert({
        title: "Cannot edit configuration",
        text: "This element is not configurable, so its default configuration cannot be changed."
    });
}
