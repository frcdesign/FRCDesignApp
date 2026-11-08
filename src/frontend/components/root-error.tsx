import { RequireAccessLevel } from "../features/auth/components/require-access";
import { PageError, PageNotice } from "./app-notice";
import { m } from "../paraglide/messages";
import {
    forumInvite,
    topicForum
} from "@backend/features/feedback/discord-forums";
import { type CSSProperties, ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Group } from "@mantine/core";
import { DiscordLogoIcon, FlagIcon, HouseIcon } from "@phosphor-icons/react";
import { IconSize } from "../lib/style-constants";
import { Status } from "../lib/status";
import { openUrlInNewTab } from "../lib/url";
import { StatusIcon } from "./status-icon";
import { ReloadButton } from "../features/library/components/reload-button";
import {
    CRASH_TOPIC,
    CrashReportStatus,
    useCrashReport
} from "../features/feedback/crash-report";
import { AccessLevel } from "@backend/features/auth/access-level";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";

interface RootAppErrorProps {
    error: unknown;
}

export function RootAppError(props: RootAppErrorProps): ReactNode {
    const report = useCrashReport(props.error);

    if (report.status === CrashReportStatus.SENT) {
        return (
            <PageNotice
                icon={
                    <StatusIcon
                        status={Status.SUCCESS}
                        size={IconSize.PAGE}
                        raised={false}
                    />
                }
                title={m.feedbackSent()}
                description={m.feedbackSentWhere({
                    channel: topicForum(CRASH_TOPIC).channel
                })}
                action={
                    <Button
                        leftSection={<DiscordLogoIcon />}
                        onClick={() =>
                            openUrlInNewTab(forumInvite(CRASH_TOPIC))
                        }
                    >
                        {m.feedbackOpenDiscord()}
                    </Button>
                }
            />
        );
    }

    const failed = report.status === CrashReportStatus.FAILED;
    return (
        <PageNotice
            title={m.appCrashed()}
            description={failed ? report.failure : m.appCrashedPleaseReport()}
            action={
                <Group gap="xs" justify="center" wrap="wrap">
                    <RequireAccessLevel
                        accessLevel={AccessLevel.OWNER}
                        useMaxAccessLevel
                    >
                        <ReloadButton all />
                    </RequireAccessLevel>
                    <Button
                        leftSection={<FlagIcon />}
                        loading={report.status === CrashReportStatus.SENDING}
                        onClick={report.send}
                    >
                        {failed
                            ? m.appCrashedTryAgain()
                            : m.appCrashedSendReport()}
                    </Button>
                </Group>
            }
        />
    );
}

const CRASH_PAGE_STYLE: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: "100dvh",
    padding: 24,
    textAlign: "center",
    font: "16px system-ui, sans-serif"
};

const CRASH_BUTTON_STYLE: CSSProperties = {
    font: "inherit",
    padding: "6px 16px",
    borderRadius: 4,
    cursor: "pointer"
};

interface RootCrashProps {
    error: unknown;
}

/** The root route's errorComponent. */
export function RootCrash(props: RootCrashProps): ReactNode {
    const report = useCrashReport(props.error);
    const invite = (
        <a href={forumInvite(CRASH_TOPIC)} target="_blank" rel="noreferrer">
            {m.feedbackOpenDiscord()}
        </a>
    );

    let status;
    switch (report.status) {
        case CrashReportStatus.READY:
        case CrashReportStatus.SENDING:
            status = (
                <>
                    <p style={{ margin: 0 }}>{m.appCrashedPleaseReport()}</p>
                    <button
                        style={CRASH_BUTTON_STYLE}
                        disabled={report.status === CrashReportStatus.SENDING}
                        onClick={report.send}
                    >
                        {report.status === CrashReportStatus.SENDING
                            ? m.appCrashedSending()
                            : m.appCrashedSendReport()}
                    </button>
                </>
            );
            break;
        case CrashReportStatus.SENT:
            status = (
                <>
                    <p style={{ margin: 0 }}>
                        {m.feedbackSent()}{" "}
                        {m.feedbackSentWhere({
                            channel: topicForum(CRASH_TOPIC).channel
                        })}
                    </p>
                    {invite}
                </>
            );
            break;
        case CrashReportStatus.FAILED:
            status = (
                <>
                    <p style={{ margin: 0 }}>{report.failure}</p>
                    <button style={CRASH_BUTTON_STYLE} onClick={report.send}>
                        {m.appCrashedTryAgain()}
                    </button>
                    {invite}
                </>
            );
            break;
    }

    // Plain markup: this replaces the root, Mantine's provider included.
    return (
        <div style={CRASH_PAGE_STYLE}>
            <p style={{ margin: 0 }}>{m.appCrashed()}</p>
            {status}
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
