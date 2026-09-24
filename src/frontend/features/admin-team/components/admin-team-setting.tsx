import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { type ReactNode, useId, useState } from "react";
import { useAdminTeamQuery, useSetAdminTeamMutation } from "../queries";

/**
 * The owner's choice of the Onshape team that may edit this library. Its
 * members, and changes to them, are what give anyone else editor access.
 */
export function AdminTeamSetting(): ReactNode {
    const query = useAdminTeamQuery();
    const mutation = useSetAdminTeamMutation();
    const inputId = useId();
    // Null until edited, so the stored team shows once it has loaded.
    const [draft, setDraft] = useState<string | null>(null);

    const stored = query.data?.teamId ?? "";
    const value = draft ?? stored;
    const trimmed = value.trim();

    const save = () => {
        mutation.mutate(trimmed || null, {
            onSuccess: () => setDraft(null)
        });
    };

    return (
        <Stack gap={4}>
            <Group gap="sm" wrap="nowrap" align="flex-end">
                <TextInput
                    id={inputId}
                    label="Admin team id"
                    placeholder="None: only you can edit"
                    value={value}
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    disabled={query.isPending}
                    flex={1}
                />
                <Button
                    variant="light"
                    onClick={save}
                    loading={mutation.isPending}
                    disabled={trimmed === stored}
                >
                    Save
                </Button>
            </Group>
            {query.data?.teamId && (
                <Text size="xs" c="dimmed">
                    {query.data.memberCount} members can edit this library.
                </Text>
            )}
        </Stack>
    );
}
