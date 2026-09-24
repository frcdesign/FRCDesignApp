import { ExternalLink } from "../../../../components/external-link";
import { Card, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, retainSearchParams } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import * as z from "zod";
import { LibraryId } from "@backend/features/library/library-id";
import { ElementType } from "@backend/lib/onshape/element-type";
import type { InsertableReportOut } from "@backend/features/analytics/contract";
import { IconSize } from "../../../../lib/style-constants";
import { parseSearch } from "../../../../lib/search-params";
import { makeUrl } from "../../../../lib/url";
import { useOnshapeOrigin } from "../../../../lib/onshape-params";
import { ConfigurationBreakdown } from "../../../../features/dashboard/configuration-breakdown";
import { METRICS } from "../../../../features/dashboard/metrics";
import { type DayRange } from "@backend/features/analytics/day";
import {
    getInsertableReportQuery,
    getPartsQuery
} from "../../../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../../../features/dashboard/dashboard-state";
import { PartsTable } from "../../../../features/dashboard/parts-table";
import { toDayRange } from "../../../../features/dashboard/range";
import { useRangePreset } from "../../../../features/dashboard/range-control";
import {
    formatCount,
    formatFraction
} from "../../../../features/dashboard/format";

const PartSearchType = z.object({
    /** The part being reported on; absent until one is picked. */
    element: z.string().optional().catch(undefined)
});

export const Route = createFileRoute("/dashboard/library/$libraryId/part")({
    component: PartReport,
    validateSearch: (search: Record<string, unknown>) =>
        parseSearch(PartSearchType, search),
    // Survives a range change on this page; switching library clears it.
    search: { middlewares: [retainSearchParams(["element"])] }
});

function PartReport(): ReactNode {
    const { libraryId } = Route.useParams();
    const { element } = Route.useSearch();
    const [search, setSearch] = useState("");
    const rangePreset = useRangePreset();
    const range = toDayRange(rangePreset);
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
            <Card>
                <TextInput
                    w={360}
                    mb="md"
                    placeholder="Search parts…"
                    leftSection={<MagnifyingGlassIcon size={IconSize.SMALL} />}
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

interface ReportBodyProps {
    libraryId: LibraryId;
    elementId: string;
    range: DayRange;
}

function ReportBody({
    libraryId,
    elementId,
    range
}: ReportBodyProps): ReactNode {
    const query = useQuery(
        getInsertableReportQuery(libraryId, elementId, range)
    );

    if (!query.data) {
        return <DashboardState query={query} />;
    }
    const report = query.data;

    return (
        <Stack gap="xl">
            <PartTitle report={report} />

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
                    label={METRICS.assemblyFraction.label}
                    value={formatFraction(
                        report.targets[ElementType.ASSEMBLY],
                        report.insertCount
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

interface PartTitleProps {
    report: InsertableReportOut;
}

/** The part's name, linked into Onshape like a part number is to its vendor. */
function PartTitle({ report }: PartTitleProps): ReactNode {
    const origin = useOnshapeOrigin();
    return (
        <Title order={2}>
            <ExternalLink
                inherit
                href={makeUrl(origin, report.path)}
                iconSize={IconSize.MEDIUM}
            >
                {report.name}
            </ExternalLink>
        </Title>
    );
}

interface SummaryCardProps {
    label: string;
    value: string;
}

function SummaryCard({ label, value }: SummaryCardProps): ReactNode {
    return (
        <Card padding="md">
            <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                {label}
            </Text>
            <Title order={3}>{value}</Title>
        </Card>
    );
}
