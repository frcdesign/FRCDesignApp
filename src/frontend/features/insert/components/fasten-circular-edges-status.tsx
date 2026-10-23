import { ReactNode } from "react";
import {
    Center,
    EmptyState,
    Group,
    SegmentedControl,
    Stack
} from "@mantine/core";
import { CursorClickIcon } from "@phosphor-icons/react";
import { Hint } from "@backend/features/hints/contract";
import { SelectionMode } from "@backend/features/quick-fastener/contract";
import { AppHoverCard } from "../../../components/app-hover-card";
import { BadgedIcon } from "../../../components/badged-icon";
import { StatusIcon } from "../../../components/status-icon";
import { InfoCheckbox } from "../../../components/info-checkbox";
import { NewBadge, NewIndicator } from "../../../components/new-feature";
import { QueryList } from "../../../components/query-list";
import { Status } from "../../../lib/status";
import { IconSize, PrimaryColor } from "../../../lib/style-constants";
import { plural } from "../../../lib/plural";
import { isEdge, useOnshapeSelection } from "../../../lib/selection";
import { updateUiState, useUiState } from "../../../lib/ui-state";
import { useHasSeenHint } from "../../hints/queries";
import {
    acceptsTarget,
    FASTEN_EXCLUDED_LIST,
    FASTEN_TARGETS_LIST,
    isFastenList,
    setFastenExcluded,
    setFastenTargets,
    useFastenPicks,
    useFastenPicksFromSelection
} from "../fasten-picks";

interface FastenCircularEdgesStatusProps {
    /** Whether an editor allowed the part to replicate. */
    supportsReplicate: boolean;
}

/** For an insert that will fasten: what it will fasten to, and where to pick more. */
export function FastenCircularEdgesStatus(
    props: FastenCircularEdgesStatusProps
): ReactNode {
    const { supportsReplicate } = props;
    const mode = useUiState((state) => state.fastenSelectionMode);
    const replicate = useUiState((state) => state.replicate);
    const targets = useFastenPicks((state) => state.targets);
    const excluded = useFastenPicks((state) => state.excluded);
    const isPicking = useOnshapeSelection((state) =>
        isFastenList(state.focused)
    );
    const hasFastened = useHasSeenHint(Hint.FASTENED_TO_CIRCULAR_EDGES);
    useFastenPicksFromSelection(mode);

    const isFaces = mode === SelectionMode.FACES;
    const found = targets.length > 0;
    const isNew = !found && !hasFastened;
    const status = found ? Status.SUCCESS : Status.ERROR;
    const canReplicate =
        supportsReplicate && (isFaces ? found : targets.length > 1);
    const noun = isFaces ? "face" : "circular edge";

    return (
        <AppHoverCard
            position="bottom-end"
            interactive
            keepMounted
            target={
                <Center my="auto">
                    <NewIndicator shown={isNew} offset={2}>
                        <BadgedIcon
                            icon={CursorClickIcon}
                            status={status}
                            // Still taking picks after the card closes.
                            color={isPicking ? PrimaryColor.FILLED : undefined}
                        />
                    </NewIndicator>
                </Center>
            }
        >
            <Stack gap="sm" w={300}>
                <EmptyState
                    align="left"
                    size="sm"
                    icon={
                        <StatusIcon status={status} size={IconSize.CONTROL} />
                    }
                    title={
                        <Group gap="xs">
                            {found
                                ? `${plural(targets.length, noun)} selected`
                                : `No ${noun}s selected`}
                            {isNew && <NewBadge />}
                        </Group>
                    }
                    description={describeFasten(
                        mode,
                        targets.length,
                        canReplicate && replicate
                    )}
                />
                <SegmentedControl
                    fullWidth
                    size="xs"
                    data={[
                        {
                            value: SelectionMode.LOCATIONS,
                            label: "Circular edges"
                        },
                        { value: SelectionMode.FACES, label: "Faces" }
                    ]}
                    value={mode}
                    onChange={(value) =>
                        updateUiState({
                            fastenSelectionMode: value
                        })
                    }
                />
                <QueryList
                    id={FASTEN_TARGETS_LIST}
                    label={isFaces ? "Faces" : "Circular edges"}
                    prompt={
                        isFaces
                            ? "Select faces to fasten this part to every hole in."
                            : "Select circular edges to fasten this part to."
                    }
                    entities={targets}
                    onChange={setFastenTargets}
                    accepts={acceptsTarget(mode)}
                />
                {isFaces && (
                    <QueryList
                        id={FASTEN_EXCLUDED_LIST}
                        label="Holes to skip"
                        prompt="Select the edges of holes to leave out."
                        entities={excluded}
                        onChange={setFastenExcluded}
                        accepts={isEdge}
                    />
                )}
                {canReplicate && (
                    <InfoCheckbox
                        label="Replicate"
                        info="Insert one part and replicate it onto the other holes, rather than inserting a part for each."
                        checked={replicate}
                        onChange={(checked) =>
                            updateUiState({ replicate: checked })
                        }
                    />
                )}
            </Stack>
        </AppHoverCard>
    );
}

function describeFasten(
    mode: SelectionMode,
    count: number,
    replicate: boolean
): string {
    if (mode === SelectionMode.FACES) {
        if (count === 0) {
            return "Select faces to automatically fasten this part to every hole in them.";
        }
        return replicate
            ? "A part will be fastened to a hole and replicated onto every other hole in the selected faces."
            : "A part will be inserted and fastened to every hole in the selected faces.";
    }
    if (count === 0) {
        return "Select edges to automatically fasten this part to.";
    }
    if (count === 1) {
        return "The part will be fastened to the selected edge.";
    }
    return replicate
        ? "A part will be fastened to an edge and replicated onto the rest."
        : "A part will be inserted and fastened to each selected edge.";
}
