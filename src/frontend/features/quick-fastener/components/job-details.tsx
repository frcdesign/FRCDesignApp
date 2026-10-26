import { Center, Group, Loader, Stack, Text } from "@mantine/core";
import { CircleIcon, MinusCircleIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    fastenerJobOutcome,
    FastenerJobState,
    FastenerTaskState,
    type FastenerTask
} from "@backend/features/quick-fastener/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { AppIcon } from "../../../components/app-icon";
import { SectionNotice } from "../../../components/app-notice";
import { AppTitle } from "../../../components/app-title";
import { StatusIcon } from "../../../components/status-icon";
import { Status } from "../../../lib/status";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import {
    jobHeadline,
    OUTCOME_STATUS,
    runningHeadline,
    TASK_LABEL
} from "../job-report";
import { useFastenerJobQuery } from "../queries";

interface JobDetailsTitleProps {
    assembly: ElementPath;
}

/** The modal's title, which moves on with the run as its body does. */
export function JobDetailsTitle(props: JobDetailsTitleProps): ReactNode {
    const { data: status } = useFastenerJobQuery(props.assembly);
    const outcome = fastenerJobOutcome(status);

    if (status?.state === FastenerJobState.NONE) {
        return <AppTitle title="No recent run" />;
    }
    if (!status || !outcome) {
        return (
            <AppTitle
                title={status ? `${runningHeadline(status)}...` : "Loading..."}
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
                    raised={false}
                />
            }
        />
    );
}

interface JobDetailsProps {
    assembly: ElementPath;
}

/** The run this assembly last started, step by step. */
export function JobDetails(props: JobDetailsProps): ReactNode {
    const { data: status } = useFastenerJobQuery(props.assembly);
    if (!status) {
        return null;
    }

    return (
        <Stack gap="md">
            {status.error && (
                <SectionNotice
                    align="left"
                    py={0}
                    icon={
                        <StatusIcon
                            status={Status.ERROR}
                            size={IconSize.CONTROL}
                        />
                    }
                    title="Stopped early."
                    description={status.error}
                />
            )}
            <Stack gap={6}>
                {(status.tasks ?? []).map((task) => (
                    <TaskRow key={task.action} task={task} />
                ))}
            </Stack>
        </Stack>
    );
}

interface TaskStateIconProps {
    state: FastenerTaskState;
}

function TaskStateIcon(props: TaskStateIconProps): ReactNode {
    switch (props.state) {
        case FastenerTaskState.RUNNING:
            return <Loader size={IconSize.SMALL} />;
        case FastenerTaskState.DONE:
            return (
                <StatusIcon status={Status.SUCCESS} size={IconSize.MEDIUM} />
            );
        case FastenerTaskState.FAILED:
            return <StatusIcon status={Status.ERROR} size={IconSize.MEDIUM} />;
        case FastenerTaskState.PENDING:
            return (
                <AppIcon
                    icon={CircleIcon}
                    size={IconSize.MEDIUM}
                    color={StatusColor.DIMMED}
                />
            );
        case FastenerTaskState.SKIPPED:
            return (
                <AppIcon
                    icon={MinusCircleIcon}
                    size={IconSize.MEDIUM}
                    color={StatusColor.DIMMED}
                />
            );
    }
}

interface TaskRowProps {
    task: FastenerTask;
}

function TaskRow(props: TaskRowProps): ReactNode {
    const { task } = props;
    const isQuiet =
        task.state === FastenerTaskState.PENDING ||
        task.state === FastenerTaskState.SKIPPED;

    return (
        <Group gap="sm" align="flex-start" wrap="nowrap">
            <Center w={IconSize.MEDIUM} h={IconSize.MEDIUM} mt={2}>
                <TaskStateIcon state={task.state} />
            </Center>
            <Stack gap={0} miw={0} flex={1}>
                <Text c={isQuiet ? StatusColor.DIMMED : undefined}>
                    {TASK_LABEL[task.action]}
                </Text>
                {task.state === FastenerTaskState.FAILED && task.reason && (
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {task.reason}
                    </Text>
                )}
            </Stack>
        </Group>
    );
}
