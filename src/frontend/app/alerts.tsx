import { modals } from "@mantine/modals";
import { Group, Text } from "@mantine/core";
import { IconSize } from "../common/style-constants";
import { IconAlertTriangle } from "@tabler/icons-react";

interface OpenWarningAlertProps {
    title: string;
    text: string;
}

function openWarningAlert(props: OpenWarningAlertProps): void {
    modals.openConfirmModal({
        title: (
            <Group gap="xs">
                <IconAlertTriangle size={IconSize.MEDIUM} color="#f08c00" />
                <span>{props.title}</span>
            </Group>
        ),
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
