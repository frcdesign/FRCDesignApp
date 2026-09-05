import {
    Badge,
    Card,
    Group,
    Progress,
    ScrollArea,
    Stack,
    Text,
    Title
} from "@mantine/core";
import { type ReactNode } from "react";
import type {
    ConfigurationParameterUsage,
    ConfigurationValueUsage
} from "@backend/features/analytics/contract";
import { FontWeight } from "../../lib/style-constants";
import { formatCount } from "./format";

/**
 * Per-parameter value counts, which is how a wrong default shows itself: the
 * default sitting below another value, or options nobody ever picks.
 */
export function ConfigurationBreakdown({
    parameters
}: {
    parameters: ConfigurationParameterUsage[];
}): ReactNode {
    if (parameters.length === 0) {
        return (
            <Text c="dimmed" py="xl" ta="center">
                This insertable has no configuration parameters.
            </Text>
        );
    }

    return (
        <Stack>
            {parameters.map((parameter) => (
                <ParameterCard
                    key={parameter.parameterId}
                    parameter={parameter}
                />
            ))}
        </Stack>
    );
}

function ParameterCard({
    parameter
}: {
    parameter: ConfigurationParameterUsage;
}): ReactNode {
    return (
        <Card withBorder padding="md" radius="md">
            <Group justify="space-between" mb="sm" wrap="wrap">
                <Group gap="xs">
                    <Title order={5}>{parameter.name}</Title>
                    <Badge variant="light" color="gray" size="sm">
                        {parameter.type}
                    </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                    {formatCount(parameter.total)} recorded
                </Text>
            </Group>

            {/* A quantity takes any number the user types, so the list of
                values it was given has no bound worth laying out for. */}
            <ScrollArea.Autosize
                mah={VALUES_HEIGHT}
                type="auto"
                offsetScrollbars
            >
                <Stack gap="xs">
                    {parameter.values.map((value) => (
                        <ValueRow
                            key={value.value}
                            value={value}
                            total={parameter.total}
                        />
                    ))}
                </Stack>
            </ScrollArea.Autosize>
        </Card>
    );
}

/** Six rows or so, past which the card scrolls rather than the page. */
const VALUES_HEIGHT = 260;

function ValueRow({
    value,
    total
}: {
    value: ConfigurationValueUsage;
    total: number;
}): ReactNode {
    const percent = total === 0 ? 0 : (value.count / total) * 100;

    return (
        <div>
            <Group justify="space-between" gap="xs" mb={4}>
                <Group gap="xs">
                    <Text
                        size="sm"
                        c={value.count === 0 ? "dimmed" : undefined}
                        fw={value.isDefault ? FontWeight.SEMI_BOLD : undefined}
                    >
                        {value.label}
                    </Text>
                    {value.isDefault && (
                        <Badge size="xs" variant="light">
                            Default
                        </Badge>
                    )}
                </Group>
                <Text size="sm" c="dimmed">
                    {formatCount(value.count)} ({percent.toFixed(0)}%)
                </Text>
            </Group>
            {/* An explicit shade: bare "gray" is nearly invisible on a dark card. */}
            <Progress
                value={percent}
                color={value.isDefault ? undefined : "gray.5"}
                size="sm"
            />
        </div>
    );
}
