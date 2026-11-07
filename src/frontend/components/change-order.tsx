import { Menu } from "@mantine/core";
import { type ReactNode } from "react";
import { getMoveOptions } from "../lib/move-order";

interface ChangeOrderMenuProps {
    id: string;
    order: string[];
    onOrderChange: (newOrder: string[]) => void;
}

/** The move items a list's order allows. */
export function ChangeOrderItems(props: ChangeOrderMenuProps): ReactNode {
    const { id, order, onOrderChange } = props;
    return getMoveOptions(id, order).map((option) => (
        <Menu.Item
            key={option.label}
            leftSection={<option.icon />}
            onClick={() => onOrderChange(option.order)}
        >
            {option.label}
        </Menu.Item>
    ));
}
