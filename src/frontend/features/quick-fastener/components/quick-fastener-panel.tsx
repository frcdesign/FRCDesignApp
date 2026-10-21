import { Button, Group, Stack, Text } from "@mantine/core";
import { useEffect, type ReactNode } from "react";
import {
    HoleStatus,
    type PlannedHole,
    type QuickFastenerIn,
    SelectedEntityType
} from "@backend/features/quick-fastener/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { QueryList } from "../../../components/query-list";
import { StatusIcon } from "../../../components/status-icon";
import { selectionKey, type OnshapeSelection } from "../../../lib/selection";
import { Status } from "../../../lib/status";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { describePlan } from "../options";
import { useInsertMutation, usePlanMutation } from "../queries";
import { useQuickFastenerStore } from "../store";
import { FastenerOptionsForm } from "./fastener-options-form";

const HOLE_STATUS: Record<HoleStatus, Status> = {
    [HoleStatus.READY]: Status.SUCCESS,
    [HoleStatus.FASTENED]: Status.INFO,
    [HoleStatus.NO_FIT]: Status.WARNING
};

/** Circular edges, and faces whose circles are each fastened. */
function isHoleOrFace(entity: OnshapeSelection): boolean {
    return (
        entity.entityType === SelectedEntityType.EDGE ||
        entity.entityType === SelectedEntityType.FACE
    );
}

function toEntities(selections: OnshapeSelection[]) {
    return selections.map((selection) => ({
        occurrencePath: selection.occurrencePath,
        entityId: selection.selectionId,
        entityType: selection.entityType as SelectedEntityType
    }));
}

interface QuickFastenerPanelProps {
    assembly: ElementPath;
}

/** What to fasten, with what, and the fastener each hole gets. */
export function QuickFastenerPanel(props: QuickFastenerPanelProps): ReactNode {
    const { assembly } = props;
    const options = useQuickFastenerStore((state) => state.options);
    const targets = useQuickFastenerStore((state) => state.targets);
    const excluded = useQuickFastenerStore((state) => state.excluded);
    const setTargets = useQuickFastenerStore((state) => state.setTargets);
    const setExcluded = useQuickFastenerStore((state) => state.setExcluded);
    const planMutation = usePlanMutation();
    const insertMutation = useInsertMutation();
    const { reset } = planMutation;

    // A preview answers the picks and options it was made with
    useEffect(() => reset(), [reset, options, targets, excluded]);

    const body: QuickFastenerIn = {
        assembly,
        targets: toEntities(targets),
        excluded: toEntities(excluded),
        options
    };
    const holes = planMutation.data?.holes ?? [];
    const plannedBy = new Map(holes.map((hole) => [hole.key, hole]));
    const ready = holes.filter((hole) => hole.status === HoleStatus.READY);
    const canRun = targets.length > 0 && !insertMutation.isPending;

    const holeStatus = (entity: OnshapeSelection) => {
        const planned = plannedBy.get(selectionKey(entity));
        return planned ? (
            <StatusIcon
                status={HOLE_STATUS[planned.status]}
                size={IconSize.SMALL}
            />
        ) : undefined;
    };

    const insert = () => {
        insertMutation.mutate(body, {
            onSuccess: () => {
                setTargets([]);
                setExcluded([]);
            }
        });
    };

    return (
        <Stack gap="md" p="md">
            <QueryList
                id="quick-fastener-targets"
                label="Holes to fasten"
                prompt="Select the edges of holes, or faces to fasten every hole in."
                entities={targets}
                onChange={setTargets}
                accepts={isHoleOrFace}
                rowSection={holeStatus}
            />
            <QueryList
                id="quick-fastener-excluded"
                label="Holes to skip"
                prompt="Select the edges of holes to leave out, or faces to leave out every hole in."
                entities={excluded}
                onChange={setExcluded}
                accepts={isHoleOrFace}
            />
            <FastenerOptionsForm />
            <Group grow>
                <Button
                    variant="default"
                    disabled={!canRun}
                    loading={planMutation.isPending}
                    onClick={() => planMutation.mutate(body)}
                >
                    Preview
                </Button>
                <Button
                    disabled={!canRun}
                    loading={insertMutation.isPending}
                    onClick={insert}
                >
                    Insert
                </Button>
            </Group>
            {planMutation.data && (
                <PlanSummary holes={holes} readyCount={ready.length} />
            )}
        </Stack>
    );
}

interface PlanSummaryProps {
    holes: PlannedHole[];
    readyCount: number;
}

/** Each hole's fastener, or why it gets none. */
function PlanSummary(props: PlanSummaryProps): ReactNode {
    const { holes, readyCount } = props;
    if (holes.length === 0) {
        return (
            <Text size="sm" c={StatusColor.DIMMED}>
                No holes found in what&apos;s selected.
            </Text>
        );
    }
    return (
        <Stack gap={4}>
            <Text size="sm">
                {readyCount} of {holes.length} holes ready to fasten
            </Text>
            {holes.map((hole) => (
                <Group key={hole.key} gap="xs" wrap="nowrap">
                    <StatusIcon
                        status={HOLE_STATUS[hole.status]}
                        size={IconSize.SMALL}
                    />
                    <Text size="sm" truncate>
                        {describePlan(hole)}
                    </Text>
                </Group>
            ))}
        </Stack>
    );
}
