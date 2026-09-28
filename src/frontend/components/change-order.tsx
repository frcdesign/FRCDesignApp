import { Menu } from "@mantine/core";
import {
    CaretDoubleDownIcon,
    CaretDoubleUpIcon,
    CaretDownIcon,
    CaretUpIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";

interface ChangeOrderMenuProps {
    id: string;
    order: string[];
    onOrderChange: (newOrder: string[]) => void;
}

/** The move items a list's order allows. */
export function ChangeOrderItems(props: ChangeOrderMenuProps): ReactNode {
    const { id, order, onOrderChange } = props;
    const operations = getValidOperations(id, order);
    return MOVE_ITEMS.filter((item) => operations.includes(item.operation)).map(
        (item) => (
            <Menu.Item
                key={item.label}
                leftSection={<item.icon />}
                onClick={() =>
                    onOrderChange(applyMoveOperation(id, order, item.operation))
                }
            >
                {item.label}
            </Menu.Item>
        )
    );
}

enum MoveOperation {
    MOVE_UP,
    MOVE_DOWN,
    MOVE_TO_TOP,
    MOVE_TO_BOTTOM
}

const MOVE_ITEMS = [
    { operation: MoveOperation.MOVE_UP, label: "Move up", icon: CaretUpIcon },
    {
        operation: MoveOperation.MOVE_DOWN,
        label: "Move down",
        icon: CaretDownIcon
    },
    {
        operation: MoveOperation.MOVE_TO_TOP,
        label: "Move to top",
        icon: CaretDoubleUpIcon
    },
    {
        operation: MoveOperation.MOVE_TO_BOTTOM,
        label: "Move to bottom",
        icon: CaretDoubleDownIcon
    }
];

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
