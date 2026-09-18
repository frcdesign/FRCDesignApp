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
    /**
     * The one workspace to push to, when the push was started from its row.
     * A version still has to be named, so the row opens this form rather than
     * running straight off — it only narrows what the push reaches.
     */
    target?: LinkedWorkspace;
    /** Mantine's id for the modal this sits in, so a push can close it. */
    modalId: string;
}

/**
 * Names the version, and decides how far it travels. The recursive option is
 * the one worth reading before clicking: it cuts versions in other people's
 * documents, which a direct push never does.
 */
export function PushVersionForm(props: PushVersionFormProps): ReactNode {
    const { workspace, downstream, target, modalId } = props;
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [recursive, setRecursive] = useState(false);
    const push = usePushVersionMutation(workspace);

    const submit = () => {
        push.mutate(
            {
                name: name.trim(),
                description: description.trim(),
                scope: target
                    ? { kind: "one", workspace: target.workspace }
                    : { kind: recursive ? "recursive" : "direct" }
            },
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
                <PushTargets
                    downstream={target ? [target] : downstream}
                    recursive={recursive}
                />
                {/* A push aimed at one workspace has nowhere further to go, so
                    the option that would carry it there is not offered. */}
                {!target && (
                    <Checkbox
                        label="Recursive push"
                        description="Also updates everything linked further downstream, cutting a version of each workspace on the way so the next one can reference it."
                        checked={recursive}
                        onChange={(event) =>
                            setRecursive(event.currentTarget.checked)
                        }
                    />
                )}
                {recursive && (
                    <Callout text="A recursive push creates versions in the linked documents, not just in this one." />
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

interface PushTargetsProps {
    downstream: LinkedWorkspace[];
    recursive: boolean;
}

/** The workspaces the push updates, so the button is not a leap of faith. */
function PushTargets(props: PushTargetsProps): ReactNode {
    const { downstream, recursive } = props;

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
                {/* Named rather than listed: what lies past them is the
                    server's walk of the graph, not something this form knows. */}
                {recursive && (
                    <List.Item>everything linked past them</List.Item>
                )}
            </List>
        </Stack>
    );
}
