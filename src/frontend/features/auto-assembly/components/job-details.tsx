import { Center, Group, Loader, Stack, Text } from "@mantine/core";
import { CircleIcon, MinusCircleIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    assemblyJobOutcome,
    AssemblyJobState,
    AssemblyTaskAction,
    AssemblyTaskState,
    PickList,
    type AssemblyTask,
    type RunPart,
    RunPartRole,
    type RunPick,
    type RunScrew,
    SelectedEntityType
} from "@backend/features/auto-assembly/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { AppIcon } from "../../../components/app-icon";
import { SectionNotice } from "../../../components/app-notice";
import { AppTitle } from "../../../components/app-title";
import { StatusIcon } from "../../../components/status-icon";
import {
    type HighlightedEntity,
    sendHighlightMessage
} from "../../../lib/messages";
import { useTargetElement } from "../../../lib/onshape-params";
import { focusedPicks, type OnshapeSelection } from "../../../lib/selection";
import { Status, STATUS_COLOR } from "../../../lib/status";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { jobHeadline, OUTCOME_STATUS, runningHeadline } from "../job-report";
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

/**
 * The run this assembly last started: indexing, then each screw's steps, then
 * each pick with what went wrong with it. Hovering a step that put a part in
 * the assembly, or a pick, lights it up in Onshape.
 */
export function JobDetails(props: JobDetailsProps): ReactNode {
    const { data: status } = useAssemblyJobQuery(props.assembly);
    const show = useShowInOnshape();
    if (!status) {
        return null;
    }
    const tasks = status.tasks ?? [];
    const task = (action: AssemblyTaskAction) =>
        tasks.find((each) => each.action === action);
    const index = task(AssemblyTaskAction.INDEX);
    const stopped =
        status.error ??
        tasks.find((each) => each.state === AssemblyTaskState.FAILED)?.reason;

    return (
        <Stack gap="md">
            {stopped && (
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
                    description={stopped}
                />
            )}
            <Stack gap="sm" onMouseLeave={() => show(focusedPicks())}>
                {index && (
                    <StepRow
                        step={stepOf(index)}
                        label={m.autoAssemblyTaskIndex()}
                    />
                )}
                {(status.screws ?? []).map((screw, screwIndex) => (
                    <ScrewSteps
                        key={screw.hole}
                        screw={screw}
                        index={screwIndex}
                        remove={task(AssemblyTaskAction.REMOVE)}
                        insert={task(AssemblyTaskAction.INSERT)}
                        fasten={task(AssemblyTaskAction.FASTEN)}
                        show={show}
                    />
                ))}
            </Stack>
            {status.picks && status.picks.length > 0 && (
                <PickGroups picks={status.picks} />
            )}
        </Stack>
    );
}

/** How a step went: a run's own step, or one screw's part of it. */
interface Step {
    state: AssemblyTaskState;
    /** Why it failed, or what it left undone, written for the user. */
    detail?: string;
    hasWarning?: boolean;
}

const stepOf = (task: AssemblyTask): Step => ({
    state: task.state,
    detail: task.state === AssemblyTaskState.DONE ? task.warning : task.reason,
    hasWarning: task.warning !== undefined
});

interface StepIconProps {
    step: Step;
}

function StepIcon(props: StepIconProps): ReactNode {
    const { step } = props;
    switch (step.state) {
        case AssemblyTaskState.RUNNING:
            return <Loader size={IconSize.SMALL} />;
        case AssemblyTaskState.DONE:
            return (
                <StatusIcon
                    status={step.hasWarning ? Status.WARNING : Status.SUCCESS}
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

interface StepRowProps {
    step: Step;
    label: string;
    onHover?: () => void;
}

function StepRow(props: StepRowProps): ReactNode {
    const { step, label, onHover } = props;
    const isQuiet =
        step.state === AssemblyTaskState.PENDING ||
        step.state === AssemblyTaskState.SKIPPED;

    return (
        <div onMouseEnter={onHover}>
            <DetailRow
                icon={<StepIcon step={step} />}
                detail={
                    step.detail && (
                        <Text size="xs" c={StatusColor.DIMMED}>
                            {step.detail}
                        </Text>
                    )
                }
            >
                <Text c={isQuiet ? StatusColor.DIMMED : undefined}>
                    {label}
                </Text>
            </DetailRow>
        </div>
    );
}

/** Where a screw's parts are listed, whatever order they were inserted in. */
const ROLE_ORDER = [
    RunPartRole.SCREW,
    RunPartRole.SCREW_WASHER,
    RunPartRole.NUT,
    RunPartRole.NUT_WASHER
];

function partLabel(role: RunPartRole): string {
    switch (role) {
        case RunPartRole.SCREW:
            return m.autoAssemblyTaskInsertScrew();
        case RunPartRole.SCREW_WASHER:
            return m.autoAssemblyTaskAddScrewWasher();
        case RunPartRole.NUT:
            return m.autoAssemblyTaskAddNut();
        case RunPartRole.NUT_WASHER:
            return m.autoAssemblyTaskAddNutWasher();
    }
}

/** A part's step: inserted with the rest, then fastened where it sits. */
function partStep(
    part: RunPart,
    insert: AssemblyTask | undefined,
    fasten: AssemblyTask | undefined
): Step {
    if (!insert || insert.state !== AssemblyTaskState.DONE) {
        return { state: insert?.state ?? AssemblyTaskState.PENDING };
    }
    if (!part.path) {
        return {
            state: AssemblyTaskState.FAILED,
            detail: m.autoAssemblyPartNotInserted()
        };
    }
    if (
        !fasten ||
        fasten.state === AssemblyTaskState.PENDING ||
        fasten.state === AssemblyTaskState.RUNNING
    ) {
        return { state: AssemblyTaskState.RUNNING };
    }
    return part.isFastened
        ? { state: AssemblyTaskState.DONE }
        : {
              state: AssemblyTaskState.DONE,
              detail: m.autoAssemblyPartUnmated(),
              hasWarning: true
          };
}

interface ScrewStepsProps {
    screw: RunScrew;
    index: number;
    remove: AssemblyTask | undefined;
    insert: AssemblyTask | undefined;
    fasten: AssemblyTask | undefined;
    show: (shown: HighlightedEntity[]) => void;
}

/** One screw's steps: deleting the one it updates, then adding each part. */
function ScrewSteps(props: ScrewStepsProps): ReactNode {
    const { screw, index, remove, insert, fasten, show } = props;
    const parts = [...screw.parts].sort(
        (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
    );

    return (
        <Stack gap={6}>
            <Text size="xs" c={StatusColor.DIMMED}>
                {m.autoAssemblyScrewTasks({ index: index + 1 })}
            </Text>
            {screw.isUpdate && remove && (
                <StepRow
                    step={{ state: remove.state }}
                    label={m.autoAssemblyTaskDeleteScrew()}
                />
            )}
            {parts.map((part) => {
                const { path } = part;
                return (
                    <StepRow
                        key={part.role}
                        step={partStep(part, insert, fasten)}
                        label={partLabel(part.role)}
                        onHover={
                            path
                                ? () => show([{ occurrencePath: path }])
                                : undefined
                        }
                    />
                );
            })}
        </Stack>
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
            return m.autoAssemblyScrewsToUpdate();
        case PickList.STOP_FACE:
            return m.autoAssemblyStopFaceList();
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

/** Lights entities up in the Onshape window, in place of what it shows. */
function useShowInOnshape(): (shown: HighlightedEntity[]) => void {
    const target = useTargetElement();
    return (shown) => {
        if (target) {
            sendHighlightMessage(target, shown);
        }
    };
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
    const show = useShowInOnshape();
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
