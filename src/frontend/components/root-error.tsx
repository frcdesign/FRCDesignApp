import { RequireAccessLevel } from "../features/auth/access-level";
import { PageNotice, PageError } from "./app-notice";
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
            The app has crashed due to an unexpected error. If the problem
            persists, contact the FRCDesignApp developers.
        </div>
    );
}

/** Onshape's panel has no address bar, so show the url for a bug report. */
function MissedUrl(): ReactNode {
    const url = window.location.href;

    return (
        <Group gap={4} align="center" mt="xs" maw="100%">
            <Code
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
                    <Tooltip label={copied ? "Copied" : "Copy address"}>
                        <ActionIcon
                            color={copied ? "teal" : "gray"}
                            size={IconSize.SMALL}
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
                    params: { libraryId: DEFAULT_LIBRARY }
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
                    Click this button to fix the issue. If that does not work,
                    contact the FRCDesignApp developers with the address below.
                    <MissedUrl />
                </>
            }
            action={homeButton}
        />
    );
}
