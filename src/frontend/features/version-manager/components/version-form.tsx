import { Button, Group, TextInput, Textarea } from "@mantine/core";
import { useState, type ReactNode } from "react";
import {
    MAX_VERSION_NAME_LENGTH,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { useSelectAllOnFocus } from "../../../lib/select-all";
import { useNextVersionNameQuery } from "../queries";

export interface VersionFields {
    /** Undefined while it is the suggestion, so each document a run versions is numbered from its own history. */
    name?: string;
    description: string;
}

interface VersionFormProps {
    /** The workspace whose next version name the field suggests. */
    versioned: WorkspacePath;
    submitLabel: string;
    submitIcon: ReactNode;
    isPending: boolean;
    disabled: boolean;
    onSubmit: (fields: VersionFields) => void;
    /** The run's own options, beside the submit button as the insert menu's fasten is. */
    options?: ReactNode;
}

/** What a push or a pull asks before it runs: what to call the version it cuts. */
export function VersionForm(props: VersionFormProps): ReactNode {
    const {
        versioned,
        submitLabel,
        submitIcon,
        isPending,
        disabled,
        onSubmit,
        options
    } = props;
    // Undefined until edited, so the field shows the suggestion once it arrives.
    const [edited, setEdited] = useState<string>();
    const [description, setDescription] = useState("");
    const suggested = useNextVersionNameQuery(versioned);
    const selectAll = useSelectAllOnFocus();
    const suggestion = suggested.data?.name;
    const name = edited ?? suggestion ?? "";

    return (
        <>
            <AppModalBody>
                <TextInput
                    label="Version name"
                    required
                    placeholder={
                        suggested.isPending
                            ? "Reading the document's versions..."
                            : undefined
                    }
                    maxLength={MAX_VERSION_NAME_LENGTH}
                    value={name}
                    {...selectAll}
                    onChange={(event) => setEdited(event.currentTarget.value)}
                    data-autofocus
                />
                <Textarea
                    label="Description"
                    placeholder="Optional"
                    autosize
                    minRows={2}
                    maxRows={5}
                    value={description}
                    {...selectAll}
                    onChange={(event) =>
                        setDescription(event.currentTarget.value)
                    }
                />
            </AppModalBody>
            <AppModalFooter>
                <Group gap="sm" ml="auto">
                    {options}
                    <Button
                        rightSection={submitIcon}
                        loading={isPending}
                        disabled={disabled || name.trim() === ""}
                        onClick={() =>
                            onSubmit({
                                name: name === suggestion ? undefined : name,
                                description: description.trim()
                            })
                        }
                    >
                        {submitLabel}
                    </Button>
                </Group>
            </AppModalFooter>
        </>
    );
}
