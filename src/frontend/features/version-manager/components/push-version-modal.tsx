import {
    Button,
    Checkbox,
    List,
    Stack,
    Text,
    TextInput,
    Textarea
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowLineUpIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    MAX_VERSION_NAME_LENGTH,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { Callout } from "../../../components/callout";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { usePushVersionMutation } from "../queries";

interface PushVersionFormProps {
    workspace: WorkspacePath;
    /** The workspaces a direct push updates, which the form names. */
    downstream: LinkedWorkspace[];
    /** Mantine's id for the modal this sits in, so a push can close it. */
    modalId: string;
}

/**
 * Names the version, and decides how far it travels. The recursive option is
 * the one worth reading before clicking: it cuts versions in other people's
 * documents, which a direct push never does.
 */
export function PushVersionForm(props: PushVersionFormProps): ReactNode {
    const { workspace, downstream, modalId } = props;
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [recursive, setRecursive] = useState(false);
    const push = usePushVersionMutation(workspace);

    const submit = () => {
        push.mutate(
            { name: name.trim(), description: description.trim(), recursive },
            { onSuccess: () => modals.close(modalId) }
        );
    };

    return (
        <>
            <AppModalBody>
                <TextInput
                    label="Version name"
                    placeholder="e.g. Week 3 release"
                    maxLength={MAX_VERSION_NAME_LENGTH}
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                    data-autofocus
                />
                <Textarea
                    label="Description"
                    placeholder="Optional"
                    autosize
                    minRows={2}
                    maxRows={5}
                    value={description}
                    onChange={(event) =>
                        setDescription(event.currentTarget.value)
                    }
                />
                <PushTargets downstream={downstream} />
                <Checkbox
                    label="Keep going past them"
                    description="Also updates everything linked further downstream, cutting a version of each workspace on the way so the next one can reference it."
                    checked={recursive}
                    onChange={(event) =>
                        setRecursive(event.currentTarget.checked)
                    }
                />
                {recursive && (
                    <Callout text="This creates versions in the linked documents, not just in this one." />
                )}
            </AppModalBody>
            <AppModalFooter>
                <Button
                    variant="light"
                    ml="auto"
                    leftSection={<ArrowLineUpIcon size={IconSize.SMALL} />}
                    loading={push.isPending}
                    disabled={name.trim() === ""}
                    onClick={submit}
                >
                    Push
                </Button>
            </AppModalFooter>
        </>
    );
}

/** The workspaces the push updates, so the button is not a leap of faith. */
function PushTargets(props: { downstream: LinkedWorkspace[] }): ReactNode {
    const { downstream } = props;

    if (downstream.length === 0) {
        return (
            <Text size="sm" c={StatusColor.DIMMED}>
                Nothing is linked downstream, so this only creates a version of
                this workspace.
            </Text>
        );
    }

    return (
        <Stack gap={4}>
            <Text size="sm">
                References to this document will be updated in:
            </Text>
            <List size="sm" c={StatusColor.DIMMED}>
                {downstream.map((each) => (
                    <List.Item key={each.linkId}>
                        {each.documentName ?? "A document you cannot open"}
                    </List.Item>
                ))}
            </List>
        </Stack>
    );
}
