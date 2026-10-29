import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { AppTitle } from "./app-title";
import { Status } from "../lib/status";
import { IconSize, StatusColor } from "../lib/style-constants";
import { StatusIcon } from "./status-icon";

interface OpenWarningAlertProps {
    title: string;
    text: string;
}

function openWarningAlert(props: OpenWarningAlertProps): void {
    modals.openConfirmModal({
        title: (
            <AppTitle
                icon={
                    <StatusIcon
                        status={Status.WARNING}
                        size={IconSize.MEDIUM}
                        raised={false}
                    />
                }
                title={props.title}
            />
        ),
        children: (
            // Takes focus from Close, which would look pre-selected. No outline, which
            // would make the text look editable.
            <Text data-autofocus tabIndex={-1} style={{ outline: "none" }}>
                {props.text}
            </Text>
        ),
        labels: { confirm: "Close", cancel: null },
        cancelProps: { display: "none" },
        confirmProps: { color: StatusColor.WARNING }
    });
}

interface OpenDeleteConfirmProps {
    title: string;
    text: string;
    /** Names the deletion, so the button says what it does. */
    confirmLabel: string;
    onConfirm: () => void;
}

/** Asks before something is deleted for good. */
export function openDeleteConfirm(props: OpenDeleteConfirmProps): void {
    modals.openConfirmModal({
        title: (
            <AppTitle
                icon={
                    <StatusIcon
                        status={Status.ERROR}
                        size={IconSize.MEDIUM}
                        raised={false}
                    />
                }
                title={props.title}
            />
        ),
        children: <Text>{props.text}</Text>,
        labels: { confirm: props.confirmLabel, cancel: "Cancel" },
        centered: true,
        confirmProps: { color: StatusColor.ERROR },
        onConfirm: props.onConfirm
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
