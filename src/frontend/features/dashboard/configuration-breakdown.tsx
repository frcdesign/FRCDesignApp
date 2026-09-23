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
import {
    CATEGORY_COLOR,
    FontWeight,
    MUTED_MARK,
    StatusColor
} from "../../lib/style-constants";
import { formatCount, formatPercent } from "./format";
import { ImplicitDefaultBadge } from "./implicit-default";
import { ParameterPath } from "./parameter-path";

interface ConfigurationBreakdownProps {
    parameters: ConfigurationParameterUsage[];
}

/**
 * Per-parameter value counts, which is how a wrong default shows itself: the
 * default sitting below another value, or options nobody ever picks. One card
 * per instance, so a list another choice filters is read one branch at a time.
 */
export function ConfigurationBreakdown({
    parameters
}: ConfigurationBreakdownProps): ReactNode {
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
                /* The path is what tells two instances of one parameter
                   apart, and what the card is titled with. */
                <ParameterCard
                    key={`${parameter.parameterId}-${parameter.path.join(">")}`}
                    parameter={parameter}
                />
            ))}
        </Stack>
    );
}

interface ParameterCardProps {
    parameter: ConfigurationParameterUsage;
}

function ParameterCard({ parameter }: ParameterCardProps): ReactNode {
    return (
        <Card padding="md">
            <Group justify="space-between" mb="sm" wrap="wrap">
                <Group gap="xs">
                    <ParameterPath path={parameter.path}>
                        <Title order={5}>{parameter.name}</Title>
                    </ParameterPath>
                    <Badge variant="light" color={CATEGORY_COLOR} size="sm">
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

interface ValueRowProps {
    value: ConfigurationValueUsage;
    total: number;
}

function ValueRow({ value, total }: ValueRowProps): ReactNode {
    const percent = total === 0 ? 0 : (value.count / total) * 100;
    // Both are what an insert lands on with nothing picked, so both read as
    // the value the rest of the list is measured against.
    const lands = value.isDefault || value.isImplicitDefault;

    return (
        <div>
            <Group justify="space-between" gap="xs" mb={4}>
                <Group gap="xs">
                    <Text
                        size="sm"
                        c={value.count === 0 ? "dimmed" : undefined}
                        fw={lands ? FontWeight.SEMI_BOLD : undefined}
                    >
                        {value.label}
                    </Text>
                    <DefaultBadge value={value} />
                </Group>
                <Text size="sm" c="dimmed">
                    {formatCount(value.count)} ({formatPercent(percent)})
                </Text>
            </Group>
            <Progress
                value={percent}
                color={lands ? undefined : MUTED_MARK}
                size="sm"
            />
        </div>
    );
}

interface DefaultBadgeProps {
    value: ConfigurationValueUsage;
}

/**
 * Which kind of default this is, if either: the one the parameter declares, or
 * the one the app falls to because the declared one is not offered here.
 */
function DefaultBadge({ value }: DefaultBadgeProps): ReactNode {
    if (value.isImplicitDefault) {
        return (
            <ImplicitDefaultBadge
                size="xs"
                variant="light"
                color={StatusColor.INFO}
            />
        );
    }
    if (value.isDefault) {
        return (
            <Badge size="xs" variant="light">
                Default
            </Badge>
        );
    }
    return null;
}
