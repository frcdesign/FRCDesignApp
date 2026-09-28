import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import type { VersionManagerTotals } from "@backend/features/analytics/contract";
import { Section } from "../../components/section";
import { StatTile } from "./stat-tiles";

interface VersionManagerTilesProps {
    totals: VersionManagerTotals;
}

/**
 * What pushing and pulling has done. References updated leads: each one is a
 * tab somebody would have opened and repointed by hand. Versions synced is the
 * app's own action, and documents linked is what it has to work with.
 */
export function VersionManagerTiles({
    totals
}: VersionManagerTilesProps): ReactNode {
    return (
        <Section title="Version manager">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                <StatTile
                    label="References updated"
                    value={totals.updatedElements}
                />
                <StatTile
                    label="Versions synced"
                    value={totals.createdVersions}
                />
                <StatTile
                    label="Documents linked"
                    value={totals.linkedWorkspaces}
                    caption="Right now"
                />
            </SimpleGrid>
        </Section>
    );
}
