import { Button, Switch } from "@mantine/core";
import { CheckIcon } from "@phosphor-icons/react";
import { type ReactNode, useId } from "react";
import { InputRow } from "../../../components/input-row";
import {
    useApproveVersionsMutation,
    useHoldNewVersionsQuery,
    useSetHoldNewVersionsMutation
} from "../queries";
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

/** Off, a new version loads as soon as Onshape reports it. */
export function HoldNewVersionsSetting(): ReactNode {
    const query = useHoldNewVersionsQuery();
    const mutation = useSetHoldNewVersionsMutation();
    const id = useId();
    return (
        <InputRow label="Hold new versions" htmlFor={id}>
            <Switch
                id={id}
                checked={query.data?.holdNewVersions ?? true}
                disabled={query.isPending}
                onChange={(event) =>
                    mutation.mutate(event.currentTarget.checked)
                }
                withThumbIndicator={false}
            />
        </InputRow>
    );
}
