import { Button, Group, TextInput, Textarea } from "@mantine/core";
import { useState, type ReactNode } from "react";
import {
    MAX_VERSION_NAME_LENGTH,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { useNextVersionNameQuery } from "../queries";

export interface VersionFields {
    /** Empty unless typed, so each document a run versions is numbered from its own history. */
    name: string;
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
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const suggested = useNextVersionNameQuery(versioned);

    return (
        <>
            <AppModalBody>
                <TextInput
                    label="Version name"
                    placeholder={
                        suggested.isPending
                            ? "Reading the document's versions..."
                            : suggested.data?.name
                    }
                    maxLength={MAX_VERSION_NAME_LENGTH}
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
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
                <Group gap="sm" ml="auto">
                    {options}
                    <Button
                        rightSection={submitIcon}
                        loading={isPending}
                        disabled={disabled}
                        onClick={() =>
                            onSubmit({ name, description: description.trim() })
                        }
                    >
                        {submitLabel}
                    </Button>
                </Group>
            </AppModalFooter>
        </>
    );
}
