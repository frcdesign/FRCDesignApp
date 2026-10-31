import { Card, SimpleGrid, Table, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import type {
    ReportCount,
    ReportedPartOut,
    ReportSummary
} from "@backend/features/analytics/contract";
import {
    FEEDBACK_CATEGORY_LABELS,
    FEEDBACK_TOPIC_LABELS,
    FeedbackSource
} from "@backend/features/feedback/contract";
import { type LibraryId } from "@backend/features/library/library-id";
import { Section } from "../../components/section";
import { StatTile } from "./stat-tiles";
import { formatCount } from "./format";

function total(counts: ReportCount[], source?: FeedbackSource): number {
    return counts
        .filter((each) => source === undefined || each.source === source)
        .reduce((sum, each) => sum + each.count, 0);
}

interface ReportRow {
    key: string;
    topic: string;
    category: string;
    count: number;
}

/** Sources folded together: a bug is a bug, however it was reported. */
function byKind(counts: ReportCount[]): ReportRow[] {
    const rows = new Map<string, ReportRow>();
    for (const each of counts) {
        const key = `${each.topic}/${each.category}`;
        const row = rows.get(key) ?? {
            key,
            topic: FEEDBACK_TOPIC_LABELS[each.topic],
            category: FEEDBACK_CATEGORY_LABELS[each.category],
            count: 0
        };
        row.count += each.count;
        rows.set(key, row);
    }
    return [...rows.values()].sort(
        (a, b) => b.count - a.count || a.topic.localeCompare(b.topic)
    );
}

interface ReportTilesProps {
    reports: ReportSummary;
    /** One library's page, where every row is that library's topic. */
    withTopic: boolean;
}

function ReportTiles({ reports, withTopic }: ReportTilesProps): ReactNode {
    const rows = byKind(reports.counts);
    return (
        <>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <StatTile label="Reports" value={total(reports.counts)} />
                <StatTile
                    label="From errors"
                    value={total(reports.counts, FeedbackSource.ERROR)}
                />
                <StatTile
                    label="About a part"
                    value={total(reports.counts, FeedbackSource.PART)}
                />
            </SimpleGrid>
            <Card>
                {rows.length === 0 ? (
                    <Text c="dimmed">No reports in this range.</Text>
                ) : (
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                {withTopic && <Table.Th>About</Table.Th>}
                                <Table.Th>Type</Table.Th>
                                <Table.Th ta="right">Reports</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.map((row) => (
                                <Table.Tr key={row.key}>
                                    {withTopic && (
                                        <Table.Td>{row.topic}</Table.Td>
                                    )}
                                    <Table.Td>{row.category}</Table.Td>
                                    <Table.Td ta="right">
                                        {formatCount(row.count)}
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Card>
        </>
    );
}

interface OverviewReportsProps {
    reports: ReportSummary;
}

/** Every topic's reports, by what they were about and what kind they were. */
export function OverviewReports({ reports }: OverviewReportsProps): ReactNode {
    return (
        <Section title="Reports">
            <ReportTiles reports={reports} withTopic />
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
        <Section title="Reports">
            <ReportTiles reports={reports} withTopic={false} />
            {reportedParts.length > 0 && (
                <Card>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Most reported parts</Table.Th>
                                <Table.Th ta="right">Reports</Table.Th>
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
