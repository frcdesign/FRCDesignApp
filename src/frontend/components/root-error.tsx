import { RequireAccessLevel } from "../features/auth/components/require-access";
import { PageError } from "./app-notice";
import { m } from "../paraglide/messages";
import { DISCORD_INVITE_URL } from "@backend/features/feedback/discord-forums";
import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { HouseIcon } from "@phosphor-icons/react";
import { IconSize } from "../lib/style-constants";
import { ReloadButton } from "../features/library/components/reload-button";
import { AccessLevel } from "@backend/features/auth/access-level";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";

interface RootAppErrorProps {
    error: unknown;
}

export function RootAppError(props: RootAppErrorProps): ReactNode {
    return (
        <PageError
            title={m.appCrashed()}
            error={props.error}
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
            {/* Plain markup: this replaces the root, Mantine's provider included. */}
            <p>
                {m.appCrashed()}{" "}
                <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
                    {m.appCrashedReport()}
                </a>
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
            {m.appNotFoundGoHome()}
        </Button>
    );

    return <PageError title={m.appNotFound()} action={homeButton} />;
}
