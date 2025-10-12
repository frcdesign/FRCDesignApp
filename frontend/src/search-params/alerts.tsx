import { Alert, IconName, Intent } from "@blueprintjs/core";
import { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AlertType } from "./alert-type";

interface AppAlertProps {
    text: string;
    /**
     * @default "warning-sign"
     */
    icon?: IconName;
    /**
     * @default "warning"
     */
    intent?: Intent;
}

function AppAlert(props: AppAlertProps): ReactNode {
    const { text } = props;
    const icon = props.icon ?? "warning-sign";
    const intent = props.intent ?? Intent.WARNING;
    const navigate = useNavigate();
    return (
        <Alert
            canEscapeKeyCancel
            canOutsideClickCancel
            isOpen
            onClose={() => {
                navigate({ to: ".", search: { activeAlert: undefined } });
            }}
            confirmButtonText="Close"
            icon={icon}
            intent={intent}
        >
            {text}
        </Alert>
    );
}

/**
 * A controlled alert warning that assemblies cannot be derived into part studios.
 */
function CannotDeriveAssemblyAlert(): ReactNode {
    return (
        <AppAlert
            text="This element is an assembly, which cannot be derived into a part studio."
            icon="warning-sign"
            intent={Intent.WARNING}
        />
    );
}

function CannotReorderAlert() {
    return (
        <AppAlert text="To prevent confusion, favorites cannot be reordered while filters are active."></AppAlert>
    );
}

function CannotEditDefaultConfiguration() {
    return (
        <AppAlert text="This element is not configurable, so its default configuration cannot be changed." />
    );
}

export function AppAlerts(): ReactNode {
    const activeAlert = useSearch({ from: "/app" }).activeAlert;
    if (!activeAlert) {
        return null;
    }
    return (
        <>
            {activeAlert === AlertType.CANNOT_DERIVE_ASSEMBLY && (
                <CannotDeriveAssemblyAlert />
            )}
            {activeAlert === AlertType.CANNOT_REORDER && <CannotReorderAlert />}
            {activeAlert === AlertType.CANNOT_EDIT_DEFAULT_CONFIGURATION && (
                <CannotEditDefaultConfiguration />
            )}
        </>
    );
}
