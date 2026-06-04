import { ReloadDocumentsButton } from "../navbar/settings-menu";
import { RequireAccessLevel } from "../api-utils/access-level";
import { PageError } from "../common/app-zero-state";
import { PropsWithChildren, ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { IconHome } from "@tabler/icons-react";
import { queryClient } from "../query-client";
import { createAppTheme } from "../theme";
import { Library } from "../../shared/types";

const errorTheme = createAppTheme(Library.FRC_DESIGN_LIB);

/**
 * Error and not-found components render *in place of* the `/app` route component,
 * so they sit outside every provider that `App` mounts. Without this wrapper they
 * crash with "MantineProvider was not found", masking the real error. Mirror the
 * app's provider stack so the error UI (and its admin reload escape hatch) works.
 */
function ErrorShell(props: PropsWithChildren): ReactNode {
    return (
        <QueryClientProvider client={queryClient}>
            <MantineProvider theme={errorTheme}>
                <ModalsProvider
                    labels={{ confirm: "Confirm", cancel: "Cancel" }}
                >
                    <Notifications position="bottom-center" limit={3} />
                    {props.children}
                </ModalsProvider>
            </MantineProvider>
        </QueryClientProvider>
    );
}

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
            <ErrorShell>
                <PageError title="The app has crashed due to an unexpected error." />
            </ErrorShell>
        );
    }
    return (
        <ErrorShell>
            <PageError
                title="The app has crashed due to an unexpected error."
                action={
                    <RequireAccessLevel useMaxAccessLevel>
                        <ReloadDocumentsButton reloadAll hideFormGroup />
                    </RequireAccessLevel>
                }
            />
        </ErrorShell>
    );
}

export function NotFoundError(): ReactNode {
    const navigate = useNavigate();
    const homeButton = (
        <Button
            leftSection={<IconHome size={16} />}
            onClick={() => {
                void navigate({ to: "/app" });
            }}
        >
            Go home
        </Button>
    );

    return (
        <ErrorShell>
            <PageError
                title="Failed to find page."
                description="Click this button to fix the issue. If it doesn't, contact the FRCDesignApp developers."
                action={homeButton}
            />
        </ErrorShell>
    );
}
