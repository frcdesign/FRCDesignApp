import { Alert, Center, Loader } from "@mantine/core";
import { Warning } from "@phosphor-icons/react";
import { type UseQueryResult } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { IconSize } from "../../lib/style-constants";

/**
 * Renders the loading/error state of a dashboard query. Views call this when
 * `data` is absent, so each one doesn't repeat the same two branches.
 */
export function DashboardState({
    query
}: {
    query: UseQueryResult<unknown>;
}): ReactNode {
    if (query.isError) {
        return (
            <Alert
                color="red"
                icon={<Warning size={IconSize.MEDIUM} />}
                title="Failed to load analytics"
            >
                {query.error instanceof Error
                    ? query.error.message
                    : "Please try again."}
            </Alert>
        );
    }

    return (
        <Center py="xl">
            <Loader />
        </Center>
    );
}
