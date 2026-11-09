import {
    Button,
    Code,
    Group,
    JsonInput,
    NumberInput,
    Select,
    Stack,
    TextInput
} from "@mantine/core";
import { type ReactNode } from "react";
import { ONSHAPE_METHODS } from "@backend/features/testbench/contract";
import { m } from "../../../paraglide/messages";
import { showErrorToast } from "../../../lib/notifications";
import { useOnshapeCallMutation } from "../queries";
import { CallResult } from "./call-result";
import { toCallBody, type CallDraft } from "../call-draft";

interface OnshapeCallFormProps {
    draft: CallDraft;
    onChange: (draft: CallDraft) => void;
}

/** Any Onshape endpoint, at any version, as the owner. */
export function OnshapeCallForm(props: OnshapeCallFormProps): ReactNode {
    const { draft, onChange } = props;
    const call = useOnshapeCallMutation();

    const send = () => {
        const body = toCallBody(draft);
        if (!body) {
            showErrorToast(m.testbenchInvalidJson());
            return;
        }
        call.mutate(body);
    };

    return (
        <Stack>
            <Group align="end" wrap="nowrap">
                <Select
                    label={m.testbenchMethod()}
                    data={[...ONSHAPE_METHODS]}
                    value={draft.method}
                    allowDeselect={false}
                    onChange={(value) =>
                        value && onChange({ ...draft, method: value })
                    }
                    w={110}
                />
                <NumberInput
                    label={m.testbenchVersion()}
                    value={draft.version}
                    min={1}
                    max={99}
                    onChange={(value) =>
                        onChange({ ...draft, version: Number(value) })
                    }
                    w={90}
                />
                <TextInput
                    label={m.testbenchPath()}
                    value={draft.path}
                    onChange={(event) =>
                        onChange({ ...draft, path: event.currentTarget.value })
                    }
                    style={{ flex: 1 }}
                />
                <Button onClick={send} loading={call.isPending}>
                    {m.testbenchSend()}
                </Button>
            </Group>
            <JsonInput
                label={m.testbenchQuery()}
                value={draft.query}
                onChange={(query) => onChange({ ...draft, query })}
                autosize
                minRows={1}
            />
            <JsonInput
                label={m.testbenchBody()}
                value={draft.body}
                onChange={(body) => onChange({ ...draft, body })}
                autosize
                minRows={3}
                maxRows={20}
            />
            {call.data && <CallResult result={call.data} />}
            {call.error && <CallError error={call.error} />}
        </Stack>
    );
}

interface CallErrorProps {
    error: Error;
}

/** The Worker's own refusal, such as a non-owner's 403; Onshape's answers aren't errors here. */
export function CallError(props: CallErrorProps): ReactNode {
    return (
        <Code block c="red">
            {props.error.message}
        </Code>
    );
}
