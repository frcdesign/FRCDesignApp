import { Button, Switch } from "@mantine/core";
import { CheckIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { InputRow } from "../../../components/input-row";
import {
    useApproveVersionsMutation,
    useAwaitingApprovalCount,
    useSetVersionApprovalMutation,
    useVersionApprovalQuery
} from "../queries";

/** Held versions only exist while approval is on, so their row shows only then. */
export function VersionApprovalSettings(): ReactNode {
    const enabled = useVersionApprovalQuery().data?.enabled ?? false;
    return (
        <>
            <InputRow label="Approve new versions">
                <VersionApprovalSwitch />
            </InputRow>
            {enabled && (
                <InputRow label="Held versions">
                    <ApproveVersionsButton />
                </InputRow>
            )}
        </>
    );
}

function VersionApprovalSwitch(): ReactNode {
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

function ApproveVersionsButton(): ReactNode {
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
