import { ReloadDocumentsButton } from "../navbar/settings-menu";
import { RequireAccessLevel } from "../api/access-level";
import { AppInternalErrorState } from "../common/app-zero-state";

/**
 * Catch-all error state for when the app fails to load.
 * Includes an escape hatch for admins to reload documents.
 */
export function RootAppError() {
    return (
        <AppInternalErrorState
            action={
                <RequireAccessLevel useMaxAccessLevel>
                    <ReloadDocumentsButton reloadAll hideFormGroup />
                </RequireAccessLevel>
            }
        />
    );
}
