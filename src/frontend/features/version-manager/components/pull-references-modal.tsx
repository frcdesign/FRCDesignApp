import { Button, Text, TextInput, Textarea } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowLineDownIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    MAX_VERSION_NAME_LENGTH,
    PullScopeKind,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { useNextVersionNameQuery, usePullReferencesMutation } from "../queries";
import { showQuickActionTip } from "../version-manager-tips";

export interface PullReferencesFormProps {
    workspace: WorkspacePath;
    /** The parent to pull from, which the run versions. */
    source: LinkedWorkspace;
    /** What that parent is called, for the line above the button. */
    sourceName: string;
    modalId: string;
}

/**
 * What a pull does before it runs: what to call the version it cuts in the
 * parent, this workspace then moving onto that. The Quick pull buttons run
 * without it, under the defaults shown here.
 */
export function PullReferencesForm(props: PullReferencesFormProps): ReactNode {
    const { workspace, source, sourceName, modalId } = props;
    // Undefined until somebody types; see the push form, which this mirrors.
    const [typedName, setTypedName] = useState<string>();
    const [description, setDescription] = useState("");
    const suggested = useNextVersionNameQuery(source.workspace);
    const pull = usePullReferencesMutation(workspace);

    const name = typedName ?? suggested.data?.name ?? "";
    // Nothing here was touched, so the form did nothing a menu item would not
    // have done — which is what the tip is for.
    const isEdited = typedName !== undefined || description !== "";

    const submit = () => {
        pull.mutate(
            {
                name,
                description: description.trim(),
                scope: {
                    kind: PullScopeKind.ONE,
                    workspace: source.workspace
                }
            },
            {
                onSuccess: () => {
                    modals.close(modalId);
                    if (!isEdited) {
                        showQuickActionTip(LinkDirection.PARENT);
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
                            ? "Reading that document's versions..."
                            : "Leave empty for the next V number"
                    }
                    maxLength={MAX_VERSION_NAME_LENGTH}
                    value={name}
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
                <Text size="sm" c={StatusColor.DIMMED}>
                    A version of {sourceName} is created, and this document's
                    references to it move onto that version.
                </Text>
            </AppModalBody>
            <AppModalFooter>
                <Button
                    variant="light"
                    ml="auto"
                    rightSection={<ArrowLineDownIcon size={IconSize.SMALL} />}
                    loading={pull.isPending}
                    onClick={submit}
                >
                    Pull
                </Button>
            </AppModalFooter>
        </>
    );
}
