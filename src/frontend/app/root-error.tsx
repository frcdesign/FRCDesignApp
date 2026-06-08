import { ReloadDocumentsButton } from "../navbar/settings-menu";
import { RequireAccessLevel } from "../api-utils/access-level";
import { PageError } from "../common/app-zero-state";
import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";

/**
 * Catch-all error state for when a route below the root fails to load. Rendered by
 * the `/app` and `/init` route `errorComponent`s, which render inside the root
 * Outlet — so the app-wide MantineProvider is available and no wrapper is needed.
 * Includes an escape hatch for admins to reload documents.
 */
export function RootAppError(): ReactNode {
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

/**
 * Last-resort fallback for the ROOT route's errorComponent. It replaces the root
 * component (which mounts the providers), so it renders only if the providers
 * themselves are unavailable — it must not use Mantine.
 */
export function RootCrash(): ReactNode {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100dvh",
                padding: 24,
                textAlign: "center",
                font: "16px system-ui, sans-serif"
            }}
        >
            The app has crashed due to an unexpected error. Please reload the
            page. If the problem persists, contact the FRCDesignApp developers.
        </div>
    );
}

export function NotFoundError(): ReactNode {
    const navigate = useNavigate();
    const homeButton = (
        <Button
            leftSection={<IconHome size={IconSize.MEDIUM} />}
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
