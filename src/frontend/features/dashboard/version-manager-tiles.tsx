import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import type { VersionManagerTotals } from "@backend/features/analytics/contract";
import { Section } from "../../components/section";
import { StatTile } from "./stat-tiles";
import { m } from "../../paraglide/messages";

interface VersionManagerTilesProps {
    totals: VersionManagerTotals;
    /** Beside the title: the window it covers, where the page doesn't pick one. */
    caption?: string;
}

/** What pushing and pulling has done, in the words the run report uses. */
export function VersionManagerTiles({
    totals,
    caption
}: VersionManagerTilesProps): ReactNode {
    return (
        <Section title={m.dashboardVersionManager()} caption={caption}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                <StatTile
                    label={m.dashboardVersionRuns()}
                    value={totals.runs}
                />
                <StatTile
                    label={m.dashboardVersionTabsUpdated()}
                    value={totals.updatedElements}
                />
                <StatTile
                    label={m.dashboardVersionVersionsCreated()}
                    value={totals.createdVersions}
                />
                <StatTile
                    label={m.dashboardVersionLinks()}
                    value={totals.links}
                    caption={m.dashboardVersionRightNow()}
                />
            </SimpleGrid>
        </Section>
    );
}
