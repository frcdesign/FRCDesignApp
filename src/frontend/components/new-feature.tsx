import { Badge } from "@mantine/core";
import { ReactNode } from "react";
import { StatusColor } from "../lib/style-constants";

/** The badge beside a new feature's name, in the dot's color. */
export function NewBadge(): ReactNode {
    return <Badge color={StatusColor.INFO}>New</Badge>;
}
