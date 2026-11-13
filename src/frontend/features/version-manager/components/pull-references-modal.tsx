import { ArrowLineDownIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    PullScopeKind,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { InfoCheckbox } from "../../../components/info-checkbox";
import { useAppModal } from "../../../components/open-app-modal";
import { IconSize } from "../../../lib/style-constants";
import { useIsVersionJobRunning, usePullReferencesMutation } from "../queries";
import { VersionForm, type VersionFields } from "./version-form";
import { showQuickRecursiveTip } from "../tips";
import { m } from "../../../paraglide/messages";

interface PullReferencesFormProps {
    workspace: WorkspacePath;
    /** The parent to pull from, which the run versions. */
    source: LinkedWorkspace;
}

/** A click on a parent's row opens this; its button and menu run under the defaults it shows. */
export function PullReferencesForm(props: PullReferencesFormProps): ReactNode {
    const { workspace, source } = props;
    const modal = useAppModal();
    const [recursive, setRecursive] = useState(false);
    const pull = usePullReferencesMutation(workspace);
    const isRunning = useIsVersionJobRunning(workspace);

    const submit = ({ name, description }: VersionFields) => {
        pull.mutate(
            {
                name,
                description,
                scope: {
                    kind: PullScopeKind.ONE,
                    workspace: source.workspace,
                    recursive
                }
            },
            {
                onSuccess: () => {
                    modal.close();
                    if (recursive) showQuickRecursiveTip(LinkDirection.PARENT);
                }
            }
        );
    };

    return (
        <VersionForm
            versioned={source.workspace}
            submitLabel={m.versionManagerFormPull()}
            submitIcon={<ArrowLineDownIcon size={IconSize.SMALL} />}
            isPending={pull.isPending}
            disabled={isRunning}
            onSubmit={submit}
            options={
                <InfoCheckbox
                    label={m.versionManagerFormRecursive()}
                    info={m.versionManagerFormRecursivePullInfo()}
                    checked={recursive}
                    onChange={setRecursive}
                />
            }
        />
    );
}
