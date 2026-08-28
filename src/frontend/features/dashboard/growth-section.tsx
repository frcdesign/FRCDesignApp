import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import type { GrowthOut } from "@backend/features/analytics/contract";
import { formatRate } from "./change-indicator";
import { ComparisonTile } from "./comparison-tile";
import { perUnit } from "./derived";
import { Section } from "./section";

/**
 * The trailing month against the month before it.
 *
 * The section that says something useful from the first weeks of tracking,
 * before there is a second season to compare against.
 */
export function RecentSection({
    growth,
    withOpens = false
}: {
    growth: GrowthOut;
    /** Opens follow the selected library, so the rate is app-level only. */
    withOpens?: boolean;
}): ReactNode {
    const { recent, trackingSince } = growth;
    const perUser = perUnit(recent.inserts, recent.activeUsers);
    const perOpen = perUnit(recent.inserts, recent.appOpens);

    return (
        <Section title="Right now" window={recent.inserts.label}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: withOpens ? 4 : 3 }}>
                <ComparisonTile
                    label="Uses"
                    comparison={recent.inserts}
                    trackingSince={trackingSince}
                />
                <ComparisonTile
                    label="Active users"
                    comparison={recent.activeUsers}
                    trackingSince={trackingSince}
                />
                <ComparisonTile
                    label="Uses per user"
                    comparison={perUser}
                    trackingSince={trackingSince}
                    format={formatRate}
                />
                {withOpens && (
                    <ComparisonTile
                        label="Uses per session"
                        comparison={perOpen}
                        trackingSince={trackingSince}
                        format={formatRate}
                    />
                )}
            </SimpleGrid>
        </Section>
    );
}
