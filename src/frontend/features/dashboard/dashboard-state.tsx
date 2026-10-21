import { Alert, Center, Loader } from "@mantine/core";
import { type UseQueryResult } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { StatusIcon } from "../../components/status-icon";
import { Status } from "../../lib/status";
import { IconSize, StatusColor } from "../../lib/style-constants";

interface DashboardStateProps {
    query: UseQueryResult<unknown>;
}

/** For when a dashboard query has no `data`. */
export function DashboardState({ query }: DashboardStateProps): ReactNode {
    if (query.isError) {
        return (
            <Alert
                color={StatusColor.ERROR}
                icon={
                    <StatusIcon
                        status={Status.ERROR}
                        size={IconSize.MEDIUM}
                        raised={false}
                    />
                }
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
