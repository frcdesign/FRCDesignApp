import { Card, Group, Text, Title } from "@mantine/core";
import { type Icon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { IconSize } from "../../lib/style-constants";
import { formatCount } from "./series-utils";

interface StatTileProps {
    label: string;
    /** A count is formatted with separators; a string is shown as given. */
    value: number | string;
    icon: Icon;
}

export function StatTile({
    label,
    value,
    icon: TileIcon
}: StatTileProps): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" wrap="nowrap">
                <div>
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                        {label}
                    </Text>
                    <Title order={2}>
                        {typeof value === "number" ? formatCount(value) : value}
                    </Title>
                </div>
                <TileIcon size={IconSize.CONTROL} opacity={0.25} />
            </Group>
        </Card>
    );
}
