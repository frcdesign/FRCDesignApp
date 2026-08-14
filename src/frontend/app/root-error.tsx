import { RequireAccessLevel } from "../api-utils/access-level";
import { PageError } from "../app-common/app-zero-state";
import { ReactNode } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { ReloadGroupsButton } from "../settings/reload-groups-button";

/**
 * Catch-all error state for when a route below the root fails to load.
 */
export function RootAppError(): ReactNode {
    return (
        <PageError
            title="The app has crashed due to an unexpected error."
            action={
                <RequireAccessLevel useMaxAccessLevel>
                    <ReloadGroupsButton reloadAll />
                </RequireAccessLevel>
            }
        />
    );
}

/**
 * Last-resort fallback for the ROOT route's errorComponent.
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
            The app has crashed due to an unexpected error. If the problem
            persists, contact the FRCDesignApp developers.
        </div>
    );
}

export function NotFoundError(): ReactNode {
    const navigate = useNavigate();
    // Root loader data, so this works even for urls that match nothing.
    const { settings } = useLoaderData({ from: "__root__" });
    const homeButton = (
        <Button
            leftSection={<IconHome size={IconSize.MEDIUM} />}
            onClick={() => {
                void navigate({
                    to: "/app/library/$libraryId",
                    params: { libraryId: settings.libraryId }
                });
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
