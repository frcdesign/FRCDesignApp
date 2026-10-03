import { ArrowLineDownIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    LinkDirection,
    PullScopeKind,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { useAppModal } from "../../../components/open-app-modal";
import { IconSize } from "../../../lib/style-constants";
import { useIsVersionJobRunning, usePullReferencesMutation } from "../queries";
import { showQuickActionTip } from "../version-manager-tips";
import { VersionForm, type VersionFields } from "./version-form";

interface PullReferencesFormProps {
    workspace: WorkspacePath;
    /** The parent to pull from, which the run versions. */
    source: LinkedWorkspace;
}

/** A modified click on the row runs this under the defaults it shows. */
export function PullReferencesForm(props: PullReferencesFormProps): ReactNode {
    const { workspace, source } = props;
    const modal = useAppModal();
    const pull = usePullReferencesMutation(workspace);
    const isRunning = useIsVersionJobRunning(workspace);

    const submit = ({ name, description }: VersionFields) => {
        pull.mutate(
            {
                name,
                description,
                scope: { kind: PullScopeKind.ONE, workspace: source.workspace }
            },
            {
                onSuccess: () => {
                    modal.close();
                    // Untouched, the form did what a quick pull does.
                    if (!name && !description) {
                        showQuickActionTip(LinkDirection.PARENT);
                    }
                }
            }
        );
    };

    return (
        <VersionForm
            versioned={source.workspace}
            submitLabel="Pull"
            submitIcon={<ArrowLineDownIcon size={IconSize.SMALL} />}
            isPending={pull.isPending}
            disabled={isRunning}
            onSubmit={submit}
        />
    );
}
