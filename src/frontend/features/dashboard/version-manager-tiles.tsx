import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import type { VersionManagerTotals } from "@backend/features/analytics/contract";
import { Section } from "../../components/section";
import { StatTile } from "./stat-tiles";

interface VersionManagerTilesProps {
    totals: VersionManagerTotals;
}

/** What pushing and pulling has done, in the words the run report uses. */
export function VersionManagerTiles({
    totals
}: VersionManagerTilesProps): ReactNode {
    return (
        <Section title="Version manager">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                <StatTile
                    label="Runs"
                    value={totals.runs}
                    caption={`${totals.runsWithFailures} with failures`}
                />
                <StatTile label="Tabs updated" value={totals.updatedElements} />
                <StatTile
                    label="Versions created"
                    value={totals.createdVersions}
                />
                <StatTile
                    label="Links"
                    value={totals.links}
                    caption="Right now"
                />
            </SimpleGrid>
        </Section>
    );
}
