import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { type ReactNode, useId, useState } from "react";
import { useAdminTeamQuery, useSetAdminTeamMutation } from "../queries";

/** The team's members get editor access. */
export function AdminTeamSetting(): ReactNode {
    const query = useAdminTeamQuery();
    const mutation = useSetAdminTeamMutation();
    const inputId = useId();
    // Unset until edited, so the stored team shows once it has loaded.
    const [draft, setDraft] = useState<string>();

    const stored = query.data?.teamId ?? "";
    const value = draft ?? stored;
    const trimmed = value.trim();

    const save = () => {
        mutation.mutate(trimmed || null, {
            onSuccess: () => setDraft(undefined)
        });
    };

    return (
        <Stack gap={4}>
            <Group gap="sm" align="flex-end">
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
