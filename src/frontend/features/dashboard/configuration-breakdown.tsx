import {
    Badge,
    Card,
    Group,
    Progress,
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
import { formatCount } from "./series-utils";

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
    const used = parameter.values.filter((value) => value.count > 0);
    const topValue = used.reduce<ConfigurationValueUsage | null>(
        (best, value) =>
            best === null || value.count > best.count ? value : best,
        null
    );

    const defaultIsWrong =
        topValue !== null && !topValue.isDefault && parameter.total > 0;
    const neverChanged =
        parameter.total > 0 && used.length === 1 && used[0].isDefault;

    return (
        <Card withBorder padding="md" radius="md">
            <Group justify="space-between" mb="sm" wrap="wrap">
                <Group gap="xs">
                    <Title order={5}>{parameter.name}</Title>
                    <Badge variant="light" color="gray" size="sm">
                        {parameter.type}
                    </Badge>
                    {parameter.isRetired && (
                        <Badge variant="light" color="gray" size="sm">
                            No longer defined
                        </Badge>
                    )}
                    {defaultIsWrong && (
                        <Badge variant="light" color="orange" size="sm">
                            Default may be wrong
                        </Badge>
                    )}
                    {neverChanged && (
                        <Badge variant="light" color="blue" size="sm">
                            Never changed
                        </Badge>
                    )}
                </Group>
                <Text size="sm" c="dimmed">
                    {formatCount(parameter.total)} recorded
                </Text>
            </Group>

            <Stack gap="xs">
                {parameter.values.map((value) => (
                    <ValueRow
                        key={value.value}
                        value={value}
                        total={parameter.total}
                    />
                ))}
            </Stack>
        </Card>
    );
}

function ValueRow({
    value,
    total
}: {
    value: ConfigurationValueUsage;
    total: number;
}): ReactNode {
    const percent = total === 0 ? 0 : (value.count / total) * 100;
    const unused = value.count === 0;

    return (
        <div>
            <Group justify="space-between" gap="xs" mb={4}>
                <Group gap="xs">
                    <Text
                        size="sm"
                        c={unused ? "dimmed" : undefined}
                        fw={value.isDefault ? FontWeight.SEMI_BOLD : undefined}
                    >
                        {value.label}
                    </Text>
                    {value.isDefault && (
                        <Badge size="xs" variant="light">
                            Default
                        </Badge>
                    )}
                    {unused && (
                        <Badge size="xs" variant="light" color="gray">
                            Never used
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
