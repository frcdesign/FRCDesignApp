import { Button } from "@mantine/core";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { useRefreshAdminTeamMutation } from "../queries";

export function RefreshAdminTeamButton(): ReactNode {
    const mutation = useRefreshAdminTeamMutation();
    return (
        <Button
            leftSection={<ArrowsClockwiseIcon />}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
        >
            Refresh
        </Button>
    );
}
