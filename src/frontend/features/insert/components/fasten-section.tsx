import { ReactNode, useMemo } from "react";
import { Text } from "@mantine/core";
import { InsertableOut } from "@backend/features/library/contract";
import {
    type PickCheckIn,
    SelectionMode
} from "@backend/features/auto-assembly/contract";
import {
    type EnumParameter,
    ParameterType
} from "@backend/features/configurations/contract";
import {
    FullWidthRow,
    ParameterGroup
} from "../../../components/parameter-group";
import { ParameterInput } from "../../../components/parameter-input";
import { QueryList } from "../../../components/query-list";
import { CIRCULAR_EDGES } from "../../../lib/messages";
import { useTargetAssembly } from "../../../lib/onshape-params";
import {
    isEdge,
    type OnshapeSelection,
    selectionKey,
    toSelectedEntities
} from "../../../lib/selection";
import { StatusColor } from "../../../lib/style-constants";
import { updateUiState, useUiState } from "../../../lib/ui-state";
import { m } from "../../../paraglide/messages";
import { usePickProblems } from "../../auto-assembly/queries";
import { useCanFasten } from "../insert-hooks";
import {
    acceptsTarget,
    targetFilter,
    FASTEN_EXCLUDED_LIST,
    FASTEN_TARGETS_LIST,
    setFastenExcluded,
    setFastenTargets,
    useFastenPicks,
    useFastenPicksForMode
} from "../fasten-picks";

const SELECT_BY: EnumParameter = {
    type: ParameterType.ENUM,
    id: "placement-select-by",
    name: m.placementSelectBy(),
    default: SelectionMode.LOCATIONS,
    options: [
        { id: SelectionMode.LOCATIONS, name: m.fastenCircularEdges() },
        { id: SelectionMode.FACES, name: m.fastenFaces() }
    ],
    optionConditions: []
};

const PARAMETERS = [SELECT_BY];

interface FastenSectionProps {
    insertable: InsertableOut;
}

/**
 * In the insert menu's `ParameterGrid`: whether an insert into the open
 * assembly also fastens the part, and what it fastens to. Nothing for a part
 * that can't fasten.
 */
export function FastenSection(props: FastenSectionProps): ReactNode {
    const canFasten = useCanFasten(props.insertable);
    const fasten = useUiState((state) => state.fasten);
    if (!canFasten) {
        return null;
    }
    return (
        <ParameterGroup
            title={m.placementFasten()}
            checked={fasten}
            onCheckedChange={(checked) => updateUiState({ fasten: checked })}
        >
            <FastenPicks />
        </ParameterGroup>
    );
}

/** What an insert and fasten mates to: how it's picked, and the query lists taking the picks. */
export function FastenPicks(): ReactNode {
    const assembly = useTargetAssembly();
    const mode = useUiState((state) => state.fastenSelectionMode);
    const targets = useFastenPicks((state) => state.targets);
    const excluded = useFastenPicks((state) => state.excluded);
    const isFaces = mode === SelectionMode.FACES;
    const checkBody = useMemo(
        (): PickCheckIn | undefined =>
            !assembly ||
            assembly.instanceType !== "w" ||
            targets.length + excluded.length === 0
                ? undefined
                : {
                      assembly: {
                          documentId: assembly.documentId,
                          instanceType: assembly.instanceType,
                          instanceId: assembly.instanceId,
                          elementId: assembly.elementId
                      },
                      selectionMode: mode,
                      targets: toSelectedEntities(targets),
                      excluded: isFaces ? toSelectedEntities(excluded) : [],
                      replaced: []
                  },
        [assembly, mode, isFaces, targets, excluded]
    );
    const { problems, isChecking } = usePickProblems(checkBody);
    useFastenPicksForMode(mode);

    const problem = (entity: OnshapeSelection) =>
        problems.get(selectionKey(entity));

    return (
        <>
            <ParameterInput
                parameter={SELECT_BY}
                value={mode}
                selection={{}}
                parameters={PARAMETERS}
                onValueChange={(value) =>
                    value !== undefined &&
                    updateUiState({
                        fastenSelectionMode: value as SelectionMode
                    })
                }
            />
            <FullWidthRow>
                <QueryList
                    id={FASTEN_TARGETS_LIST}
                    // Picks before an insert are whatever's selected; limiting them would get in the way
                    isPassive
                    label={isFaces ? m.fastenFaces() : m.fastenCircularEdges()}
                    prompt={
                        isFaces
                            ? m.fastenFacesPrompt()
                            : m.fastenCircularEdgesPrompt()
                    }
                    entities={targets}
                    onChange={setFastenTargets}
                    accepts={acceptsTarget(mode)}
                    filter={targetFilter(mode)}
                    autoFocus
                    problem={problem}
                    isChecking={isChecking}
                />
            </FullWidthRow>
            {isFaces && (
                <FullWidthRow>
                    <QueryList
                        id={FASTEN_EXCLUDED_LIST}
                        isPassive
                        label={m.fastenEdgesToExclude()}
                        prompt={m.fastenEdgesToExcludePrompt()}
                        entities={excluded}
                        onChange={setFastenExcluded}
                        accepts={isEdge}
                        filter={CIRCULAR_EDGES}
                        problem={problem}
                        isChecking={isChecking}
                    />
                </FullWidthRow>
            )}
            <FullWidthRow>
                <Text size="xs" c={StatusColor.DIMMED}>
                    {describeFasten(mode, targets.length)}
                </Text>
            </FullWidthRow>
        </>
    );
}

function describeFasten(mode: SelectionMode, count: number): string {
    if (mode === SelectionMode.FACES) {
        return count === 0 ? m.fastenFacesNone() : m.fastenFacesSome();
    }
    if (count === 0) {
        return m.fastenCircularEdgesNone();
    }
    if (count === 1) {
        return m.fastenCircularEdgesOne();
    }
    return m.fastenCircularEdgesMany();
}
