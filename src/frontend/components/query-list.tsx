import {
    ActionIcon,
    Group,
    Loader,
    Paper,
    Stack,
    Text,
    UnstyledButton
} from "@mantine/core";
import { XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";
import {
    sendHighlightMessage,
    sendMessageBubble,
    sendSelectionRequest,
    sendStopRequestMessage,
    type HighlightedEntity,
    type SelectionFilter
} from "../lib/messages";
import { useTargetElement } from "../lib/onshape-params";
import {
    bumpLayout,
    focusedPicks,
    heldPicks,
    holdPicks,
    onPick,
    selectionKey,
    useOnshapeSelection,
    without,
    type OnshapeSelection
} from "../lib/selection";
import { IconSize, StatusColor } from "../lib/style-constants";
import { Status, STATUS_COLOR } from "../lib/status";
import { m } from "../paraglide/messages";

interface QueryListProps {
    /** Unique on the page: which list takes picks. */
    id: string;
    label: string;
    /** What to pick, in Onshape's message bubble when it's focused and when something else is picked. */
    prompt: string;
    entities: OnshapeSelection[];
    onChange: (entities: OnshapeSelection[]) => void;
    /** Which picks it takes; the rest are refused. */
    accepts: (entity: OnshapeSelection) => boolean;
    /** What the Onshape window lets be picked while it's focused. */
    filter: SelectionFilter;
    /** A row's name; its kind and number by default. */
    describe?: (entity: OnshapeSelection, index: number) => string;
    /** Beside a row's name: a status, say. */
    rowSection?: (entity: OnshapeSelection) => ReactNode;
    /** Takes picks whenever no list does, as a form's first list should. */
    autoFocus?: boolean;
    /** What's wrong with a row: shown under it, in its status's color. */
    problem?: (entity: OnshapeSelection) => RowProblem | undefined;
    /** Whether the rows' problems are being worked out, shown by a spinner beside Clear. */
    isChecking?: boolean;
}

/** Why a row won't do what it was picked for (an error), or what's off about how it will (a warning). */
export interface RowProblem {
    message: string;
    status: Status.ERROR | Status.WARNING;
}

function toHighlighted(entity: OnshapeSelection): HighlightedEntity {
    return {
        entityType: entity.entityType,
        selectionId: entity.selectionId,
        occurrencePath: entity.occurrencePath
    };
}

function defaultName(entity: OnshapeSelection, index: number): string {
    const kind = entity.entityType.toLowerCase();
    return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${index + 1}`;
}

/**
 * Onshape's query parameter, for entities picked in the Onshape window, named
 * inside its box as Onshape's are. Click it to focus it, and it follows the
 * window's selection: what's picked of the kind it takes is added, and what's
 * deselected is dropped. Hover a row to light its entity up alone. A form's
 * first list takes `autoFocus`, so whenever no list is focused it is.
 *
 * On focus, when a list is shown or hidden, and once its picks are cleared,
 * the focused list puts its prompt in Onshape's bubble and asks for the filter
 * or, holding picks, lights them up. A highlight cancels the filter, and a
 * request clears what the window shows, so hovering a row highlights its
 * entity alone, leaving lights the focused list's picks up, and the filter is
 * off until the list is clicked again.
 */
export function QueryList(props: QueryListProps): ReactNode {
    const {
        id,
        label,
        prompt,
        entities,
        onChange,
        accepts,
        filter,
        describe = defaultName,
        rowSection,
        autoFocus = false,
        problem,
        isChecking = false
    } = props;
    const target = useTargetElement();
    const isFocused = useOnshapeSelection((state) => state.focused === id);
    const isUnclaimed = useOnshapeSelection(
        (state) => state.focused === undefined
    );
    const layout = useOnshapeSelection((state) => state.layout);
    const isEmpty = entities.length === 0;
    // The stop names the request it ends
    const selectionRequest = useRef<string>(undefined);

    useEffect(
        () =>
            onPick(id, ({ added, removed, isHighlightCleared }) => {
                const kept = without(entities, removed);
                const keys = new Set(kept.map(selectionKey));
                const taken = added.filter(
                    (entity) =>
                        accepts(entity) && !keys.has(selectionKey(entity))
                );
                if (target && added.some((entity) => !accepts(entity))) {
                    sendMessageBubble(target, prompt);
                }
                if (target && isHighlightCleared) {
                    sendHighlightMessage(
                        target,
                        [...kept, ...taken].map(toHighlighted)
                    );
                }
                if (taken.length > 0 || kept.length !== entities.length) {
                    onChange([...kept, ...taken]);
                }
            }),
        [id, entities, onChange, accepts, target, prompt]
    );

    useEffect(() => holdPicks(id, entities), [id, entities]);

    useEffect(() => {
        bumpLayout();
        return bumpLayout;
    }, []);

    useEffect(() => {
        if (autoFocus && isUnclaimed) {
            useOnshapeSelection.getState().focus(id);
        }
    }, [autoFocus, isUnclaimed, id]);

    // Gone, it leaves picks to the form's first list
    useEffect(
        () => () => {
            if (useOnshapeSelection.getState().focused === id) {
                useOnshapeSelection.getState().focus(undefined);
            }
        },
        [id]
    );

    useEffect(() => {
        if (!target || !isFocused) {
            return;
        }
        sendMessageBubble(target, prompt);
        const picks = heldPicks(id);
        if (picks.length > 0) {
            sendHighlightMessage(target, picks.map(toHighlighted));
        } else {
            selectionRequest.current = sendSelectionRequest(target, filter);
        }
        return () => {
            if (selectionRequest.current) {
                sendStopRequestMessage(target, selectionRequest.current);
                selectionRequest.current = undefined;
            }
        };
    }, [target, isFocused, filter, prompt, id, layout]);

    // Cleared, by Clear, its last row's removal or the form, it asks for picks again
    const wasEmpty = useRef(isEmpty);
    useEffect(() => {
        if (target && isFocused && isEmpty && !wasEmpty.current) {
            sendMessageBubble(target, prompt);
            selectionRequest.current = sendSelectionRequest(target, filter);
        }
        wasEmpty.current = isEmpty;
    }, [target, isFocused, isEmpty, prompt, filter]);

    const focus = () => {
        useOnshapeSelection.getState().focus(id);
        // Newly focused, the focus effect asks; already, a highlight has cancelled the request since
        if (target && isFocused) {
            sendMessageBubble(target, prompt);
            selectionRequest.current = sendSelectionRequest(target, filter);
        }
    };

    const show = (picks: OnshapeSelection[]) => {
        if (target) {
            sendHighlightMessage(target, picks.map(toHighlighted));
        }
    };

    const highlight = (entity: OnshapeSelection) => show([entity]);

    // Back to the focused list's picks, whichever list the rows were in
    const unhighlight = () => show(focusedPicks());

    const remove = (entity: OnshapeSelection) => {
        const rest = without(entities, [entity]);
        show(isFocused ? rest : focusedPicks());
        onChange(rest);
    };

    const clear = () => onChange([]);

    return (
        <Stack gap={4}>
            <Paper
                withBorder
                p={6}
                onClick={focus}
                data-focused={isFocused || undefined}
                style={{
                    cursor: "pointer",
                    borderColor: isFocused
                        ? "var(--mantine-primary-color-filled)"
                        : undefined
                }}
            >
                {entities.length === 0 ? (
                    <Text size="sm" px={4} py={2}>
                        {label}
                    </Text>
                ) : (
                    <Stack gap={2}>
                        <Group justify="space-between" px={4}>
                            <Text size="xs" c={StatusColor.DIMMED}>
                                {label}
                            </Text>
                            <Group gap={6}>
                                {isChecking && <Loader size={IconSize.TINY} />}
                                <UnstyledButton
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        clear();
                                    }}
                                >
                                    <Text size="xs" c={StatusColor.DIMMED}>
                                        {m.queryListClear()}
                                    </Text>
                                </UnstyledButton>
                            </Group>
                        </Group>
                        {/* Left as a whole, so moving between rows lights each alone without the rest between */}
                        <Stack gap={2} onMouseLeave={unhighlight}>
                            {entities.map((entity, index) => {
                                const rowProblem = problem?.(entity);
                                const color =
                                    rowProblem &&
                                    STATUS_COLOR[rowProblem.status];
                                return (
                                    <Stack
                                        key={selectionKey(entity)}
                                        gap={0}
                                        px={4}
                                        onMouseEnter={() => highlight(entity)}
                                    >
                                        <Group gap="xs" wrap="nowrap">
                                            <Text
                                                size="sm"
                                                flex={1}
                                                truncate
                                                c={color}
                                            >
                                                {describe(entity, index)}
                                            </Text>
                                            {rowSection?.(entity)}
                                            <ActionIcon
                                                variant="subtle"
                                                color={StatusColor.NEUTRAL}
                                                size="sm"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    remove(entity);
                                                }}
                                            >
                                                <XIcon size={IconSize.TINY} />
                                            </ActionIcon>
                                        </Group>
                                        {rowProblem && (
                                            <Text size="xs" c={color}>
                                                {rowProblem.message}
                                            </Text>
                                        )}
                                    </Stack>
                                );
                            })}
                        </Stack>
                    </Stack>
                )}
            </Paper>
        </Stack>
    );
}
