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
import { SelectionMode } from "@backend/features/auto-assembly/contract";
import { AppHoverCard } from "../../../components/app-hover-card";
import { BadgedIcon } from "../../../components/badged-icon";
import { StatusIcon } from "../../../components/status-icon";
import { NewBadge, NewIndicator } from "../../../components/new-feature";
import { QueryList } from "../../../components/query-list";
import { Status } from "../../../lib/status";
import { IconSize, PrimaryColor } from "../../../lib/style-constants";
import { plural } from "../../../lib/plural";
import { isEdge, useOnshapeSelection } from "../../../lib/selection";
import { CIRCULAR_EDGES } from "../../../lib/messages";
import { updateUiState, useUiState } from "../../../lib/ui-state";
import { useHasSeenHint } from "../../hints/queries";
import { useIsSignedIn } from "../../auth/access-level";
import { ElementType } from "@backend/lib/onshape/element-type";
import { useTargetElementType } from "../insert-hooks";
import {
    acceptsTarget,
    targetFilter,
    FASTEN_EXCLUDED_LIST,
    FASTEN_TARGETS_LIST,
    isFastenList,
    setFastenExcluded,
    setFastenTargets,
    useFastenPicks,
    useFastenPicksForMode
} from "../fasten-picks";

/** Picks made before a quick insert, which the insert menu takes over while it's open. */
export function NavbarFastenStatus(): ReactNode {
    const targetElementType = useTargetElementType();
    const isSignedIn = useIsSignedIn();
    const isMenuOpen = useUiState(
        (state) => state.openInsertableId !== undefined
    );
    // Two lists of the same id would both take picks
    if (
        targetElementType !== ElementType.ASSEMBLY ||
        !isSignedIn ||
        isMenuOpen
    ) {
        return null;
    }
    return <FastenCircularEdgesStatus />;
}

/**
 * What an insert and fasten will fasten to, and where to pick more: in the
 * insert menu, and in the navbar for a quick insert, sharing the same picks.
 */
export function FastenCircularEdgesStatus(): ReactNode {
    const mode = useUiState((state) => state.fastenSelectionMode);
    const targets = useFastenPicks((state) => state.targets);
    const excluded = useFastenPicks((state) => state.excluded);
    const isPicking = useOnshapeSelection((state) =>
        isFastenList(state.focused)
    );
    const hasFastened = useHasSeenHint(Hint.FASTENED_TO_CIRCULAR_EDGES);
    useFastenPicksForMode(mode);

    const isFaces = mode === SelectionMode.FACES;
    const found = targets.length > 0;
    const isNew = !found && !hasFastened;
    const status = found ? Status.SUCCESS : Status.ERROR;
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
                    description={describeFasten(mode, targets.length)}
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
                            ? "Select faces to fasten parts to every hole in."
                            : "Select circular edges to fasten parts to."
                    }
                    entities={targets}
                    onChange={setFastenTargets}
                    accepts={acceptsTarget(mode)}
                    filter={targetFilter(mode)}
                    autoFocus
                />
                {isFaces && (
                    <QueryList
                        id={FASTEN_EXCLUDED_LIST}
                        label="Holes to skip"
                        prompt="Select the edges of holes to leave out."
                        entities={excluded}
                        onChange={setFastenExcluded}
                        accepts={isEdge}
                        filter={CIRCULAR_EDGES}
                    />
                )}
            </Stack>
        </AppHoverCard>
    );
}

function describeFasten(mode: SelectionMode, count: number): string {
    if (mode === SelectionMode.FACES) {
        return count === 0
            ? "Select faces to automatically fasten inserted parts to every hole in them."
            : "A part will be inserted and fastened to every hole in the selected faces.";
    }
    if (count === 0) {
        return "Select edges to automatically fasten inserted parts to.";
    }
    if (count === 1) {
        return "The part will be fastened to the selected edge.";
    }
    return "A part will be inserted and fastened to each selected edge.";
}
