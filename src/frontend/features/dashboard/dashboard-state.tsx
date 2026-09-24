import { Alert, Center, Loader } from "@mantine/core";
import { WarningIcon } from "@phosphor-icons/react";
import { type UseQueryResult } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { IconSize } from "../../lib/style-constants";

interface DashboardStateProps {
    query: UseQueryResult<unknown>;
}

/** For when a dashboard query has no `data`. */
export function DashboardState({ query }: DashboardStateProps): ReactNode {
    if (query.isError) {
        return (
            <Alert
                color="red"
                icon={<WarningIcon size={IconSize.MEDIUM} />}
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
