import { Center, Group, Loader, Stack, Text } from "@mantine/core";
import { CircleIcon, MinusCircleIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    assemblyJobOutcome,
    AssemblyJobState,
    AssemblyTaskState,
    PickList,
    type AssemblyTask,
    type RunPick,
    SelectedEntityType
} from "@backend/features/auto-assembly/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { AppIcon } from "../../../components/app-icon";
import { SectionNotice } from "../../../components/app-notice";
import { AppTitle } from "../../../components/app-title";
import { StatusIcon } from "../../../components/status-icon";
import { sendHighlightMessage } from "../../../lib/messages";
import { useTargetElement } from "../../../lib/onshape-params";
import { focusedPicks, type OnshapeSelection } from "../../../lib/selection";
import { Status, STATUS_COLOR } from "../../../lib/status";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import {
    jobHeadline,
    OUTCOME_STATUS,
    runningHeadline,
    taskLabel
} from "../job-report";
import { toRowProblem, useAssemblyJobQuery } from "../queries";

/** Mantine's `sm` gap, between a row's icon and its text. */
const ROW_GAP = 12;

interface JobDetailsTitleProps {
    assembly: ElementPath;
}

/** The modal's title, which moves on with the run as its body does. */
export function JobDetailsTitle(props: JobDetailsTitleProps): ReactNode {
    const { data: status } = useAssemblyJobQuery(props.assembly);
    const outcome = assemblyJobOutcome(status);

    if (status?.state === AssemblyJobState.NONE) {
        return <AppTitle title={m.autoAssemblyNoRecentRun()} />;
    }
    if (!status || !outcome) {
        return (
            <AppTitle
                title={
                    status ? runningHeadline(status) : m.autoAssemblyLoading()
                }
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

/** The run this assembly last started, step by step, then each pick with what went wrong with it. */
export function JobDetails(props: JobDetailsProps): ReactNode {
    const { data: status } = useAssemblyJobQuery(props.assembly);
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
                    title={m.autoAssemblyStoppedEarly()}
                    description={status.error}
                />
            )}
            <Stack gap={6}>
                {(status.tasks ?? []).map((task) => (
                    <TaskRow key={task.action} task={task} />
                ))}
            </Stack>
            {status.picks && status.picks.length > 0 && (
                <PickGroups picks={status.picks} />
            )}
        </Stack>
    );
}

interface TaskStateIconProps {
    task: AssemblyTask;
}

function TaskStateIcon(props: TaskStateIconProps): ReactNode {
    const { task } = props;
    switch (task.state) {
        case AssemblyTaskState.RUNNING:
            return <Loader size={IconSize.SMALL} />;
        case AssemblyTaskState.DONE:
            return (
                <StatusIcon
                    status={task.warning ? Status.WARNING : Status.SUCCESS}
                    size={IconSize.MEDIUM}
                    raised={false}
                />
            );
        case AssemblyTaskState.FAILED:
            return (
                <StatusIcon
                    status={Status.ERROR}
                    size={IconSize.MEDIUM}
                    raised={false}
                />
            );
        case AssemblyTaskState.PENDING:
            return (
                <AppIcon
                    icon={CircleIcon}
                    size={IconSize.MEDIUM}
                    color={StatusColor.DIMMED}
                />
            );
        case AssemblyTaskState.SKIPPED:
            return (
                <AppIcon
                    icon={MinusCircleIcon}
                    size={IconSize.MEDIUM}
                    color={StatusColor.DIMMED}
                />
            );
    }
}

interface DetailRowProps {
    icon: ReactNode;
    children: ReactNode;
    /** A line under the text, lined up with it rather than the icon. */
    detail?: ReactNode;
}

/** An icon centred on a line of text, with a detail under the text. */
function DetailRow(props: DetailRowProps): ReactNode {
    const { icon, children, detail } = props;
    return (
        <Stack gap={0}>
            <Group gap={ROW_GAP} wrap="nowrap">
                <Center w={IconSize.MEDIUM} h={IconSize.MEDIUM}>
                    {icon}
                </Center>
                {children}
            </Group>
            {detail && <Stack pl={IconSize.MEDIUM + ROW_GAP}>{detail}</Stack>}
        </Stack>
    );
}

interface TaskRowProps {
    task: AssemblyTask;
}

function TaskRow(props: TaskRowProps): ReactNode {
    const { task } = props;
    const isQuiet =
        task.state === AssemblyTaskState.PENDING ||
        task.state === AssemblyTaskState.SKIPPED;
    const detail =
        task.state === AssemblyTaskState.FAILED
            ? task.reason
            : task.state === AssemblyTaskState.DONE
              ? task.warning
              : undefined;

    return (
        <DetailRow
            icon={<TaskStateIcon task={task} />}
            detail={
                detail && (
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {detail}
                    </Text>
                )
            }
        >
            <Text c={isQuiet ? StatusColor.DIMMED : undefined}>
                {taskLabel(task.action)}
            </Text>
        </DetailRow>
    );
}

/** The list a pick was made in, as the form labels it. */
function listLabel(list: PickList, picks: RunPick[]): string {
    switch (list) {
        case PickList.TARGETS:
            return picks.some(
                (pick) => pick.entity.entityType === SelectedEntityType.FACE
            )
                ? m.autoAssemblyFaces()
                : m.autoAssemblyCircularEdges();
        case PickList.EXCLUDED:
            return m.autoAssemblyEdgesToExclude();
        case PickList.REPLACED:
            return m.autoAssemblyScrewsToReplace();
    }
}

/** A pick's row name, as the form's list names it. */
function pickName(pick: RunPick, index: number): string {
    switch (pick.entity.entityType) {
        case SelectedEntityType.FACE:
            return m.autoAssemblyFaceRow({ index: index + 1 });
        case SelectedEntityType.EDGE:
            return m.autoAssemblyEdgeRow({ index: index + 1 });
        case SelectedEntityType.BODY:
            return m.autoAssemblyScrewRow({ index: index + 1 });
    }
}

function toSelection(pick: RunPick): OnshapeSelection {
    return {
        entityType: pick.entity.entityType,
        selectionId: pick.entity.entityId,
        occurrencePath: pick.entity.occurrencePath
    };
}

interface PickGroupsProps {
    picks: RunPick[];
}

/** The run's picks under the lists they were made in. Hovering one lights it up in Onshape. */
function PickGroups(props: PickGroupsProps): ReactNode {
    const { picks } = props;
    const target = useTargetElement();

    const show = (shown: OnshapeSelection[]) => {
        if (target) {
            sendHighlightMessage(target, shown);
        }
    };
    const groups = Object.values(PickList).flatMap((list) => {
        const listed = picks.filter((pick) => pick.list === list);
        return listed.length > 0 ? [{ list, listed }] : [];
    });

    return (
        <Stack gap="sm" onMouseLeave={() => show(focusedPicks())}>
            {groups.map(({ list, listed }) => (
                <Stack key={list} gap={6}>
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {listLabel(list, listed)}
                    </Text>
                    {listed.map((pick, index) => (
                        <PickRow
                            key={`${pick.entity.occurrencePath.join("/")}|${pick.entity.entityId}`}
                            name={pickName(pick, index)}
                            pick={pick}
                            onHover={() => show([toSelection(pick)])}
                        />
                    ))}
                </Stack>
            ))}
        </Stack>
    );
}

interface PickRowProps {
    name: string;
    pick: RunPick;
    onHover: () => void;
}

function PickRow(props: PickRowProps): ReactNode {
    const { name, pick, onHover } = props;
    const problem = pick.problem && toRowProblem(pick.problem);
    const status = problem?.status ?? Status.SUCCESS;

    return (
        <div onMouseEnter={onHover}>
            <DetailRow
                icon={
                    <StatusIcon
                        status={status}
                        size={IconSize.MEDIUM}
                        raised={false}
                    />
                }
                detail={
                    problem && (
                        <Text size="xs" c={STATUS_COLOR[problem.status]}>
                            {problem.message}
                        </Text>
                    )
                }
            >
                <Text>{name}</Text>
            </DetailRow>
        </div>
    );
}
