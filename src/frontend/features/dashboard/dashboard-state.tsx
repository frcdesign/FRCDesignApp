import { Button } from "@mantine/core";
import { ChartBarIcon, type Icon } from "@phosphor-icons/react";
import { type UseQueryResult } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { AppIcon } from "../../components/app-icon";
import {
    SectionError,
    SectionLoading,
    SectionNotice
} from "../../components/app-notice";
import { Section } from "../../components/section";
import { IconSize, StatusColor } from "../../lib/style-constants";
import { m } from "../../paraglide/messages";

interface DashboardStateProps {
    query: UseQueryResult<unknown>;
    /** Takes the form "Loading {thing}...". */
    loading: string;
    /** The section's title, for a section whose content draws its own. */
    title?: string;
}

/** What stands in for a dashboard section while its query has no `data`. */
export function DashboardState(props: DashboardStateProps): ReactNode {
    const { query, loading, title } = props;
    const state = query.isError ? (
        <SectionError
            title={m.dashboardLoadFailed()}
            error={query.error}
            action={
                <Button variant="default" onClick={() => void query.refetch()}>
                    {m.dashboardTryAgain()}
                </Button>
            }
        />
    ) : (
        <SectionLoading title={loading} />
    );
    return title === undefined ? (
        state
    ) : (
        <Section title={title}>{state}</Section>
    );
}

interface DashboardEmptyProps {
    title: string;
    /** @default a dimmed chart */
    icon?: Icon;
    /** @default StatusColor.DIMMED */
    color?: StatusColor;
}

/** What a section shows when it loaded and there is nothing to draw. */
export function DashboardEmpty(props: DashboardEmptyProps): ReactNode {
    const { title, icon = ChartBarIcon, color = StatusColor.DIMMED } = props;
    return (
        <SectionNotice
            title={title}
            icon={<AppIcon icon={icon} size={IconSize.SECTION} color={color} />}
        />
    );
}
