import { Card, Group, NumberInput, Stack, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
    getUnusedOptionsQuery,
    getUnusedQuery
} from "../../../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../../../features/dashboard/dashboard-state";
import { OptionsTable } from "../../../../features/dashboard/options-table";
import { PartsTable } from "../../../../features/dashboard/parts-table";

export const Route = createFileRoute("/dashboard/library/$libraryId/unused")({
    component: LowUsage
});

const DEFAULT_THRESHOLD = 5;

function LowUsage(): ReactNode {
    const { libraryId } = Route.useParams();
    const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);

    const parts = useQuery(getUnusedQuery(libraryId, threshold));
    const options = useQuery(getUnusedOptionsQuery(libraryId, threshold));

    return (
        <Stack gap="xl">
            <Group justify="flex-end">
                <NumberInput
                    label="Threshold"
                    min={0}
                    w={120}
                    value={threshold}
                    onChange={(value) =>
                        setThreshold(
                            typeof value === "number"
                                ? value
                                : DEFAULT_THRESHOLD
                        )
                    }
                />
            </Group>

            <Card withBorder padding="lg" radius="md">
                <Title order={4} mb="md">
                    Low-usage parts
                </Title>
                {parts.data ? (
                    <PartsTable
                        libraryId={libraryId}
                        parts={parts.data}
                        emptyMessage="Every visible part is used more than the threshold."
                    />
                ) : (
                    <DashboardState query={parts} />
                )}
            </Card>

            <Card withBorder padding="lg" radius="md">
                <Title order={4} mb="md">
                    Low-usage configuration options
                </Title>
                {options.data ? (
                    <OptionsTable
                        libraryId={libraryId}
                        options={options.data}
                        emptyMessage="Every configuration option is used more than the threshold."
                    />
                ) : (
                    <DashboardState query={options} />
                )}
            </Card>
        </Stack>
    );
}
