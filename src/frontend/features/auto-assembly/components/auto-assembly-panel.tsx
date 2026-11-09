import { Button, Stack } from "@mantine/core";
import { type ReactNode, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Program } from "@backend/features/auto-assembly/catalog";
import {
    AssemblyJobState,
    type AutoAssemblyIn,
    type PickCheckIn,
    SelectionMode
} from "@backend/features/auto-assembly/contract";
import { type FastenerSet } from "@backend/features/auto-assembly/studios";
import { type ElementPath } from "@backend/lib/onshape/path";
import {
    SectionError,
    SectionLoading,
    SectionNotice
} from "../../../components/app-notice";
import { StatusIcon } from "../../../components/status-icon";
import { Status } from "../../../lib/status";
import { IconSize } from "../../../lib/style-constants";
import { ParameterGrid } from "../../../components/parameter-input";
import { QueryList } from "../../../components/query-list";
import {
    isBody,
    isEdge,
    isFace,
    type OnshapeSelection,
    selectionKey,
    toSelectedEntities
} from "../../../lib/selection";
import {
    CIRCULAR_EDGES,
    PLANAR_FACES,
    SOLID_BODIES
} from "../../../lib/messages";
import { fastenerOptions, selectionMode, settleChoices } from "../options";
import { FormInput } from "../parameters";
import {
    useAssemblyJobQuery,
    useFastenerSetQuery,
    useInsertMutation,
    usePickProblems
} from "../queries";
import { useAutoAssemblyStore } from "../store";
import { FastenerOptionsForm, FormInputRow } from "./fastener-options-form";
import { LastRunCallout } from "./last-run-callout";
import { m } from "../../../paraglide/messages";
import { FullWidthRow, ParameterGroup } from "./parameter-group";

interface AutoAssemblyPanelProps {
    assembly: ElementPath;
}

/** The form, once the fasteners the library loaded are read. */
export function AutoAssemblyPanel(props: AutoAssemblyPanelProps): ReactNode {
    const { assembly } = props;
    const { data: set, isPending, isError } = useFastenerSetQuery();

    if (isPending) {
        return <SectionLoading title={m.autoAssemblyFastenersLoading()} />;
    }
    if (isError) {
        return <SectionError title={m.autoAssemblyFastenersFailed()} />;
    }
    if (!set) {
        return (
            <SectionNotice
                icon={
                    <StatusIcon status={Status.WARNING} size={IconSize.PAGE} />
                }
                title={m.autoAssemblyNoFastenersTitle()}
                description={m.autoAssemblyNoFastenersDescription()}
            />
        );
    }
    return <AutoAssemblyForm assembly={assembly} set={set} />;
}

interface AutoAssemblyFormProps {
    assembly: ElementPath;
    set: FastenerSet;
}

/** How the last run went, what to fasten with, and what to fasten. */
function AutoAssemblyForm(props: AutoAssemblyFormProps): ReactNode {
    const { assembly, set } = props;
    const choices = useAutoAssemblyStore(
        useShallow((state) => ({
            form: state.form,
            mode: state.mode,
            screw: state.screw,
            parts: state.parts,
            added: state.added
        }))
    );
    const targets = useAutoAssemblyStore((state) => state.targets);
    const excluded = useAutoAssemblyStore((state) => state.excluded);
    const replaced = useAutoAssemblyStore((state) => state.replaced);
    const setTargets = useAutoAssemblyStore((state) => state.setTargets);
    const setExcluded = useAutoAssemblyStore((state) => state.setExcluded);
    const setReplaced = useAutoAssemblyStore((state) => state.setReplaced);
    const { data: job } = useAssemblyJobQuery(assembly);
    const insertMutation = useInsertMutation(assembly);
    const settled = useMemo(() => settleChoices(set, choices), [set, choices]);
    const mode = selectionMode(settled);
    const isFaces = mode === SelectionMode.FACES;
    const isFtc = settled.form[FormInput.PROGRAM] === Program.FTC;
    const checkBody = useMemo(
        (): PickCheckIn | undefined =>
            targets.length + excluded.length + replaced.length === 0
                ? undefined
                : {
                      assembly,
                      selectionMode: mode,
                      targets: toSelectedEntities(targets),
                      excluded: isFaces ? toSelectedEntities(excluded) : [],
                      replaced: toSelectedEntities(replaced),
                      options: isFtc ? undefined : fastenerOptions(settled)
                  },
        [assembly, mode, isFaces, isFtc, settled, targets, excluded, replaced]
    );
    const problems = usePickProblems(checkBody);

    const isRunning = job?.state === AssemblyJobState.RUNNING;
    const problem = (entity: OnshapeSelection) =>
        problems.get(selectionKey(entity));

    const insert = () => {
        const body: AutoAssemblyIn = {
            assembly,
            selectionMode: mode,
            targets: toSelectedEntities(targets),
            excluded: isFaces ? toSelectedEntities(excluded) : [],
            replaced: toSelectedEntities(replaced),
            options: fastenerOptions(settled)
        };
        insertMutation.mutate(body, {
            onSuccess: () => {
                setTargets([]);
                setExcluded([]);
                setReplaced([]);
            }
        });
    };

    return (
        <Stack gap="md" p="md">
            <LastRunCallout assembly={assembly} />
            <ParameterGrid>
                <FastenerOptionsForm settled={settled} />
                <ParameterGroup title={m.autoAssemblySelections()}>
                    <FormInputRow id={FormInput.SELECT_BY} settled={settled} />
                    {isFaces ? (
                        <>
                            <FullWidthRow>
                                <QueryList
                                    id="auto-assembly-faces"
                                    autoFocus
                                    label={m.autoAssemblyFaces()}
                                    prompt={m.autoAssemblyFacesPrompt()}
                                    entities={targets}
                                    onChange={setTargets}
                                    accepts={isFace}
                                    filter={PLANAR_FACES}
                                    problem={problem}
                                />
                            </FullWidthRow>
                            <FullWidthRow>
                                <QueryList
                                    id="auto-assembly-excluded"
                                    label={m.autoAssemblyHolesToSkip()}
                                    prompt={m.autoAssemblyHolesToSkipPrompt()}
                                    entities={excluded}
                                    onChange={setExcluded}
                                    accepts={isEdge}
                                    filter={CIRCULAR_EDGES}
                                    problem={problem}
                                />
                            </FullWidthRow>
                        </>
                    ) : (
                        <FullWidthRow>
                            <QueryList
                                id="auto-assembly-locations"
                                autoFocus
                                label={m.autoAssemblyCircularEdges()}
                                prompt={m.autoAssemblyCircularEdgesPrompt()}
                                entities={targets}
                                onChange={setTargets}
                                accepts={isEdge}
                                filter={CIRCULAR_EDGES}
                                problem={problem}
                            />
                        </FullWidthRow>
                    )}
                    <FullWidthRow>
                        <QueryList
                            id="auto-assembly-replaced"
                            label={m.autoAssemblyScrewsToReplace()}
                            prompt={m.autoAssemblyScrewsToReplacePrompt()}
                            entities={replaced}
                            onChange={setReplaced}
                            accepts={isBody}
                            filter={SOLID_BODIES}
                            problem={problem}
                            describe={(_entity, index) =>
                                m.autoAssemblyScrewRow({ index: index + 1 })
                            }
                        />
                    </FullWidthRow>
                </ParameterGroup>
            </ParameterGrid>
            <Button
                disabled={
                    isFtc ||
                    (targets.length === 0 && replaced.length === 0) ||
                    isRunning ||
                    insertMutation.isPending
                }
                loading={insertMutation.isPending}
                onClick={insert}
            >
                {m.autoAssemblyInsert()}
            </Button>
        </Stack>
    );
}
