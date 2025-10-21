import { MenuItem } from "@blueprintjs/core";
import { ReactNode } from "react";

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
                <MenuItem
                    icon="chevron-up"
                    text="Move up"
                    onClick={() => {
                        onOrderChange(
                            applyMoveOperation(id, order, MoveOperation.MOVE_UP)
                        );
                    }}
                />
            )}
            {operations.includes(MoveOperation.MOVE_DOWN) && (
                <MenuItem
                    icon="chevron-down"
                    text="Move down"
                    onClick={() => {
                        onOrderChange(
                            applyMoveOperation(
                                id,
                                order,
                                MoveOperation.MOVE_DOWN
                            )
                        );
                    }}
                />
            )}
            {operations.includes(MoveOperation.MOVE_TO_TOP) && (
                <MenuItem
                    icon="double-chevron-up"
                    text="Move to top"
                    onClick={() => {
                        onOrderChange(
                            applyMoveOperation(
                                id,
                                order,
                                MoveOperation.MOVE_TO_TOP
                            )
                        );
                    }}
                />
            )}
            {operations.includes(MoveOperation.MOVE_TO_BOTTOM) && (
                <MenuItem
                    icon="double-chevron-down"
                    text="Move to bottom"
                    onClick={() => {
                        onOrderChange(
                            applyMoveOperation(
                                id,
                                order,
                                MoveOperation.MOVE_TO_BOTTOM
                            )
                        );
                    }}
                />
            )}
        </>
    );
}
