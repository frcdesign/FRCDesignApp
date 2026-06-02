import {
    IconChevronDown,
    IconChevronsDown,
    IconChevronsUp,
    IconChevronUp
} from "@tabler/icons-react";
import { type ReactNode } from "react";
import { AppMenuItem } from "../common/app-menu";

enum MoveOperation {
    MOVE_UP,
    MOVE_DOWN,
    MOVE_TO_TOP,
    MOVE_TO_BOTTOM
}

function applyMoveOperation(
    target: string,
    order: string[],
    operation: MoveOperation
): string[] {
    const index = order.indexOf(target);
    if (index === -1) return order; // target not found, return unchanged

    // Make a shallow copy so we don't mutate input
    const result = [...order];

    switch (operation) {
        case MoveOperation.MOVE_UP: {
            if (index > 0) {
                [result[index - 1], result[index]] = [
                    result[index],
                    result[index - 1]
                ];
            }
            break;
        }
        case MoveOperation.MOVE_DOWN: {
            if (index < result.length - 1) {
                [result[index + 1], result[index]] = [
                    result[index],
                    result[index + 1]
                ];
            }
            break;
        }
        case MoveOperation.MOVE_TO_TOP: {
            result.splice(index, 1);
            result.unshift(target);
            break;
        }
        case MoveOperation.MOVE_TO_BOTTOM: {
            result.splice(index, 1);
            result.push(target);
            break;
        }
    }

    return result;
}

/**
 * Given a target and an order, returns a list of currently valid operations.
 */
function getValidOperations(target: string, order: string[]): MoveOperation[] {
    const index = order.indexOf(target);
    if (index === -1) {
        return [];
    }
    const lastIndex = order.length - 1;
    const operations: MoveOperation[] = [];

    if (index > 0) {
        if (index === 1) {
            operations.push(MoveOperation.MOVE_UP); // only "up" since it goes straight to top
        } else {
            operations.push(MoveOperation.MOVE_UP, MoveOperation.MOVE_TO_TOP);
        }
    }

    if (index < lastIndex) {
        if (index === lastIndex - 1) {
            operations.push(MoveOperation.MOVE_DOWN); // only "down" since it goes straight to bottom
        } else {
            operations.push(
                MoveOperation.MOVE_DOWN,
                MoveOperation.MOVE_TO_BOTTOM
            );
        }
    }

    return operations;
}

interface ChangeOrderMenuProps {
    id: string;
    order: string[];
    onOrderChange: (newOrder: string[]) => void;
}

/**
 * MenuItems that allow users to move a given item in a list up or down.
 */

export function ChangeOrderItems(props: ChangeOrderMenuProps): ReactNode {
    const { id, order, onOrderChange } = props;

    // const documentOrder = useDocumentOrderQuery().data ?? [];

    const operations = getValidOperations(id, order);

    return (
        <>
            {operations.includes(MoveOperation.MOVE_UP) && (
                <AppMenuItem
                    icon={<IconChevronUp size={16} />}
                    onClick={() => {
                        onOrderChange(
                            applyMoveOperation(id, order, MoveOperation.MOVE_UP)
                        );
                    }}
                >
                    Move up
                </AppMenuItem>
            )}
            {operations.includes(MoveOperation.MOVE_DOWN) && (
                <AppMenuItem
                    icon={<IconChevronDown size={16} />}
                    onClick={() => {
                        onOrderChange(
                            applyMoveOperation(
                                id,
                                order,
                                MoveOperation.MOVE_DOWN
                            )
                        );
                    }}
                >
                    Move down
                </AppMenuItem>
            )}
            {operations.includes(MoveOperation.MOVE_TO_TOP) && (
                <AppMenuItem
                    icon={<IconChevronsUp size={16} />}
                    onClick={() => {
                        onOrderChange(
                            applyMoveOperation(
                                id,
                                order,
                                MoveOperation.MOVE_TO_TOP
                            )
                        );
                    }}
                >
                    Move to top
                </AppMenuItem>
            )}
            {operations.includes(MoveOperation.MOVE_TO_BOTTOM) && (
                <AppMenuItem
                    icon={<IconChevronsDown size={16} />}
                    onClick={() => {
                        onOrderChange(
                            applyMoveOperation(
                                id,
                                order,
                                MoveOperation.MOVE_TO_BOTTOM
                            )
                        );
                    }}
                >
                    Move to bottom
                </AppMenuItem>
            )}
        </>
    );
}
