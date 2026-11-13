import { Card, SimpleGrid, Table } from "@mantine/core";
import { type ReactNode } from "react";
import type { DesignCheckTotals } from "@backend/features/analytics/contract";
import { Section } from "../../components/section";
import { getDesignIssueName } from "../design-check/issue-text";
import { DashboardEmpty } from "./dashboard-state";
import { formatCount } from "./format";
import { StatTile } from "./stat-tiles";
import { m } from "../../paraglide/messages";

interface DesignCheckTilesProps {
    totals: DesignCheckTotals;
}

/** How often people check their own CAD, what the checks find, and what people do about it. */
export function DesignCheckTiles({ totals }: DesignCheckTilesProps): ReactNode {
    return (
        <Section title={m.dashboardDesignCheck()}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
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
                <StatTile
                    label={m.dashboardDesignCheckFixed()}
                    value={totals.fixes}
                />
                <StatTile
                    label={m.dashboardDesignCheckDismissed()}
                    value={totals.dismissals}
                />
            </SimpleGrid>
            <Card>
                {totals.issueTypes.length === 0 ? (
                    <DashboardEmpty title={m.dashboardDesignCheckEmpty()} />
                ) : (
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>
                                    {m.dashboardDesignCheckIssue()}
                                </Table.Th>
                                <Table.Th ta="right">
                                    {m.dashboardDesignCheckFoundBy()}
                                </Table.Th>
                                <Table.Th ta="right">
                                    {m.dashboardDesignCheckFixed()}
                                </Table.Th>
                                <Table.Th ta="right">
                                    {m.dashboardDesignCheckDismissed()}
                                </Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {totals.issueTypes.map((row) => (
                                <Table.Tr key={row.type}>
                                    <Table.Td>
                                        {getDesignIssueName(row.type)}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        {formatCount(row.checks)}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        {formatCount(row.fixed)}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        {formatCount(row.dismissed)}
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
