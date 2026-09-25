import { Button, Switch } from "@mantine/core";
import { CheckIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    useApproveVersionsMutation,
    useAwaitingApprovalCount,
    useSetVersionApprovalMutation,
    useVersionApprovalQuery
} from "../queries";

export function VersionApprovalSwitch(): ReactNode {
    const query = useVersionApprovalQuery();
    const mutation = useSetVersionApprovalMutation();
    const enabled = query.data?.enabled ?? false;
    return (
        <Switch
            checked={enabled}
            disabled={query.isPending || mutation.isPending}
            onChange={() => mutation.mutate(!enabled)}
            withThumbIndicator={false}
        />
    );
}

export function ApproveVersionsButton(): ReactNode {
    const count = useAwaitingApprovalCount();
    const mutation = useApproveVersionsMutation();
    return (
        <Button
            leftSection={<CheckIcon />}
            disabled={count === 0}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
        >
            {count === 0 ? "Approve" : `Approve ${count}`}
        </Button>
    );
}
