import { RequireAccessLevel } from "../features/auth/access-level";
import { PageError } from "./app-zero-state";
import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { HouseIcon } from "@phosphor-icons/react";
import { IconSize } from "../lib/style-constants";
import { ReloadGroupsButton } from "../features/library/components/reload-groups-button";
import { DEFAULT_SETTINGS } from "@backend/features/settings/settings";

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
    const homeButton = (
        <Button
            leftSection={<HouseIcon size={IconSize.MEDIUM} />}
            onClick={() => {
                void navigate({
                    to: "/app/library/$libraryId",
                    params: { libraryId: DEFAULT_SETTINGS.libraryId }
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
