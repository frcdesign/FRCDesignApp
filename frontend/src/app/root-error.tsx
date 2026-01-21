import { ReloadDocumentsButton } from "../navbar/settings-menu";
import { RequireAccessLevel } from "../api/access-level";
import { AppErrorState, AppInternalErrorState } from "../common/app-zero-state";
import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@blueprintjs/core";

interface RootAppErrorProps {
    /**
     * True if this is the root error boundary.
     * Used to determine if the error state has enough information to try to show a reload button.
     *
     * @default false
     */
    isRoot?: boolean;
}

/**
 * Catch-all error state for when the app fails to load.
 * Includes an escape hatch for admins to reload documents.
 */
export function RootAppError(props: RootAppErrorProps): ReactNode {
    const isRoot = props.isRoot ?? false;
    if (isRoot) {
        return <AppInternalErrorState inline={false} />;
    }
    return (
        <AppInternalErrorState
            inline={false}
            action={
                <RequireAccessLevel useMaxAccessLevel>
                    <ReloadDocumentsButton reloadAll hideFormGroup />
                </RequireAccessLevel>
            }
        />
    );
}

export function NotFoundError(): ReactNode {
    const navigate = useNavigate();
    const homeButton = (
        <Button
            intent="primary"
            text="Go home"
            icon="home"
            onClick={() => navigate({ to: "/app" })}
        />
    );

    return (
        <AppErrorState
            title="Failed to find page."
            description="Click this button to fix the issue. If it doesn't, contact the FRCDesignApp developers."
            action={homeButton}
        />
    );
}
