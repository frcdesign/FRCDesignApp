import { Button, List, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowLineUpIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    MAX_VERSION_NAME_LENGTH,
    type PushScope,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { useNextVersionNameQuery, usePushVersionMutation } from "../queries";

export interface PushVersionFormProps {
    workspace: WorkspacePath;
    /** Decided by whatever opened this; the form only names the version. */
    scope: PushScope;
    /** The children the push reaches, for the line above the button. */
    targets: string[];
    /** Whether it carries on past them, which the list cannot show. */
    recursive: boolean;
    /** Mantine's id for the modal this sits in, so a push can close it. */
    modalId: string;
}

/**
 * Names the version a push cuts. Only reached from a menu: the quick buttons
 * push under the name Onshape's own dialog would give it, and this is for the
 * times the version is worth calling something.
 */
export function PushVersionForm(props: PushVersionFormProps): ReactNode {
    const { workspace, scope, targets, recursive, modalId } = props;
    // Undefined until somebody types: the field then shows the name Onshape is
    // about to be asked for, and what they type replaces it. Derived rather
    // than written into state when the query answers, which would be a state
    // write from an effect.
    const [typedName, setTypedName] = useState<string>();
    const [description, setDescription] = useState("");
    const suggested = useNextVersionNameQuery(workspace);
    const push = usePushVersionMutation(workspace);

    const name = typedName ?? suggested.data?.name ?? "";

    const submit = () => {
        push.mutate(
            { name, description: description.trim(), scope },
            { onSuccess: () => modals.close(modalId) }
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
                <PushTargets targets={targets} recursive={recursive} />
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

interface PushTargetsProps {
    targets: string[];
    recursive: boolean;
}

/** The workspaces the push updates, so the button is not a leap of faith. */
function PushTargets(props: PushTargetsProps): ReactNode {
    const { targets, recursive } = props;

    if (targets.length === 0) {
        return (
            <Text size="sm" c={StatusColor.DIMMED}>
                Nothing is linked as a child, so this only creates a version of
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
                {targets.map((target) => (
                    <List.Item key={target}>{target}</List.Item>
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
