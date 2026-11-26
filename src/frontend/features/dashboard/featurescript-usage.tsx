import { Card, Group, Progress, SimpleGrid, Table, Text } from "@mantine/core";
import { type ReactNode } from "react";
import type {
    FeatureScriptUsage,
    FeatureScriptUsageOut
} from "@backend/features/analytics/contract";
import { Section } from "../../components/section";
import { StatTile } from "./stat-tiles";
import { formatCount, formatFraction } from "./format";
import { DashboardEmpty } from "./dashboard-state";
import { m } from "../../paraglide/messages";

/** Wide enough for the share's bar to read, narrow enough to leave the name its room. */
const SHARE_WIDTH = 160;

interface FeatureScriptUsageSectionProps {
    usage: FeatureScriptUsageOut;
    /** Beside the title: the window it covers, where the page doesn't pick one. */
    caption?: string;
}

/** FeatureScripts added over the range, and each feature's part of them. */
export function FeatureScriptUsageSection({
    usage,
    caption
}: FeatureScriptUsageSectionProps): ReactNode {
    return (
        <Section title={m.dashboardFeatureScripts()} caption={caption}>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <StatTile
                    label={m.dashboardFeatureScriptsAdded()}
                    value={usage.adds}
                />
                <StatTile
                    label={m.dashboardFeatureScriptsUsers()}
                    value={usage.users}
                />
            </SimpleGrid>
            <Card>
                {usage.features.length === 0 ? (
                    <DashboardEmpty title={m.dashboardFeatureScriptsEmpty()} />
                ) : (
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>
                                    {m.dashboardFeatureScriptsColumnFeature()}
                                </Table.Th>
                                <Table.Th ta="right">
                                    {m.dashboardFeatureScriptsColumnAdds()}
                                </Table.Th>
                                <Table.Th ta="right">
                                    {m.dashboardFeatureScriptsColumnUsers()}
                                </Table.Th>
                                <Table.Th w={SHARE_WIDTH}>
                                    {m.dashboardFeatureScriptsColumnShare()}
                                </Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {usage.features.map((feature) => (
                                <FeatureScriptRow
                                    key={feature.featureType}
                                    feature={feature}
                                    totalAdds={usage.adds}
                                />
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Card>
        </Section>
    );
}

interface FeatureScriptRowProps {
    feature: FeatureScriptUsage;
    totalAdds: number;
}

function FeatureScriptRow({
    feature,
    totalAdds
}: FeatureScriptRowProps): ReactNode {
    const share = totalAdds === 0 ? 0 : (feature.adds / totalAdds) * 100;
    return (
        <Table.Tr>
            <Table.Td>
                {feature.name ??
                    m.dashboardFeatureScriptsRemoved({
                        featureType: feature.featureType
                    })}
            </Table.Td>
            <Table.Td ta="right">{formatCount(feature.adds)}</Table.Td>
            <Table.Td ta="right">{formatCount(feature.users)}</Table.Td>
            <Table.Td>
                <Group gap="xs" wrap="nowrap">
                    <Progress value={share} size="sm" flex={1} />
                    <Text size="xs" c="dimmed">
                        {formatFraction(feature.adds, totalAdds)}
                    </Text>
                </Group>
            </Table.Td>
        </Table.Tr>
    );
}
