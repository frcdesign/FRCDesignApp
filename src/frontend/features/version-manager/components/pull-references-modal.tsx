import { Button, TextInput, Textarea } from "@mantine/core";
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
import { useAppModal } from "../../../components/open-app-modal";
import { IconSize } from "../../../lib/style-constants";
import {
    useIsVersionJobRunning,
    useNextVersionNameQuery,
    usePullReferencesMutation
} from "../queries";
import { showQuickActionTip } from "../version-manager-tips";

interface PullReferencesFormProps {
    workspace: WorkspacePath;
    /** The parent to pull from, which the run versions. */
    source: LinkedWorkspace;
}

/**
 * What a pull does before it runs: what to call the version it cuts in the
 * parent, this workspace then moving onto that. A modified click runs
 * without it, under the defaults shown here.
 */
export function PullReferencesForm(props: PullReferencesFormProps): ReactNode {
    const { workspace, source } = props;
    const modal = useAppModal();
    // Empty unless typed; see the push form.
    const [typedName, setTypedName] = useState("");
    const [description, setDescription] = useState("");
    const suggested = useNextVersionNameQuery(source.workspace);
    const pull = usePullReferencesMutation(workspace);
    const isRunning = useIsVersionJobRunning(workspace);

    // Untouched, the form did what a quick run does, which the tip points out.
    const isEdited = typedName !== "" || description !== "";

    const submit = () => {
        pull.mutate(
            {
                name: typedName,
                description: description.trim(),
                scope: {
                    kind: PullScopeKind.ONE,
                    workspace: source.workspace
                }
            },
            {
                onSuccess: () => {
                    modal.close();
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
            </AppModalBody>
            <AppModalFooter>
                <Button
                    variant="light"
                    ml="auto"
                    rightSection={<ArrowLineDownIcon size={IconSize.SMALL} />}
                    loading={pull.isPending}
                    disabled={isRunning}
                    onClick={submit}
                >
                    Pull
                </Button>
            </AppModalFooter>
        </>
    );
}
