import { Button, Center, Loader } from "@mantine/core";
import { type UseQueryResult } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { SectionError } from "../../components/app-notice";
import { Section } from "../../components/section";
import { m } from "../../paraglide/messages";

interface DashboardStateProps {
    query: UseQueryResult<unknown>;
    /** The section's title, for a section whose content draws its own. */
    title?: string;
}

/** What stands in for a dashboard section while its query has no `data`. */
export function DashboardState(props: DashboardStateProps): ReactNode {
    const { query, title } = props;
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
        <Center py="xl">
            <Loader />
        </Center>
    );
    return title === undefined ? (
        state
    ) : (
        <Section title={title}>{state}</Section>
    );
}
