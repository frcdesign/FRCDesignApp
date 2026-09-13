import { RequireAccessLevel } from "../features/auth/access-level";
import { PageNotice } from "./app-zero-state";
import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
    ActionIcon,
    Button,
    Code,
    CopyButton,
    Group,
    Tooltip
} from "@mantine/core";
import { CheckIcon, CopyIcon, HouseIcon } from "@phosphor-icons/react";
import { IconSize } from "../lib/style-constants";
import { ReloadGroupsButton } from "../features/library/components/reload-groups-button";
import { DEFAULT_SETTINGS } from "@backend/features/settings/settings";

/**
 * Catch-all error state for when a route below the root fails to load.
 */
export function RootAppError(): ReactNode {
    return (
        <PageNotice
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

/**
 * The address that missed, to hand to a developer. Onshape's panel has no
 * address bar, so this page is the only place the caller can read it — and
 * which url reached it is the whole diagnosis.
 */
function MissedUrl(): ReactNode {
    // Read at render: reaching this page is the end of a navigation, and
    // leaving it unmounts rather than updates.
    const url = window.location.href;

    return (
        <Group gap={4} wrap="nowrap" align="center" mt="xs" maw="100%">
            <Code
                // Long, and the panel is narrow, so it breaks anywhere rather
                // than widening the page past its gutters.
                style={{
                    overflowWrap: "anywhere",
                    textAlign: "left",
                    userSelect: "all"
                }}
            >
                {url}
            </Code>
            <CopyButton value={url}>
                {({ copied, copy }) => (
                    <Tooltip
                        label={copied ? "Copied" : "Copy address"}
                        withArrow
                    >
                        <ActionIcon
                            variant="subtle"
                            color={copied ? "teal" : "gray"}
                            size={IconSize.SMALL}
                            aria-label="Copy address"
                            onClick={copy}
                        >
                            {copied ? (
                                <CheckIcon size={IconSize.TINY} />
                            ) : (
                                <CopyIcon size={IconSize.TINY} />
                            )}
                        </ActionIcon>
                    </Tooltip>
                )}
            </CopyButton>
        </Group>
    );
}

export function NotFoundError(): ReactNode {
    const navigate = useNavigate();
    const homeButton = (
        <Button
            variant="light"
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
        <PageNotice
            title="Failed to find page."
            description={
                <>
                    Click this button to fix the issue. If it doesn&apos;t,
                    contact the FRCDesignApp developers with the address below.
                    <MissedUrl />
                </>
            }
            action={homeButton}
        />
    );
}
