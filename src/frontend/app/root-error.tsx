import { ReloadDocumentsButton } from "../navbar/settings-menu";
import { RequireAccessLevel } from "../api-utils/access-level";
import { PageError } from "../common/app-zero-state";
import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";

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
        return (
            <PageError title="The app has crashed due to an unexpected error." />
        );
    }
    return (
        <PageError
            title="The app has crashed due to an unexpected error."
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
            color="blue"
            leftSection={<IconHome size={16} />}
            onClick={() => {
                void navigate({ to: "/app" });
            }}
        >
            Go home
        </Button>
    );

    return (
        <PageError
            title="Failed to find page."
            description="Click this button to fix the issue. If it doesn't, contact the FRCDesignApp developers."
            action={homeButton}
        />
    );
}
