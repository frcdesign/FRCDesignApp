import { SimpleGrid } from "@mantine/core";
import { type UseQueryResult } from "@tanstack/react-query";
import { type ReactNode } from "react";
import type { DistributionsOut } from "@backend/features/analytics/contract";
import { Section, SectionCard } from "../../components/section";
import { m } from "../../paraglide/messages";
import { DashboardState } from "./dashboard-state";
import { DistributionChart } from "./distribution-chart";

interface DistributionsSectionProps {
    query: UseQueryResult<DistributionsOut>;
}

/** How uses and favorites spread across people, all time. */
export function DistributionsSection(
    props: DistributionsSectionProps
): ReactNode {
    const { query } = props;
    const caption = m.dashboardRangeAllTime();
    if (!query.data) {
        return (
            <DashboardState
                query={query}
                loading={m.dashboardLoadingDistributions()}
                title={m.dashboardDistributions()}
                caption={caption}
            />
        );
    }
    const { usesPerUser, favoritesPerUser } = query.data;
    return (
        <Section title={m.dashboardDistributions()} caption={caption}>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
                <SectionCard title={m.dashboardUsesPerPerson()}>
                    <DistributionChart
                        histogram={usesPerUser}
                        countLabel={m.dashboardPeople()}
                        valueLabel={m.dashboardUses()}
                    />
                </SectionCard>
                <SectionCard title={m.dashboardFavoritesPerPerson()}>
                    <DistributionChart
                        histogram={favoritesPerUser}
                        countLabel={m.dashboardPeople()}
                        valueLabel={m.dashboardFavorites()}
                    />
                </SectionCard>
            </SimpleGrid>
        </Section>
    );
}
