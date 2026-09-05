import {
    Anchor,
    Badge,
    Card,
    Group,
    SimpleGrid,
    Stack,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { ArrowSquareOut, MagnifyingGlass } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import type { InsertableReportOut } from "@backend/features/analytics/contract";
import { IconSize } from "../../../../lib/style-constants";
import { makeUrl } from "../../../../lib/url";
import { ConfigurationBreakdown } from "../../../../features/dashboard/configuration-breakdown";
import {
    getInsertableReportQuery,
    getPartsQuery,
    type DayRange
} from "../../../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../../../features/dashboard/dashboard-state";
import { PartsTable } from "../../../../features/dashboard/parts-table";
import { toDayRange } from "../../../../features/dashboard/range";
import { useRangePreset } from "../../../../features/dashboard/range-control";
import {
    formatCount,
    formatPercent
} from "../../../../features/dashboard/format";

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
    const [search, setSearch] = useState("");
    const range = toDayRange(useRangePreset());
    const parts = useQuery(getPartsQuery(libraryId, range));

    return (
        <Stack gap="xl">
            {element !== undefined && (
                <ReportBody
                    libraryId={libraryId}
                    elementId={element}
                    range={range}
                />
            )}

            {/* Kept below the report so another part is always one click away. */}
            <Card withBorder padding="lg" radius="md">
                <TextInput
                    w={360}
                    mb="md"
                    placeholder="Search parts…"
                    leftSection={<MagnifyingGlass size={IconSize.SMALL} />}
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                />
                {parts.data ? (
                    <PartsTable
                        libraryId={libraryId}
                        parts={parts.data}
                        search={search}
                        emptyMessage="This library has no parts."
                    />
                ) : (
                    <DashboardState query={parts} />
                )}
            </Card>
        </Stack>
    );
}

function ReportBody({
    libraryId,
    elementId,
    range
}: {
    libraryId: LibraryId;
    elementId: string;
    range: DayRange;
}): ReactNode {
    const query = useQuery(
        getInsertableReportQuery(libraryId, elementId, range)
    );

    if (!query.data) {
        return <DashboardState query={query} />;
    }
    const report = query.data;

    return (
        <Stack gap="xl">
            <Group gap="sm">
                <PartTitle report={report} elementId={elementId} />
                {report.name === null && (
                    <Badge color="gray">No longer in library</Badge>
                )}
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3, lg: 5 }}>
                <SummaryCard
                    label="Uses per month"
                    value={formatCount(report.usesPerMonth)}
                />
                <SummaryCard
                    label="Uses"
                    value={formatCount(report.insertCount)}
                />
                <SummaryCard
                    label="Unique users"
                    value={formatCount(report.uniqueUsers)}
                />
                <SummaryCard
                    label="Favorites"
                    value={formatCount(report.favorites)}
                />
                <SummaryCard
                    label="Derived"
                    value={formatPercent(
                        report.targets.partStudio,
                        report.targets.partStudio + report.targets.assembly
                    )}
                />
            </SimpleGrid>

            <div>
                <Title order={4} mb="md">
                    Configuration values
                </Title>
                <ConfigurationBreakdown parameters={report.parameters} />
            </div>
        </Stack>
    );
}

/** The part's name, linked into Onshape like a part number is to its vendor. */
function PartTitle({
    report,
    elementId
}: {
    report: InsertableReportOut;
    elementId: string;
}): ReactNode {
    const name = report.name ?? elementId;
    if (!report.documentId || !report.versionId) {
        return <Title order={2}>{name}</Title>;
    }

    return (
        <Title order={2}>
            <Anchor
                inherit
                href={makeUrl({
                    documentId: report.documentId,
                    instanceId: report.versionId,
                    instanceType: "v",
                    elementId
                })}
                target="_blank"
                rel="noreferrer"
                // Centres the icon on the text rather than on its baseline.
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
                {name}
                <ArrowSquareOut size={IconSize.MEDIUM} />
            </Anchor>
        </Title>
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
