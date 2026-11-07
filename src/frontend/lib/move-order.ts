/** Moving one id within an ordered list: the moves its place allows, and the order each leaves. */
import {
    CaretDoubleDownIcon,
    CaretDoubleUpIcon,
    CaretDownIcon,
    CaretUpIcon,
    type Icon
} from "@phosphor-icons/react";
import { m } from "../paraglide/messages";

/** One move the list's order allows, and the order it leaves. */
export interface MoveOption {
    label: string;
    icon: Icon;
    order: string[];
}

/** The moves `id` can make within `order`, in menu order. */
export function getMoveOptions(id: string, order: string[]): MoveOption[] {
    const valid = getValidOperations(id, order);
    return MENU_ORDER.filter((operation) => valid.includes(operation)).map(
        (operation) => ({
            ...describeMove(operation),
            order: applyMoveOperation(id, order, operation)
        })
    );
}

enum MoveOperation {
    MOVE_UP,
    MOVE_DOWN,
    MOVE_TO_TOP,
    MOVE_TO_BOTTOM
}

const MENU_ORDER = [
    MoveOperation.MOVE_UP,
    MoveOperation.MOVE_DOWN,
    MoveOperation.MOVE_TO_TOP,
    MoveOperation.MOVE_TO_BOTTOM
];

function describeMove(operation: MoveOperation): {
    label: string;
    icon: Icon;
} {
    switch (operation) {
        case MoveOperation.MOVE_UP:
            return { label: m.changeOrderMoveUp(), icon: CaretUpIcon };
        case MoveOperation.MOVE_DOWN:
            return { label: m.changeOrderMoveDown(), icon: CaretDownIcon };
        case MoveOperation.MOVE_TO_TOP:
            return { label: m.changeOrderMoveToTop(), icon: CaretDoubleUpIcon };
        case MoveOperation.MOVE_TO_BOTTOM:
            return {
                label: m.changeOrderMoveToBottom(),
                icon: CaretDoubleDownIcon
            };
    }
}

function applyMoveOperation(
    target: string,
    order: string[],
    operation: MoveOperation
): string[] {
    const index = order.indexOf(target);
    if (index === -1) return order;

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

function getValidOperations(target: string, order: string[]): MoveOperation[] {
    const index = order.indexOf(target);
    if (index === -1) {
        return [];
    }
    const lastIndex = order.length - 1;
    const operations: MoveOperation[] = [];

    if (index > 0) {
        if (index === 1) {
            // Up is already the top.
            operations.push(MoveOperation.MOVE_UP);
        } else {
            operations.push(MoveOperation.MOVE_UP, MoveOperation.MOVE_TO_TOP);
        }
    }

    if (index < lastIndex) {
        if (index === lastIndex - 1) {
            // Down is already the bottom.
            operations.push(MoveOperation.MOVE_DOWN);
        } else {
            operations.push(
                MoveOperation.MOVE_DOWN,
                MoveOperation.MOVE_TO_BOTTOM
            );
        }
    }

    return operations;
}
