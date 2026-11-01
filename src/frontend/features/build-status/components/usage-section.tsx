import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { getInsertableReportQuery } from "../../dashboard/dashboard-queries";
import { RangePreset, toDayRange } from "../../dashboard/range";
import { formatCount } from "../../dashboard/format";
import { useLibraryId } from "../../../lib/library";
import { FontWeight, StatusColor } from "../../../lib/style-constants";
import { AppLink } from "../../../components/app-link";
import { CardSection } from "./card-section";
import { CardSectionId } from "../card-section-id";

/** The dashboard's report on one part, all time, as its own tab. */
function getPartDashboardUrl(libraryId: LibraryId, elementId: string): string {
    const search = new URLSearchParams({ element: elementId });
    return `/dashboard/library/${libraryId}/part?${search.toString()}`;
}

interface UsageSectionProps {
    /** Analytics key parts by element, so a reloaded tab keeps its history. */
    elementId: string;
}

export function UsageSection(props: UsageSectionProps): ReactNode {
    const { elementId } = props;
    const libraryId = useLibraryId();

    return (
        <CardSection
            id={CardSectionId.USAGE}
            title="Usage"
            actions={
                <AppLink
                    href={getPartDashboardUrl(libraryId, elementId)}
                    size="sm"
                >
                    Dashboard
                </AppLink>
            }
        >
            <UsageStats libraryId={libraryId} elementId={elementId} />
        </CardSection>
    );
}

interface UsageStatsProps {
    libraryId: LibraryId;
    elementId: string;
}

/** The report ends yesterday, so reopening a card within minutes needn't ask again. */
const USAGE_STALE_TIME = 5 * 60 * 1000;

/** Fetched only while the section is open, since it unmounts when closed. */
function UsageStats(props: UsageStatsProps): ReactNode {
    const { libraryId, elementId } = props;
    const report = useQuery({
        ...getInsertableReportQuery(
            libraryId,
            elementId,
            toDayRange(RangePreset.ALL)
        ),
        staleTime: USAGE_STALE_TIME
    });
    const data = report.data;
    return (
        <SimpleGrid cols={4} spacing="xs">
            <Stat label="Inserts" value={data?.insertCount} />
            <Stat label="Per month" value={data?.usesPerMonth} />
            <Stat label="Users" value={data?.uniqueUsers} />
            <Stat label="Favorites" value={data?.favorites} />
        </SimpleGrid>
    );
}

interface StatProps {
    label: string;
    /** Absent while loading or when the report failed. */
    value?: number;
}

function Stat(props: StatProps): ReactNode {
    const { label, value } = props;
    return (
        <Stack gap={0}>
            <Text fw={FontWeight.SEMI_BOLD}>{formatCount(value)}</Text>
            <Text size="xs" c={StatusColor.DIMMED}>
                {label}
            </Text>
        </Stack>
    );
}
