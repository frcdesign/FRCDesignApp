import { Button, Stack } from "@mantine/core";
import { type ReactNode, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Program } from "@backend/features/quick-fastener/catalog";
import {
    FastenerJobState,
    type QuickFastenerIn,
    SelectionMode
} from "@backend/features/quick-fastener/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { ParameterGrid } from "../../../components/parameter-input";
import { QueryList } from "../../../components/query-list";
import { isEdge, isFace, toSelectedEntities } from "../../../lib/selection";
import { fastenerOptions, selectionMode, settleChoices } from "../options";
import { FormInput } from "../parameters";
import { useFastenerJobQuery, useInsertMutation } from "../queries";
import { useQuickFastenerStore } from "../store";
import { FastenerOptionsForm, FormInputRow } from "./fastener-options-form";
import { LastRunCallout } from "./last-run-callout";
import { FullWidthRow, ParameterGroup } from "./parameter-group";

interface QuickFastenerPanelProps {
    assembly: ElementPath;
}

/** How the last run went, what to fasten, and with what. */
export function QuickFastenerPanel(props: QuickFastenerPanelProps): ReactNode {
    const { assembly } = props;
    const choices = useQuickFastenerStore(
        useShallow((state) => ({
            form: state.form,
            mode: state.mode,
            screw: state.screw,
            parts: state.parts,
            added: state.added
        }))
    );
    const targets = useQuickFastenerStore((state) => state.targets);
    const excluded = useQuickFastenerStore((state) => state.excluded);
    const setTargets = useQuickFastenerStore((state) => state.setTargets);
    const setExcluded = useQuickFastenerStore((state) => state.setExcluded);
    const { data: job } = useFastenerJobQuery(assembly);
    const insertMutation = useInsertMutation(assembly);

    const settled = useMemo(() => settleChoices(choices), [choices]);
    const mode = selectionMode(settled);
    const isFaces = mode === SelectionMode.FACES;
    const isRunning = job?.state === FastenerJobState.RUNNING;
    const isFtc = settled.form[FormInput.PROGRAM] === Program.FTC;

    const insert = () => {
        const body: QuickFastenerIn = {
            assembly,
            selectionMode: mode,
            targets: toSelectedEntities(targets),
            excluded: isFaces ? toSelectedEntities(excluded) : [],
            options: fastenerOptions(settled)
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
            <ParameterGrid>
                <ParameterGroup title="Selections">
                    <FormInputRow id={FormInput.SELECT_BY} settled={settled} />
                    {isFaces ? (
                        <>
                            <FullWidthRow>
                                <QueryList
                                    id="quick-fastener-faces"
                                    label="Faces"
                                    prompt="Select faces to fasten every hole in."
                                    entities={targets}
                                    onChange={setTargets}
                                    accepts={isFace}
                                />
                            </FullWidthRow>
                            <FullWidthRow>
                                <QueryList
                                    id="quick-fastener-excluded"
                                    label="Holes to skip"
                                    prompt="Select the edges of holes to leave out."
                                    entities={excluded}
                                    onChange={setExcluded}
                                    accepts={isEdge}
                                />
                            </FullWidthRow>
                        </>
                    ) : (
                        <FullWidthRow>
                            <QueryList
                                id="quick-fastener-locations"
                                label="Circular edges"
                                prompt="Select the circular edges of holes to fasten."
                                entities={targets}
                                onChange={setTargets}
                                accepts={isEdge}
                            />
                        </FullWidthRow>
                    )}
                </ParameterGroup>
                <FastenerOptionsForm settled={settled} />
            </ParameterGrid>
            <Button
                disabled={
                    isFtc ||
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
