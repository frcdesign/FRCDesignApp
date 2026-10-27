import {
    ActionIcon,
    Group,
    Paper,
    Stack,
    Text,
    UnstyledButton
} from "@mantine/core";
import { XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
    focusedPicks,
    holdPicks,
    onPick,
    selectionKey,
    useOnshapeSelection,
    without,
    type OnshapeSelection
} from "../lib/selection";
import { IconSize, StatusColor } from "../lib/style-constants";

interface QueryListProps {
    /** Unique on the page: which list takes picks. */
    id: string;
    label: string;
    /** What to pick, shown while it's focused, and when something else is picked. */
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
 * The filter is asked for on focus. A highlight cancels it, and a request
 * clears what the window shows, so hovering a row highlights its entity alone,
 * leaving lights the focused list's picks up, and the filter is off until the
 * list is clicked again.
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
        autoFocus = false
    } = props;
    const target = useTargetElement();
    const isFocused = useOnshapeSelection((state) => state.focused === id);
    const isUnclaimed = useOnshapeSelection(
        (state) => state.focused === undefined
    );
    // The stop names the request it ends
    const selectionRequest = useRef<string>(undefined);
    const [refused, setRefused] = useState(false);

    useEffect(
        () =>
            onPick(id, ({ added, removed }) => {
                const kept = without(entities, removed);
                const keys = new Set(kept.map(selectionKey));
                const taken = added.filter(
                    (entity) =>
                        accepts(entity) && !keys.has(selectionKey(entity))
                );
                setRefused(added.some((entity) => !accepts(entity)));
                if (taken.length > 0 || kept.length !== entities.length) {
                    onChange([...kept, ...taken]);
                }
            }),
        [id, entities, onChange, accepts]
    );

    useEffect(() => holdPicks(id, entities), [id, entities]);

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
        selectionRequest.current = sendSelectionRequest(target, filter);
        return () => {
            if (selectionRequest.current) {
                sendStopRequestMessage(target, selectionRequest.current);
            }
        };
    }, [target, isFocused, filter]);

    const focus = () => {
        useOnshapeSelection.getState().focus(id);
        setRefused(false);
        if (!target) {
            return;
        }
        sendMessageBubble(target, prompt);
        // Already focused, the request was cancelled by a highlight since
        if (isFocused) {
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

    // A request clears the window's selection, and keeps picks limited
    const clear = () => {
        onChange([]);
        if (target && isFocused) {
            selectionRequest.current = sendSelectionRequest(target, filter);
        }
    };

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
                            <UnstyledButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    clear();
                                }}
                            >
                                <Text size="xs" c={StatusColor.DIMMED}>
                                    Clear
                                </Text>
                            </UnstyledButton>
                        </Group>
                        {/* Left as a whole, so moving between rows lights each alone without the rest between */}
                        <Stack gap={2} onMouseLeave={unhighlight}>
                            {entities.map((entity, index) => (
                                <Group
                                    key={selectionKey(entity)}
                                    gap="xs"
                                    px={4}
                                    wrap="nowrap"
                                    onMouseEnter={() => highlight(entity)}
                                >
                                    <Text size="sm" flex={1} truncate>
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
                            ))}
                        </Stack>
                    </Stack>
                )}
            </Paper>
            {isFocused && (refused || entities.length === 0) && (
                <Text
                    size="xs"
                    c={refused ? StatusColor.WARNING : StatusColor.DIMMED}
                >
                    {prompt}
                </Text>
            )}
        </Stack>
    );
}
