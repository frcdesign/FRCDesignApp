import {
    Badge,
    Button,
    Card,
    Group,
    SimpleGrid,
    Stack,
    Text,
    Title
} from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { SignInIcon, UsersThreeIcon } from "@phosphor-icons/react";
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
    const [uses, ...features] = report.standings;

    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>{teamLabel(report.first)}</Title>
                <Text c="dimmed">
                    {m.teamDashboardYear({ year: report.year })}
                </Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <StatTile label={m.teamDashboardUses()} value={uses.uses} />
                <StatTile
                    label={m.teamDashboardActiveMembers()}
                    value={report.activeMembers}
                />
                <StandingCard standing={uses} />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                {features.map((standing) => (
                    <StandingCard key={standing.category} standing={standing} />
                ))}
            </SimpleGrid>
        </Stack>
    );
}

function categoryLabel(category: TeamCategory): string {
    return category === ALL_USES
        ? m.teamDashboardAllUses()
        : featureLabel(category);
}

function medalColor(medal: Medal): string {
    switch (medal) {
        case Medal.GOLD:
            return "yellow";
        case Medal.SILVER:
            return "gray";
        case Medal.BRONZE:
            return "orange";
    }
}

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
                    <Badge color={medalColor(ranking.medal)}>
                        {medalLabel(ranking.medal)}
                    </Badge>
                )}
            </Group>
            <Title order={3}>
                {ranking
                    ? m.teamDashboardTop({ percent: ranking.topPercent })
                    : m.teamDashboardUnranked({ count: MIN_RANKED_TEAMS })}
            </Title>
            <Text c="dimmed">
                {m.teamDashboardPerMember({
                    uses: standing.uses,
                    perMember: Math.round(standing.usesPerMember * 10) / 10
                })}
            </Text>
        </Card>
    );
}
