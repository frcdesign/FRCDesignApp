import { TextInput } from "@mantine/core";
import { type FocusEvent, type ReactNode, useId } from "react";
import { AccessLevel } from "@backend/features/auth/access-level";
import { InputRow } from "../../../components/input-row";
import { SETTING_CONTROL_WIDTH } from "../../../lib/style-constants";
import { useAccessData } from "../../auth/access-level";
import { useAdminTeamQuery, useSetAdminTeamMutation } from "../queries";

/** The Onshape team whose members edit this library; only the owner sets it. */
export function AdminTeamSetting(): ReactNode {
    const { currentAccessLevel } = useAccessData();
    const query = useAdminTeamQuery();
    const mutation = useSetAdminTeamMutation();
    const id = useId();
    const isOwner = currentAccessLevel === AccessLevel.OWNER;
    const stored = query.data?.teamId ?? "";

    const save = (event: FocusEvent<HTMLInputElement>) => {
        const teamId = event.currentTarget.value.trim();
        if (teamId !== stored) {
            mutation.mutate(teamId || null);
        }
    };

    return (
        <InputRow label="Admin team id" htmlFor={id}>
            <TextInput
                // Keyed so a saved or refetched team replaces what was typed.
                key={stored}
                id={id}
                w={SETTING_CONTROL_WIDTH}
                defaultValue={stored}
                placeholder="None"
                readOnly={!isOwner}
                disabled={query.isPending || mutation.isPending}
                onBlur={isOwner ? save : undefined}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
            />
        </InputRow>
    );
}
