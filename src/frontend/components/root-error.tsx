import { RequireAccessLevel } from "../features/auth/components/require-access";
import { PageError } from "./app-notice";
import { DISCORD_INVITE_URL } from "../lib/url";
import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { HouseIcon } from "@phosphor-icons/react";
import { IconSize } from "../lib/style-constants";
import { ReloadButton } from "../features/library/components/reload-button";
import { AccessLevel } from "@backend/features/auth/access-level";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";

export function RootAppError(): ReactNode {
    return (
        <PageError
            title="The app has crashed due to an unexpected error."
            action={
                <RequireAccessLevel
                    accessLevel={AccessLevel.OWNER}
                    useMaxAccessLevel
                >
                    <ReloadButton all />
                </RequireAccessLevel>
            }
        />
    );
}

/** The root route's errorComponent. */
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
            <p>
                The app has crashed due to an unexpected error. If the problem
                persists, report it in the{" "}
                <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
                    FRCDesign Discord
                </a>
                .
            </p>
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
                    params: { libraryId: DEFAULT_LIBRARY }
                });
            }}
        >
            Go home
        </Button>
    );

    return <PageError title="Failed to find page." action={homeButton} />;
}
