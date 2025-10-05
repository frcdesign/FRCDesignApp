import { ReloadDocumentsButton } from "../navbar/settings-menu";
import { RequireAccessLevel } from "../api/access-level";
import { AppInternalErrorState } from "../common/app-zero-state";
import { ReactNode } from "react";

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
