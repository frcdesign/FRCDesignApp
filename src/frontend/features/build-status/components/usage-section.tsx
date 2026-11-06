import { ActionIcon, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { ChartLineIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { ReactNode } from "react";
import { type PartUsageOut } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getPartsQuery } from "../../dashboard/dashboard-queries";
import { RangePreset, toDayRange } from "../../dashboard/range";
import { formatCount } from "../../dashboard/format";
import {
    libraryDashboardUrl,
    partDashboardUrl
} from "../../dashboard/dashboard-nav";
import { useLibraryId } from "../../../lib/library";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { CardSection } from "./card-section";
import { SectionId } from "../../../lib/ui-state";
import { m } from "../../../paraglide/messages";

interface PartUsageSectionProps {
    /** Analytics key parts by element, so a reloaded tab keeps its history. */
    elementId: string;
}

/** A part's numbers, linking to its report. */
export function PartUsageSection(props: PartUsageSectionProps): ReactNode {
    const { elementId } = props;
    const libraryId = useLibraryId();
    return (
        <UsageSection
            libraryId={libraryId}
            elementIds={[elementId]}
            dashboardUrl={partDashboardUrl(libraryId, elementId)}
        />
    );
}

interface GroupUsageSectionProps {
    /** Its parts', whose numbers it totals. */
    elementIds: string[];
}

/** A group's totals, linking to its library's report, which lists its parts. */
export function GroupUsageSection(props: GroupUsageSectionProps): ReactNode {
    const { elementIds } = props;
    const libraryId = useLibraryId();
    return (
        <UsageSection
            libraryId={libraryId}
            elementIds={elementIds}
            dashboardUrl={libraryDashboardUrl(libraryId)}
        />
    );
}

interface UsageSectionProps {
    libraryId: LibraryId;
    elementIds: string[];
    dashboardUrl: string;
}

function UsageSection(props: UsageSectionProps): ReactNode {
    const { libraryId, elementIds, dashboardUrl } = props;

    return (
        <CardSection
            id={SectionId.USAGE}
            title={m.adminCardUsage()}
            actions={
                <Tooltip label={m.adminCardOpenDashboard()}>
                    <ActionIcon
                        size="sm"
                        component="a"
                        href={dashboardUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <ChartLineIcon size={IconSize.SMALL} />
                    </ActionIcon>
                </Tooltip>
            }
        >
            <UsageStats libraryId={libraryId} elementIds={elementIds} />
        </CardSection>
    );
}

interface UsageStatsProps {
    libraryId: LibraryId;
    elementIds: string[];
}

/** The report ends yesterday, so reopening a card within minutes needn't ask again. */
const USAGE_STALE_TIME = 5 * 60 * 1000;

/**
 * Read from the library's parts report, fetched once for every card and shared
 * with the dashboard. Only while the section is open, since it unmounts when closed.
 */
function UsageStats(props: UsageStatsProps): ReactNode {
    const { libraryId, elementIds } = props;
    const parts = useQuery({
        ...getPartsQuery(libraryId, toDayRange(RangePreset.ALL)),
        staleTime: USAGE_STALE_TIME
    });
    const total = parts.data && totalUsage(parts.data, elementIds);
    return (
        <SimpleGrid cols={3} spacing="xs">
            <Stat label={m.adminCardInserts()} value={total?.insertCount} />
            <Stat label={m.adminCardPerMonth()} value={total?.usesPerMonth} />
            <Stat label={m.adminCardFavorites()} value={total?.favorites} />
        </SimpleGrid>
    );
}

type UsageTotal = Pick<
    PartUsageOut,
    "insertCount" | "usesPerMonth" | "favorites"
>;

/** Undefined when the report lists none of them, as for a part added since it ran. */
function totalUsage(
    parts: PartUsageOut[],
    elementIds: string[]
): UsageTotal | undefined {
    const wanted = new Set(elementIds);
    const listed = parts.filter((part) => wanted.has(part.path.elementId));
    if (listed.length === 0) return undefined;
    return {
        insertCount: sum(listed, (part) => part.insertCount),
        usesPerMonth: sum(listed, (part) => part.usesPerMonth),
        favorites: sum(listed, (part) => part.favorites)
    };
}

function sum<T>(items: T[], value: (item: T) => number): number {
    return items.reduce((total, item) => total + value(item), 0);
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
