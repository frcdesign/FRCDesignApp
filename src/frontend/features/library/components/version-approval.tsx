import { Button } from "@mantine/core";
import { CheckIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { InputRow } from "../../../components/input-row";
import { useApproveVersionsMutation } from "../queries";
import { useHeldGroupCount } from "../../build-status/queries";

/** New versions wait here until an editor approves them. */
export function HeldVersionsSetting(): ReactNode {
    const count = useHeldGroupCount();
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
