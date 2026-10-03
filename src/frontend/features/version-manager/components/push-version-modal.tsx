import { Checkbox, Group } from "@mantine/core";
import { ArrowLineUpIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    PushScopeKind,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { InfoTooltip } from "../../../components/info-tooltip";
import { useAppModal } from "../../../components/open-app-modal";
import { IconSize } from "../../../lib/style-constants";
import { useIsVersionJobRunning, usePushVersionMutation } from "../queries";
import { showQuickActionTip } from "../version-manager-tips";
import { VersionForm, type VersionFields } from "./version-form";

interface PushVersionFormProps {
    workspace: WorkspacePath;
    target: LinkedWorkspace;
}

/** A modified click on the row runs this under the defaults it shows. */
export function PushVersionForm(props: PushVersionFormProps): ReactNode {
    const { workspace, target } = props;
    const modal = useAppModal();
    const [recursive, setRecursive] = useState(false);
    const push = usePushVersionMutation(workspace);
    const isRunning = useIsVersionJobRunning(workspace);

    const submit = ({ name, description }: VersionFields) => {
        push.mutate(
            {
                name,
                description,
                scope: {
                    kind: PushScopeKind.ONE,
                    workspace: target.workspace,
                    recursive
                }
            },
            {
                onSuccess: () => {
                    modal.close();
                    // Untouched, the form did what a quick push does.
                    if (!name && !description && !recursive) {
                        showQuickActionTip(LinkDirection.CHILD);
                    }
                }
            }
        );
    };

    return (
        <VersionForm
            versioned={workspace}
            submitLabel="Push"
            submitIcon={<ArrowLineUpIcon size={IconSize.SMALL} />}
            isPending={push.isPending}
            disabled={isRunning}
            onSubmit={submit}
        >
            {/* Beside the checkbox, where a click on the icon can't tick it. */}
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
        </VersionForm>
    );
}
