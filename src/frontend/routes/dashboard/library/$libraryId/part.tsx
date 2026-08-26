import {
    Anchor,
    Badge,
    Card,
    Group,
    Select,
    SimpleGrid,
    Stack,
    Text,
    Title
} from "@mantine/core";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { IconSize } from "../../../../lib/style-constants";
import { makeUrl } from "../../../../lib/url";
import { ConfigurationBreakdown } from "../../../../features/dashboard/configuration-breakdown";
import {
    getInsertableReportQuery,
    getPartsQuery
} from "../../../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../../../features/dashboard/dashboard-state";
import { PartsTable } from "../../../../features/dashboard/parts-table";
import {
    formatCount,
    formatDate
} from "../../../../features/dashboard/series-utils";

interface PartSearch {
    /** The part being reported on; absent until one is picked. */
    element?: string;
}

export const Route = createFileRoute("/dashboard/library/$libraryId/part")({
    component: PartReport,
    validateSearch: (search: Record<string, unknown>): PartSearch => ({
        element: typeof search.element === "string" ? search.element : undefined
    })
});

function PartReport(): ReactNode {
    const { libraryId } = Route.useParams();
    const { element } = Route.useSearch();
    const parts = useQuery(getPartsQuery(libraryId));

    return (
        <Stack gap="xl">
            <PartPicker libraryId={libraryId} selected={element} />

            {element !== undefined && (
                <ReportBody libraryId={libraryId} elementId={element} />
            )}

            {/* Kept below the report so another part is always one click away. */}
            <Card withBorder padding="lg" radius="md">
                <Title order={4}>
                    {element === undefined ? "Pick a part" : "All parts"}
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                    Every part in the library, most used first. Open the report
                    from the part name, or the part itself in Onshape.
                </Text>
                {parts.data ? (
                    <PartsTable
                        libraryId={libraryId}
                        parts={parts.data}
                        emptyMessage="This library has no parts."
                    />
                ) : (
                    <DashboardState query={parts} />
                )}
            </Card>
        </Stack>
    );
}

/**
 * Switches parts without leaving the report. Options come from the parts that
 * have usage, ordered by it, so the most relevant are at the top.
 */
function PartPicker({
    libraryId,
    selected
}: {
    libraryId: LibraryId;
    selected?: string;
}): ReactNode {
    const navigate = useNavigate();
    const parts = useQuery(getPartsQuery(libraryId));

    return (
        <Select
            searchable
            clearable
            w={360}
            label="Part"
            placeholder="Search parts…"
            nothingFoundMessage="No matching part"
            value={selected ?? null}
            data={(parts.data ?? []).map((part) => ({
                value: part.elementId,
                label: part.name ?? part.elementId
            }))}
            onChange={(value) => {
                void navigate({
                    to: "/dashboard/library/$libraryId/part",
                    params: { libraryId },
                    search: (prev) => ({
                        ...prev,
                        element: value ?? undefined
                    })
                });
            }}
        />
    );
}

function ReportBody({
    libraryId,
    elementId
}: {
    libraryId: LibraryId;
    elementId: string;
}): ReactNode {
    const query = useQuery(getInsertableReportQuery(libraryId, elementId));

    if (!query.data) {
        return <DashboardState query={query} />;
    }
    const report = query.data;

    return (
        <Stack gap="xl">
            <Group gap="sm">
                <Title order={3}>{report.name ?? elementId}</Title>
                {report.name === null && (
                    <Badge color="gray">No longer in library</Badge>
                )}
                {report.documentId && report.versionId && (
                    <Anchor
                        href={makeUrl({
                            documentId: report.documentId,
                            instanceId: report.versionId,
                            instanceType: "v",
                            elementId
                        })}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <Group gap={4}>
                            Open in Onshape
                            <ArrowSquareOut size={IconSize.SMALL} />
                        </Group>
                    </Anchor>
                )}
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <SummaryCard
                    label="Insertions"
                    value={formatCount(report.insertCount)}
                />
                <SummaryCard
                    label="Unique users"
                    value={formatCount(report.uniqueUsers)}
                />
                <SummaryCard
                    label="Last used"
                    value={formatDate(report.lastInsertedAt)}
                />
            </SimpleGrid>

            <div>
                <Title order={4} mb="xs">
                    Configuration values used
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                    Counts of each value chosen across all insertions. A default
                    that isn&apos;t the most common choice is worth revisiting.
                </Text>
                <ConfigurationBreakdown parameters={report.parameters} />
            </div>
        </Stack>
    );
}

function SummaryCard({
    label,
    value
}: {
    label: string;
    value: string;
}): ReactNode {
    return (
        <Card withBorder padding="md" radius="md">
            <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                {label}
            </Text>
            <Title order={3}>{value}</Title>
        </Card>
    );
}
