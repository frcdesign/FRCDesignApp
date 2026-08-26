import { Card, Group, NumberInput, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { getUnusedQuery } from "../../../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../../../features/dashboard/dashboard-state";
import { PartsTable } from "../../../../features/dashboard/parts-table";

export const Route = createFileRoute("/dashboard/library/$libraryId/unused")({
    component: UnusedParts
});

const DEFAULT_THRESHOLD = 5;

function UnusedParts(): ReactNode {
    const { libraryId } = Route.useParams();
    const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);

    const query = useQuery(getUnusedQuery(libraryId, threshold));

    return (
        <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" mb="md" wrap="wrap">
                <div>
                    <Title order={4}>Unused and low-usage parts</Title>
                    <Text size="sm" c="dimmed">
                        Visible parts inserted at most this many times.
                    </Text>
                </div>
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
            {query.data ? (
                <PartsTable
                    libraryId={libraryId}
                    parts={query.data}
                    emptyMessage="Every visible part in this library is used more than the threshold."
                />
            ) : (
                <DashboardState query={query} />
            )}
        </Card>
    );
}
