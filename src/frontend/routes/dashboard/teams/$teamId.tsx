import {
    Button,
    Card,
    Group,
    SimpleGrid,
    Stack,
    Text,
    Title,
    Tooltip
} from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { MedalIcon, SignInIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    ALL_USES,
    Medal,
    MIN_RANKED_TEAMS,
    teamLabel,
    type TeamCategory,
    type TeamStanding
} from "@backend/features/teams/contract";
import { useTeamReportQuery } from "../../../features/teams/queries";
import { useNeedsSignIn } from "../../../features/auth/access-level";
import { startSignIn } from "../../../features/auth/sign-in";
import { featureLabel } from "../../../features/dashboard/feature-reach";
import { StatTile } from "../../../features/dashboard/stat-tiles";
import { DistributionChart } from "../../../features/dashboard/distribution-chart";
import {
    PageError,
    PageLoading,
    PageNotice
} from "../../../components/app-notice";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";

export const Route = createFileRoute("/dashboard/teams/$teamId")({
    component: TeamDashboard
});

/** Members only: a team sees its own numbers, and only where it stands among the others. */
function TeamDashboard(): ReactNode {
    const { teamId } = Route.useParams();
    const needsSignIn = useNeedsSignIn();
    const reportQuery = useTeamReportQuery(teamId);

    if (needsSignIn) {
        return (
            <PageNotice
                icon={<UsersThreeIcon size={IconSize.SECTION} />}
                title={m.teamDashboardSignIn()}
                action={
                    <Button leftSection={<SignInIcon />} onClick={startSignIn}>
                        {m.teamDashboardSignInButton()}
                    </Button>
                }
            />
        );
    }
    if (reportQuery.isPending) {
        return <PageLoading title={m.teamDashboardLoading()} />;
    }
    if (reportQuery.isError) {
        return (
            <PageError
                title={m.teamDashboardFailed()}
                error={reportQuery.error}
            />
        );
    }
    const report = reportQuery.data;
    const [uses] = report.standings;
    const ranked = report.standings.filter((standing) => standing.ranking);
    const unranked = report.standings.filter((standing) => !standing.ranking);

    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>{teamLabel(report.first)}</Title>
                <Text c="dimmed">
                    {m.teamDashboardYear({ year: report.year })}
                </Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <StatTile label={m.teamDashboardUses()} value={uses.uses} />
                <StatTile
                    label={m.teamDashboardActiveMembers()}
                    value={report.activeMembers}
                />
            </SimpleGrid>
            {/* Apart, so a card with no chart isn't stretched to one's height. */}
            {[ranked, unranked].map(
                (standings) =>
                    standings.length > 0 && (
                        <SimpleGrid
                            key={standings[0].category}
                            cols={{ base: 1, sm: 2, md: 3 }}
                        >
                            {standings.map((standing) => (
                                <StandingCard
                                    key={standing.category}
                                    standing={standing}
                                />
                            ))}
                        </SimpleGrid>
                    )
            )}
        </Stack>
    );
}

function categoryLabel(category: TeamCategory): string {
    return category === ALL_USES
        ? m.teamDashboardAllUses()
        : featureLabel(category);
}

/** The metals themselves: a medal is a medal in any theme. */
const MEDAL_COLORS: Record<Medal, string> = {
    [Medal.GOLD]: "#d4a017",
    [Medal.SILVER]: "#a8b2bd",
    [Medal.BRONZE]: "#b8732e"
};

const MEDAL_SIZE = 28;
const DISTRIBUTION_HEIGHT = 150;

function medalLabel(medal: Medal): string {
    switch (medal) {
        case Medal.GOLD:
            return m.teamMedalGold();
        case Medal.SILVER:
            return m.teamMedalSilver();
        case Medal.BRONZE:
            return m.teamMedalBronze();
    }
}

function standingTitle(standing: TeamStanding): string {
    if (standing.ranking) {
        return m.teamDashboardTop({ percent: standing.ranking.topPercent });
    }
    return standing.uses === 0
        ? m.teamDashboardUnused()
        : m.teamDashboardUnranked({ count: MIN_RANKED_TEAMS });
}

interface StandingCardProps {
    standing: TeamStanding;
}

function StandingCard(props: StandingCardProps): ReactNode {
    const { standing } = props;
    const { ranking } = standing;
    return (
        <Card>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Text c="dimmed" tt="uppercase" fw={700}>
                    {categoryLabel(standing.category)}
                </Text>
                {ranking?.medal && (
                    <Tooltip label={medalLabel(ranking.medal)}>
                        <MedalIcon
                            size={MEDAL_SIZE}
                            weight="fill"
                            color={MEDAL_COLORS[ranking.medal]}
                        />
                    </Tooltip>
                )}
            </Group>
            <Title order={3}>{standingTitle(standing)}</Title>
            <Text c="dimmed">
                {m.teamDashboardPerMember({
                    uses: standing.uses,
                    perMember: Math.round(standing.usesPerMember * 10) / 10
                })}
            </Text>
            {ranking && (
                <DistributionChart
                    compact
                    h={DISTRIBUTION_HEIGHT}
                    histogram={ranking.distribution}
                    countLabel={m.teamDashboardTeams()}
                    valueLabel={m.teamDashboardUsesPerMember()}
                    mark={{
                        bin: ranking.teamBin,
                        label: m.teamDashboardYourTeam()
                    }}
                />
            )}
        </Card>
    );
}
