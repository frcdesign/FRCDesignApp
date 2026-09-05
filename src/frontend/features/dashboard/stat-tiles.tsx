import { Card, Group, Text, Title } from "@mantine/core";
import { type Icon } from "@phosphor-icons/react";
import { lazy, Suspense, type ReactNode } from "react";
import type { PeriodComparison } from "@backend/features/analytics/contract";
import { IconSize } from "../../lib/style-constants";
import { ChangeIndicator } from "./change-indicator";
import { formatCount } from "./format";

const MiniSparkline = lazy(() =>
    import("./sparkline").then((module) => ({
        default: module.MiniSparkline
    }))
);

const SPARKLINE_HEIGHT = 40;

interface StatTileProps {
    label: string;
    /** A count is formatted with separators; a string is shown as given. */
    value: number | string;
    /** Rates need a decimal; counts do not. Also formats the change tooltip. */
    format?: (value: number) => string;
    icon?: Icon;
    /** How the measure changed, drawn to the right of the number — never below
     * it, so a row of tiles scans as one line of numbers. */
    change?: PeriodComparison;
    trackingSince?: string | null;
    /** The shape over the selected window, which follows the picker even when
     * the value above is all time: a sparkline claims no total. */
    spark?: number[];
}

export function StatTile({
    label,
    value,
    format = formatCount,
    icon: TileIcon,
    change,
    trackingSince = null,
    spark
}: StatTileProps): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
                <div>
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                        {label}
                    </Text>
                    <Title order={2}>
                        {typeof value === "number" ? format(value) : value}
                    </Title>
                </div>
                {change ? (
                    <ChangeIndicator
                        comparison={change}
                        trackingSince={trackingSince}
                        format={format}
                    />
                ) : (
                    TileIcon && (
                        <TileIcon size={IconSize.CONTROL} opacity={0.25} />
                    )
                )}
            </Group>
            {spark && (
                <Suspense
                    fallback={<div style={{ height: SPARKLINE_HEIGHT }} />}
                >
                    <MiniSparkline data={spark} h={SPARKLINE_HEIGHT} />
                </Suspense>
            )}
        </Card>
    );
}
