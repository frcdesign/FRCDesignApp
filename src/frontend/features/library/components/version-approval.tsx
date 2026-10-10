import { Button } from "@mantine/core";
import { CheckIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { InputRow } from "../../../components/input-row";
import {
    useApproveVersionsMutation,
    useAwaitingApprovalCount
} from "../queries";

/** New versions wait here until approved, or for a week. */
export function HeldVersionsSetting(): ReactNode {
    const count = useAwaitingApprovalCount();
    const mutation = useApproveVersionsMutation();
    return (
        <InputRow label="Held versions">
            <Button
                leftSection={<CheckIcon />}
                disabled={count === 0}
                onClick={() => mutation.mutate()}
                loading={mutation.isPending}
            >
                {count === 0 ? "Approve" : `Approve ${count}`}
            </Button>
        </InputRow>
    );
}
