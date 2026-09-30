import { Button, Checkbox, Group, TextInput, Textarea } from "@mantine/core";
import { ArrowLineUpIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    MAX_VERSION_NAME_LENGTH,
    PushScopeKind,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { InfoTooltip } from "../../../components/info-tooltip";
import { useAppModal } from "../../../components/open-app-modal";
import { IconSize } from "../../../lib/style-constants";
import {
    useIsVersionJobRunning,
    useNextVersionNameQuery,
    usePushVersionMutation
} from "../queries";
import { showQuickActionTip } from "../version-manager-tips";

interface PushVersionFormProps {
    workspace: WorkspacePath;
    target: LinkedWorkspace;
}

/**
 * What a push does before it runs: what the version is called, and how far it
 * travels. A modified click on the row runs it under the defaults shown here.
 */
export function PushVersionForm(props: PushVersionFormProps): ReactNode {
    const { workspace, target } = props;
    const modal = useAppModal();
    // Empty unless typed: the suggestion is only a placeholder, so each
    // document a recursive push versions is numbered from its own history.
    const [typedName, setTypedName] = useState("");
    const [description, setDescription] = useState("");
    const [recursive, setRecursive] = useState(false);
    const suggested = useNextVersionNameQuery(workspace);
    const push = usePushVersionMutation(workspace);
    const isRunning = useIsVersionJobRunning(workspace);

    // Untouched, the form did what a quick push does, which the tip points out.
    const isEdited = typedName !== "" || description !== "" || recursive;

    const submit = () => {
        push.mutate(
            {
                name: typedName,
                description: description.trim(),
                scope: {
                    kind: PushScopeKind.ONE,
                    workspace: target.workspace,
                    recursive
                }
            },
            {
                onSuccess: () => {
                    modal.close();
                    if (!isEdited) {
                        showQuickActionTip(LinkDirection.CHILD);
                    }
                }
            }
        );
    };

    return (
        <>
            <AppModalBody>
                <TextInput
                    label="Version name"
                    placeholder={
                        suggested.isPending
                            ? "Reading this document's versions..."
                            : suggested.data?.name
                    }
                    maxLength={MAX_VERSION_NAME_LENGTH}
                    value={typedName}
                    onChange={(event) =>
                        setTypedName(event.currentTarget.value)
                    }
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
                {/* Beside the checkbox rather than in its label, where a click
                    on the icon would tick the box. */}
                <Group gap={6}>
                    <Checkbox
                        label="Recursive push"
                        checked={recursive}
                        onChange={(event) =>
                            setRecursive(event.currentTarget.checked)
                        }
                    />
                    <InfoTooltip label="Also pushes on to the documents linked below the child, saving a new version of each one along the way so the next can use it. Each is numbered from its own versions unless you name them above." />
                </Group>
            </AppModalBody>
            <AppModalFooter>
                <Button
                    variant="light"
                    ml="auto"
                    rightSection={<ArrowLineUpIcon size={IconSize.SMALL} />}
                    loading={push.isPending}
                    disabled={isRunning}
                    onClick={submit}
                >
                    Push
                </Button>
            </AppModalFooter>
        </>
    );
}
