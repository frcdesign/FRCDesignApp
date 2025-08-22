import { Icon, NonIdealState, NonIdealStateIconSize } from "@blueprintjs/core";
import { useSearch } from "@tanstack/react-router";
import { hasMemberAccess } from "../api/backend-types";
import { ReloadDocumentsButton } from "../navbar/settings-menu";

export function AppError() {
    const search = useSearch({ from: "/app" });

    const action = hasMemberAccess(search.maxAccessLevel) ? (
        <ReloadDocumentsButton reloadAll hideFormGroup />
    ) : undefined;

    return (
        <NonIdealState
            icon={
                <Icon
                    icon="cross"
                    intent="danger"
                    size={NonIdealStateIconSize.STANDARD}
                />
            }
            title="Encountered an internal error."
            description="If the problem persists, contact the FRCDesignApp developers."
            action={action}
        />
    );
}
