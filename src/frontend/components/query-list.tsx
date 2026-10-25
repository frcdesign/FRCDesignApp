import {
    ActionIcon,
    Group,
    Paper,
    Stack,
    Text,
    UnstyledButton
} from "@mantine/core";
import { XIcon } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import {
    clearHighlight,
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
 * Onshape's query parameter, for entities picked in the Onshape window. Click
 * it to focus it, and new picks of the kind it takes are added to it; hover a
 * row to light its entity up alone, and remove one with its button.
 *
 * A selection request and a highlight can't be pending together: a highlight
 * cancels the request, and a request clears the highlight. So the filter is
 * asked for on focus, and a highlight lasts until the list is clicked again.
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
        rowSection
    } = props;
    const target = useTargetElement();
    const isFocused = useOnshapeSelection((state) => state.focused === id);
    const [refused, setRefused] = useState(false);

    useEffect(
        () =>
            onPick(id, (picked) => {
                const keys = new Set(entities.map(selectionKey));
                const taken = picked.filter(
                    (entity) =>
                        accepts(entity) && !keys.has(selectionKey(entity))
                );
                setRefused(picked.some((entity) => !accepts(entity)));
                if (taken.length > 0) {
                    onChange([...entities, ...taken]);
                }
            }),
        [id, entities, onChange, accepts]
    );

    useEffect(() => holdPicks(id, entities), [id, entities]);

    useEffect(() => {
        if (!target || !isFocused) {
            return;
        }
        sendSelectionRequest(target, filter);
        return () => sendStopRequestMessage(target);
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
            sendSelectionRequest(target, filter);
        }
    };

    const showPicks = (picks: OnshapeSelection[] | undefined) => {
        if (!target) {
            return;
        }
        if (picks) {
            sendHighlightMessage(target, picks.map(toHighlighted));
        } else {
            clearHighlight(target);
        }
    };

    const highlight = (entity: OnshapeSelection) => {
        if (target) {
            sendHighlightMessage(target, [toHighlighted(entity)]);
        }
    };

    // Back to the focused list's picks, whichever list the row was in
    const unhighlight = () => showPicks(focusedPicks());

    const remove = (entity: OnshapeSelection) => {
        const rest = entities.filter(
            (each) => selectionKey(each) !== selectionKey(entity)
        );
        showPicks(isFocused ? rest : focusedPicks());
        onChange(rest);
    };

    return (
        <Stack gap={4}>
            <Group justify="space-between">
                <Text size="sm">{label}</Text>
                {entities.length > 0 && (
                    <UnstyledButton onClick={() => onChange([])}>
                        <Text size="xs" c={StatusColor.DIMMED}>
                            Clear
                        </Text>
                    </UnstyledButton>
                )}
            </Group>
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
                    <Text size="sm" c={StatusColor.DIMMED} px={4} py={2}>
                        {isFocused ? prompt : "Click to select"}
                    </Text>
                ) : (
                    <Stack gap={2}>
                        {entities.map((entity, index) => (
                            <Group
                                key={selectionKey(entity)}
                                gap="xs"
                                px={4}
                                wrap="nowrap"
                                onMouseEnter={() => highlight(entity)}
                                onMouseLeave={unhighlight}
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
                )}
            </Paper>
            {isFocused && refused && (
                <Text size="xs" c={StatusColor.WARNING}>
                    {prompt}
                </Text>
            )}
        </Stack>
    );
}
