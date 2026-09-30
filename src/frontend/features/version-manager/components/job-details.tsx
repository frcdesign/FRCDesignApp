import {
    ActionIcon,
    Badge,
    EmptyState,
    Group,
    Stack,
    Text
} from "@mantine/core";
import { ArrowSquareOutIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type {
    VersionJobStatus,
    VersionJobStop
} from "@backend/features/version-manager/contract";
import { AppIcon } from "../../../components/app-icon";
import { useOnshapeOrigin } from "../../../lib/onshape-params";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import { jobStats } from "../job-report";

interface JobDetailsProps {
    status: VersionJobStatus;
}

/**
 * What a run did — its counts — and, for one that stopped, the document it
 * stopped in and why.
 */
export function JobDetails(props: JobDetailsProps): ReactNode {
    const { status } = props;
    const stats = status.result ? jobStats(status.result) : [];

    return (
        <Stack gap="md">
            {status.error && (
                <EmptyState
                    align="left"
                    size="sm"
                    icon={
                        <AppIcon
                            icon={WarningCircleIcon}
                            size={IconSize.CONTROL}
                            color={StatusColor.ERROR}
                        />
                    }
                    title={
                        status.stoppedAt ? (
                            <StoppedAtTitle stoppedAt={status.stoppedAt} />
                        ) : (
                            "Stopped early"
                        )
                    }
                    description={status.error}
                />
            )}
            {stats.length > 0 ? (
                <Group gap="xs">
                    {stats.map((stat) => (
                        <Badge key={stat.label} color={stat.color}>
                            {stat.label}
                        </Badge>
                    ))}
                </Group>
            ) : (
                !status.error && (
                    <Text size="sm" c={StatusColor.DIMMED}>
                        Everything was already up to date.
                    </Text>
                )
            )}
        </Stack>
    );
}

interface StoppedAtTitleProps {
    stoppedAt: VersionJobStop;
}

/** The document the run stopped in, and a way into it. */
function StoppedAtTitle(props: StoppedAtTitleProps): ReactNode {
    const { stoppedAt } = props;
    const origin = useOnshapeOrigin();

    return (
        <Group gap={4} wrap="nowrap">
            <Text inherit truncate>
                {stoppedAt.documentName ?? "A linked document"}
            </Text>
            <ActionIcon
                title="Open in Onshape"
                onClick={() =>
                    openUrlInNewTab(makeUrl(origin, stoppedAt.workspace))
                }
            >
                <ArrowSquareOutIcon size={IconSize.MEDIUM} />
            </ActionIcon>
        </Group>
    );
}
