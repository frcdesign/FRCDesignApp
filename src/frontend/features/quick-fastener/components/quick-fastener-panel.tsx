import { Button, SegmentedControl, Stack } from "@mantine/core";
import { type ReactNode } from "react";
import {
    FastenerJobState,
    type QuickFastenerIn,
    SelectionMode
} from "@backend/features/quick-fastener/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { QueryList } from "../../../components/query-list";
import { isEdge, isFace, toSelectedEntities } from "../../../lib/selection";
import { useFastenerJobQuery, useInsertMutation } from "../queries";
import { useQuickFastenerStore } from "../store";
import { FastenerOptionsForm } from "./fastener-options-form";
import { LastRunCallout } from "./last-run-callout";

interface QuickFastenerPanelProps {
    assembly: ElementPath;
}

/** How the last run went, what to fasten with, and what to fasten. */
export function QuickFastenerPanel(props: QuickFastenerPanelProps): ReactNode {
    const { assembly } = props;
    const options = useQuickFastenerStore((state) => state.options);
    const selectionMode = useQuickFastenerStore((state) => state.selectionMode);
    const targets = useQuickFastenerStore((state) => state.targets);
    const excluded = useQuickFastenerStore((state) => state.excluded);
    const setSelectionMode = useQuickFastenerStore(
        (state) => state.setSelectionMode
    );
    const setTargets = useQuickFastenerStore((state) => state.setTargets);
    const setExcluded = useQuickFastenerStore((state) => state.setExcluded);
    const { data: job } = useFastenerJobQuery(assembly);
    const insertMutation = useInsertMutation(assembly);

    const isFaces = selectionMode === SelectionMode.FACES;
    const isRunning = job?.state === FastenerJobState.RUNNING;

    const insert = () => {
        const body: QuickFastenerIn = {
            assembly,
            selectionMode,
            targets: toSelectedEntities(targets),
            excluded: isFaces ? toSelectedEntities(excluded) : [],
            options
        };
        insertMutation.mutate(body, {
            onSuccess: () => {
                setTargets([]);
                setExcluded([]);
            }
        });
    };

    return (
        <Stack gap="md" p="md">
            <LastRunCallout assembly={assembly} />
            <FastenerOptionsForm />
            <SegmentedControl
                fullWidth
                data={[
                    { value: SelectionMode.FACES, label: "Faces" },
                    { value: SelectionMode.LOCATIONS, label: "Circular edges" }
                ]}
                value={selectionMode}
                onChange={(value) => setSelectionMode(value)}
            />
            {isFaces ? (
                <>
                    <QueryList
                        id="quick-fastener-faces"
                        label="Faces"
                        prompt="Select faces to fasten every hole in."
                        entities={targets}
                        onChange={setTargets}
                        accepts={isFace}
                    />
                    <QueryList
                        id="quick-fastener-excluded"
                        label="Holes to skip"
                        prompt="Select the edges of holes to leave out."
                        entities={excluded}
                        onChange={setExcluded}
                        accepts={isEdge}
                    />
                </>
            ) : (
                <QueryList
                    id="quick-fastener-locations"
                    label="Circular edges"
                    prompt="Select the circular edges of holes to fasten."
                    entities={targets}
                    onChange={setTargets}
                    accepts={isEdge}
                />
            )}
            <Button
                disabled={
                    targets.length === 0 ||
                    isRunning ||
                    insertMutation.isPending
                }
                loading={insertMutation.isPending}
                onClick={insert}
            >
                Insert
            </Button>
        </Stack>
    );
}
