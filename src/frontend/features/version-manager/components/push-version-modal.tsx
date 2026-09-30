import { Button, Checkbox, Group, TextInput, Textarea } from "@mantine/core";
import { ArrowLineUpIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    MAX_VERSION_NAME_LENGTH,
    PushScopeKind,
    type LinkedWorkspace,
    type PushScope,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { InfoTooltip } from "../../../components/info-tooltip";
import { useAppModal } from "../../../components/open-app-modal";
import { IconSize } from "../../../lib/style-constants";
import { useNextVersionNameQuery, usePushVersionMutation } from "../queries";
import { showQuickActionTip } from "../version-manager-tips";

export interface PushVersionFormProps {
    workspace: WorkspacePath;
    /** The one child to push to; absent for every child. */
    target?: LinkedWorkspace;
}

/**
 * What a push does before it runs: what the version is called, and how far it
 * travels. This is what clicking a row opens; a modified click runs it without
 * the form, under the defaults shown here.
 */
export function PushVersionForm(props: PushVersionFormProps): ReactNode {
    const { workspace, target } = props;
    const modal = useAppModal();
    // Empty unless somebody types one: the suggestion is the placeholder, and
    // left alone each document the push versions is numbered from its own
    // history rather than all taking this one's number.
    const [typedName, setTypedName] = useState("");
    const [description, setDescription] = useState("");
    const [recursive, setRecursive] = useState(false);
    const suggested = useNextVersionNameQuery(workspace);
    const push = usePushVersionMutation(workspace);

    // Nothing here was touched, so the form did nothing a menu item would not
    // have done — which is what the tip is for.
    const isEdited = typedName !== "" || description !== "" || recursive;

    const scope: PushScope = target
        ? {
              kind: PushScopeKind.ONE,
              workspace: target.workspace,
              recursive
          }
        : {
              kind: recursive
                  ? PushScopeKind.DESCENDANTS
                  : PushScopeKind.CHILDREN
          };

    const submit = () => {
        push.mutate(
            {
                name: typedName,
                description: description.trim(),
                scope
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
                    onClick={submit}
                >
                    Push
                </Button>
            </AppModalFooter>
        </>
    );
}
