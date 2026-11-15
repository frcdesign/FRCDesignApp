import { Card, SimpleGrid, Table } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import type {
    ReportCount,
    ReportedPartOut,
    ReportSummary
} from "@backend/features/analytics/contract";
import { FeedbackSource } from "@backend/features/feedback/contract";
import { m } from "../../paraglide/messages";
import { type LibraryId } from "@backend/features/library/library-id";
import { Section } from "../../components/section";
import { StatTile } from "./stat-tiles";
import { formatCount } from "./format";

function total(counts: ReportCount[], source?: FeedbackSource): number {
    return counts
        .filter((each) => source === undefined || each.source === source)
        .reduce((sum, each) => sum + each.count, 0);
}

interface ReportTilesProps {
    reports: ReportSummary;
}

function ReportTiles({ reports }: ReportTilesProps): ReactNode {
    return (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <StatTile
                label={m.dashboardReports()}
                value={total(reports.counts)}
            />
            <StatTile
                label={m.dashboardReportsFromErrors()}
                value={total(reports.counts, FeedbackSource.ERROR)}
            />
            <StatTile
                label={m.dashboardReportsAboutPart()}
                value={total(reports.counts, FeedbackSource.PART)}
            />
        </SimpleGrid>
    );
}

interface OverviewReportsProps {
    reports: ReportSummary;
}

/** Every topic's reports, by where they were sent from. */
export function OverviewReports({ reports }: OverviewReportsProps): ReactNode {
    return (
        <Section title={m.dashboardReports()}>
            <ReportTiles reports={reports} />
        </Section>
    );
}

interface LibraryReportsProps {
    libraryId: LibraryId;
    reports: ReportSummary;
    reportedParts: ReportedPartOut[];
}

/** The library's reports, and the parts reported most. */
export function LibraryReports(props: LibraryReportsProps): ReactNode {
    const { libraryId, reports, reportedParts } = props;
    return (
        <Section title={m.dashboardReports()}>
            <ReportTiles reports={reports} />
            {reportedParts.length > 0 && (
                <Card>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>
                                    {m.dashboardReportsMostReported()}
                                </Table.Th>
                                <Table.Th ta="right">
                                    {m.dashboardReportsCount()}
                                </Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {reportedParts.map((part) => (
                                <ReportedPartRow
                                    key={part.path.elementId}
                                    libraryId={libraryId}
                                    part={part}
                                />
                            ))}
                        </Table.Tbody>
                    </Table>
                </Card>
            )}
        </Section>
    );
}

interface ReportedPartRowProps {
    libraryId: LibraryId;
    part: ReportedPartOut;
}

/** Opens the part's own page, as a row of the parts table does. */
function ReportedPartRow({ libraryId, part }: ReportedPartRowProps): ReactNode {
    const navigate = useNavigate();
    return (
        <Table.Tr
            style={{ cursor: "pointer" }}
            onClick={() =>
                void navigate({
                    to: "/dashboard/library/$libraryId/part",
                    params: { libraryId },
                    search: { element: part.path.elementId }
                })
            }
        >
            <Table.Td>{part.name}</Table.Td>
            <Table.Td ta="right">{formatCount(part.count)}</Table.Td>
        </Table.Tr>
    );
}
