import { ArrowLineUpIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    PushScopeKind,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { InfoCheckbox } from "../../../components/info-checkbox";
import { useAppModal } from "../../../components/open-app-modal";
import { IconSize } from "../../../lib/style-constants";
import { useIsVersionJobRunning, usePushVersionMutation } from "../queries";
import { VersionForm, type VersionFields } from "./version-form";
import { showQuickRecursiveTip } from "../tips";
import { m } from "../../../paraglide/messages";

interface PushVersionFormProps {
    workspace: WorkspacePath;
    target: LinkedWorkspace;
}

/** A click on a child's row opens this; its button and menu run under the defaults it shows. */
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
                    if (recursive) showQuickRecursiveTip(LinkDirection.CHILD);
                }
            }
        );
    };

    return (
        <VersionForm
            versioned={workspace}
            submitLabel={m.versionManagerFormPush()}
            submitIcon={<ArrowLineUpIcon size={IconSize.SMALL} />}
            isPending={push.isPending}
            disabled={isRunning}
            onSubmit={submit}
            options={
                <InfoCheckbox
                    label={m.versionManagerFormRecursive()}
                    info={m.versionManagerFormRecursivePushInfo()}
                    checked={recursive}
                    onChange={setRecursive}
                />
            }
        />
    );
}
