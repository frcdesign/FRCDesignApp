import { Button, List, SegmentedControl, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowLineDownIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    PullScopeKind,
    type LinkedWorkspace,
    type PullScope,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { usePullReferencesMutation } from "../queries";
import { showQuickActionTip } from "../version-manager-tips";

export interface PullReferencesFormProps {
    workspace: WorkspacePath;
    /** The one parent to pull from; absent for every parent. */
    source?: LinkedWorkspace;
    /** What the pull reads, named for the list above the button. */
    sources: string[];
    modalId: string;
}

/**
 * What a pull does before it runs. There is no version to name, so what this
 * asks instead is how wide to cast: the parents somebody linked, or every
 * out-of-date reference the workspace has, linked or not.
 */
export function PullReferencesForm(props: PullReferencesFormProps): ReactNode {
    const { workspace, source, sources, modalId } = props;
    const [everything, setEverything] = useState(false);
    const pull = usePullReferencesMutation(workspace);

    // Aimed at one parent there is nothing to widen, so the choice is not
    // offered and the run is one a menu item would have made.
    const isEdited = everything;

    const scope: PullScope = source
        ? { kind: PullScopeKind.ONE, workspace: source.workspace }
        : {
              kind: everything ? PullScopeKind.ALL : PullScopeKind.PARENTS
          };

    const submit = () => {
        pull.mutate(scope, {
            onSuccess: () => {
                modals.close(modalId);
                if (!isEdited) {
                    showQuickActionTip(LinkDirection.PARENT);
                }
            }
        });
    };

    return (
        <>
            <AppModalBody>
                {!source && (
                    <SegmentedControl
                        size="xs"
                        fullWidth
                        value={everything ? "all" : "linked"}
                        onChange={(value) => setEverything(value === "all")}
                        data={[
                            { value: "linked", label: "Linked parents" },
                            { value: "all", label: "All references" }
                        ]}
                    />
                )}
                <PullSources sources={sources} everything={everything} />
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

interface PullSourcesProps {
    sources: string[];
    everything: boolean;
}

/** What the pull will move this workspace's references onto. */
function PullSources(props: PullSourcesProps): ReactNode {
    const { sources, everything } = props;

    if (everything) {
        return (
            <Text size="sm" c={StatusColor.DIMMED}>
                Every out-of-date reference in this workspace moves onto the
                latest version, including references to documents nobody has
                linked here.
            </Text>
        );
    }

    return (
        <Stack gap={4}>
            <Text size="sm">
                References to these documents will move onto their latest
                versions:
            </Text>
            <List size="sm" c={StatusColor.DIMMED}>
                {sources.map((name) => (
                    <List.Item key={name}>{name}</List.Item>
                ))}
            </List>
        </Stack>
    );
}
