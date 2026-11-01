import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { getPartsQuery } from "../../dashboard/dashboard-queries";
import { RangePreset, toDayRange } from "../../dashboard/range";
import { formatCount } from "../../dashboard/format";
import { partDashboardUrl } from "../../dashboard/dashboard-nav";
import { useLibraryId } from "../../../lib/library";
import { FontWeight, StatusColor } from "../../../lib/style-constants";
import { AppLink } from "../../../components/app-link";
import { CardSection } from "./card-section";
import { SectionId } from "../../../lib/ui-state";

interface UsageSectionProps {
    /** Analytics key parts by element, so a reloaded tab keeps its history. */
    elementId: string;
}

export function UsageSection(props: UsageSectionProps): ReactNode {
    const { elementId } = props;
    const libraryId = useLibraryId();

    return (
        <CardSection
            id={SectionId.USAGE}
            title="Usage"
            actions={
                <AppLink
                    href={partDashboardUrl(libraryId, elementId)}
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

/**
 * Read from the library's parts report, fetched once for every card and shared
 * with the dashboard. Only while the section is open, since it unmounts when closed.
 */
function UsageStats(props: UsageStatsProps): ReactNode {
    const { libraryId, elementId } = props;
    const parts = useQuery({
        ...getPartsQuery(libraryId, toDayRange(RangePreset.ALL)),
        staleTime: USAGE_STALE_TIME
    });
    const part = parts.data?.find((each) => each.path.elementId === elementId);
    return (
        <SimpleGrid cols={3} spacing="xs">
            <Stat label="Inserts" value={part?.insertCount} />
            <Stat label="Per month" value={part?.usesPerMonth} />
            <Stat label="Favorites" value={part?.favorites} />
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
