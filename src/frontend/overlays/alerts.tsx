import { modals } from "@mantine/modals";
import { Group, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

/**
 * Opens a simple warning modal with a single "Close" action. Replaces the
 * former search-param driven AppAlert popups; called inline where needed.
 */
function openWarningAlert(text: string): void {
    modals.openConfirmModal({
        title: (
            <Group gap="xs" wrap="nowrap">
                <IconAlertTriangle
                    size={20}
                    color="var(--mantine-color-yellow-6)"
                />
                <span>Warning</span>
            </Group>
        ),
        children: <Text size="sm">{text}</Text>,
        labels: { confirm: "Close", cancel: "" },
        cancelProps: { display: "none" },
        confirmProps: { color: "yellow" }
    });
}

export function openCannotDeriveAssemblyAlert(): void {
    openWarningAlert(
        "This element is an assembly, which cannot be derived into a part studio."
    );
}

export function openCannotReorderAlert(): void {
    openWarningAlert(
        "To prevent confusion, favorites cannot be reordered while filters are active."
    );
}

export function openCannotEditDefaultConfigurationAlert(): void {
    openWarningAlert(
        "This element is not configurable, so its default configuration cannot be changed."
    );
}
