import {
    Badge,
    Button,
    Center,
    EmptyState,
    Group,
    Loader,
    Stack,
    Text
} from "@mantine/core";
import {
    ArrowSquareOutIcon,
    CheckCircleIcon,
    CircleIcon,
    MinusCircleIcon,
    WarningCircleIcon,
    XCircleIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    VersionJobState,
    VersionTaskState,
    workspaceKey,
    type VersionTask,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppIcon } from "../../../components/app-icon";
import { AppTitle } from "../../../components/app-title";
import { useOnshapeOrigin } from "../../../lib/onshape-params";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import styles from "../../../lib/styles.module.css";
import {
    jobHeadline,
    jobOutcome,
    jobStats,
    OUTCOME_STYLE,
    runningHeadline,
    taskLabel
} from "../job-report";
import { useVersionJobQuery } from "../queries";

interface JobDetailsProps {
    workspace: WorkspacePath;
}

/** The modal's title, which moves on with the run as its body does. */
export function JobDetailsTitle(props: JobDetailsProps): ReactNode {
    const { data: status } = useVersionJobQuery(props.workspace);
    const outcome = jobOutcome(status);

    if (!status || !outcome) {
        return (
            <AppTitle
                title={status ? runningHeadline(status) : "Loading..."}
                icon={<Loader size={IconSize.MEDIUM} />}
            />
        );
    }
    const { color, icon } = OUTCOME_STYLE[outcome];
    return (
        <AppTitle
            title={jobHeadline(status, outcome)}
            icon={<AppIcon icon={icon} size={IconSize.MEDIUM} color={color} />}
        />
    );
}

/**
 * The run this workspace last started, step by step as it goes: what it did,
 * and for each step that failed, why and a way into the document.
 */
export function JobDetails(props: JobDetailsProps): ReactNode {
    const { data: status } = useVersionJobQuery(props.workspace);
    if (!status) {
        return null;
    }
    const isRunning = status.state === VersionJobState.RUNNING;
    const stats = isRunning ? [] : jobStats(status);

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
                    title="Stopped early"
                    description={status.error}
                />
            )}
            {stats.length > 0 && (
                <Group gap="xs">
                    {stats.map((stat) => (
                        <Badge key={stat.label} color={stat.color}>
                            {stat.label}
                        </Badge>
                    ))}
                </Group>
            )}
            <Stack gap="sm">
                {/* A run takes each action on a document once. */}
                {(status.tasks ?? []).map((task) => (
                    <TaskRow
                        key={`${task.action}:${workspaceKey(task.workspace)}`}
                        task={task}
                    />
                ))}
            </Stack>
        </Stack>
    );
}

const STATE_ICON = {
    [VersionTaskState.PENDING]: { icon: CircleIcon, color: StatusColor.DIMMED },
    [VersionTaskState.DONE]: {
        icon: CheckCircleIcon,
        color: StatusColor.SUCCESS
    },
    [VersionTaskState.FAILED]: { icon: XCircleIcon, color: StatusColor.ERROR },
    [VersionTaskState.SKIPPED]: {
        icon: MinusCircleIcon,
        color: StatusColor.DIMMED
    }
} as const;

interface TaskRowProps {
    task: VersionTask;
}

function TaskRow(props: TaskRowProps): ReactNode {
    const { task } = props;
    const origin = useOnshapeOrigin();
    const isQuiet =
        task.state === VersionTaskState.PENDING ||
        task.state === VersionTaskState.SKIPPED;

    return (
        <Group gap="sm" wrap="nowrap" align="flex-start">
            <Center w={IconSize.MEDIUM} h={IconSize.MEDIUM} mt={2}>
                {task.state === VersionTaskState.RUNNING ? (
                    <Loader size={IconSize.SMALL} />
                ) : (
                    <AppIcon
                        icon={STATE_ICON[task.state].icon}
                        size={IconSize.MEDIUM}
                        color={STATE_ICON[task.state].color}
                    />
                )}
            </Center>
            <Stack gap={0} miw={0} flex={1}>
                <Text size="sm" c={isQuiet ? StatusColor.DIMMED : undefined}>
                    {taskLabel(task)}
                </Text>
                {task.state === VersionTaskState.FAILED && task.reason && (
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {task.reason}
                    </Text>
                )}
                {task.state === VersionTaskState.SKIPPED && (
                    <Text size="xs" c={StatusColor.DIMMED}>
                        Skipped, since a step it needed failed.
                    </Text>
                )}
            </Stack>
            {task.state === VersionTaskState.FAILED && (
                <Button
                    variant="outline"
                    size="compact-sm"
                    className={styles.noShrink}
                    rightSection={<ArrowSquareOutIcon size={IconSize.SMALL} />}
                    onClick={() =>
                        openUrlInNewTab(makeUrl(origin, task.workspace))
                    }
                >
                    Open
                </Button>
            )}
        </Group>
    );
}
