import { Card, SimpleGrid, Table } from "@mantine/core";
import { type ReactNode } from "react";
import type { DesignCheckTotals } from "@backend/features/analytics/contract";
import { Section } from "../../components/section";
import { getDesignIssueName } from "../design-check/issue-text";
import { DashboardEmpty } from "./dashboard-state";
import { formatCount } from "./format";
import { StatTile } from "./stat-tiles";
import { m } from "../../paraglide/messages";

/** Enough to show what to teach first, without listing every rule. */
const MOST_FOUND_LIMIT = 5;

interface DesignCheckTilesProps {
    totals: DesignCheckTotals;
}

/** How often people check their own CAD, and what the checks find most. */
export function DesignCheckTiles({ totals }: DesignCheckTilesProps): ReactNode {
    const mostFound = totals.issueTypes.slice(0, MOST_FOUND_LIMIT);
    return (
        <Section title={m.dashboardDesignCheck()}>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <StatTile
                    label={m.dashboardDesignCheckChecks()}
                    value={totals.checks}
                    caption={m.dashboardDesignCheckByElementType({
                        partStudios: totals.partStudioChecks,
                        assemblies: totals.assemblyChecks
                    })}
                />
                <StatTile
                    label={m.dashboardDesignCheckClean()}
                    value={totals.cleanChecks}
                />
            </SimpleGrid>
            <Card>
                {mostFound.length === 0 ? (
                    <DashboardEmpty title={m.dashboardDesignCheckEmpty()} />
                ) : (
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>
                                    {m.dashboardDesignCheckMostFound()}
                                </Table.Th>
                                <Table.Th ta="right">
                                    {m.dashboardDesignCheckChecks()}
                                </Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {mostFound.map((row) => (
                                <Table.Tr key={row.type}>
                                    <Table.Td>
                                        {getDesignIssueName(row.type)}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        {formatCount(row.checks)}
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Card>
        </Section>
    );
}
