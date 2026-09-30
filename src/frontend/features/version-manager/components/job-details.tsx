import {
    Badge,
    Center,
    EmptyState,
    Group,
    Loader,
    Stack,
    Text
} from "@mantine/core";
import { CircleIcon, MinusIcon } from "@phosphor-icons/react";
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
import { StatusIcon } from "../../../components/status-icon";
import { Status } from "../../../lib/status";
import { ExternalLink } from "../../../components/external-link";
import { useOnshapeOrigin } from "../../../lib/onshape-params";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { makeUrl } from "../../../lib/url";
import {
    jobHeadline,
    jobOutcome,
    jobStats,
    OUTCOME_STATUS,
    runningHeadline,
    TASK_LABEL
} from "../job-report";
import { plural, useVersionJobQuery } from "../queries";

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
    return (
        <AppTitle
            title={jobHeadline(status, outcome)}
            icon={
                <StatusIcon
                    status={OUTCOME_STATUS[outcome]}
                    size={IconSize.MEDIUM}
                />
            }
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
                        <StatusIcon
                            status={Status.ERROR}
                            size={IconSize.CONTROL}
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
            {groupByDocument(status.tasks ?? []).map((group) => (
                <DocumentSteps key={group.key} group={group} />
            ))}
        </Stack>
    );
}

interface DocumentGroup {
    key: string;
    workspace: WorkspacePath;
    documentName?: string;
    tasks: VersionTask[];
}

/** By document, in the order the run first reaches each. */
function groupByDocument(tasks: VersionTask[]): DocumentGroup[] {
    const groups = new Map<string, DocumentGroup>();
    for (const task of tasks) {
        const key = workspaceKey(task.workspace);
        const group = groups.get(key) ?? {
            key,
            workspace: task.workspace,
            documentName: task.documentName,
            tasks: []
        };
        group.tasks.push(task);
        groups.set(key, group);
    }
    return [...groups.values()];
}

interface DocumentStepsProps {
    group: DocumentGroup;
}

/** One document, named as a link into it, and what the run does there. */
function DocumentSteps(props: DocumentStepsProps): ReactNode {
    const { group } = props;
    const origin = useOnshapeOrigin();

    return (
        <Stack gap={6}>
            <Group miw={0}>
                <ExternalLink
                    href={makeUrl(origin, group.workspace)}
                    fw={FontWeight.SEMI_BOLD}
                    maw="100%"
                    iconSize={IconSize.SMALL}
                >
                    <Text component="span" inherit truncate miw={0}>
                        {group.documentName ?? "A linked document"}
                    </Text>
                </ExternalLink>
            </Group>
            {group.tasks.map((task) => (
                <TaskRow key={task.action} task={task} />
            ))}
        </Stack>
    );
}

interface TaskStateIconProps {
    state: VersionTaskState;
}

/** How far a step has got: the standard status for one that finished. */
function TaskStateIcon(props: TaskStateIconProps): ReactNode {
    switch (props.state) {
        case VersionTaskState.RUNNING:
            return <Loader size={IconSize.SMALL} />;
        case VersionTaskState.DONE:
            return (
                <StatusIcon status={Status.SUCCESS} size={IconSize.MEDIUM} />
            );
        case VersionTaskState.FAILED:
            return <StatusIcon status={Status.ERROR} size={IconSize.MEDIUM} />;
        case VersionTaskState.PENDING:
            return (
                <AppIcon
                    icon={CircleIcon}
                    size={IconSize.MEDIUM}
                    color={StatusColor.DIMMED}
                />
            );
        case VersionTaskState.SKIPPED:
            return (
                <AppIcon
                    icon={MinusIcon}
                    size={IconSize.MEDIUM}
                    color={StatusColor.DIMMED}
                />
            );
    }
}

interface TaskRowProps {
    task: VersionTask;
}

function TaskRow(props: TaskRowProps): ReactNode {
    const { task } = props;
    const isQuiet =
        task.state === VersionTaskState.PENDING ||
        task.state === VersionTaskState.SKIPPED;

    return (
        <Group gap="sm" wrap="nowrap" align="flex-start">
            <Center w={IconSize.MEDIUM} h={IconSize.MEDIUM} mt={2}>
                <TaskStateIcon state={task.state} />
            </Center>
            <Stack gap={0} miw={0} flex={1}>
                <Group gap="xs">
                    <Text
                        size="sm"
                        c={isQuiet ? StatusColor.DIMMED : undefined}
                    >
                        {TASK_LABEL[task.action]}
                    </Text>
                    {task.updatedElements !== undefined && (
                        <UpdatedBadge count={task.updatedElements} />
                    )}
                </Group>
                {task.state === VersionTaskState.FAILED && task.reason && (
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {task.reason}
                    </Text>
                )}
                {task.state === VersionTaskState.SKIPPED && (
                    <Text size="xs" c={StatusColor.DIMMED}>
                        Skipped.
                    </Text>
                )}
            </Stack>
        </Group>
    );
}

interface UpdatedBadgeProps {
    count: number;
}

function UpdatedBadge(props: UpdatedBadgeProps): ReactNode {
    const { count } = props;
    if (count === 0) {
        return <Badge color={StatusColor.NEUTRAL}>Up to date</Badge>;
    }
    return (
        <Badge color={StatusColor.SUCCESS}>
            {plural(count, "tab")} updated
        </Badge>
    );
}
