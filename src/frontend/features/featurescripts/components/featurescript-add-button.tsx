import { Button, Tooltip } from "@mantine/core";
import { PlusIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { RowActionButton } from "../../../components/row-action-button";
import { m } from "../../../paraglide/messages";
import { useAddAvailability, useAddFeatureScriptMutation } from "../queries";

interface FeatureScriptAddButtonProps {
    feature: FeatureScriptOut;
    /** The popup's filled button, rather than a row's outlined one. */
    primary?: boolean;
    /** After the add is sent, as the popup closes to show Onshape's dialog. */
    onAdd?: () => void;
}

/** Nothing standalone; disabled with why in an assembly. */
export function FeatureScriptAddButton(
    props: FeatureScriptAddButtonProps
): ReactNode {
    const { feature, primary = false, onAdd } = props;
    const add = useAddFeatureScriptMutation(feature);
    const availability = useAddAvailability();

    if (!availability.offered) {
        return null;
    }
    const { disabledReason } = availability;
    const addNow = () => {
        add.mutate();
        onAdd?.();
    };

    if (!primary) {
        return (
            <RowActionButton
                label={m.featureScriptsAddShort()}
                icon={<PlusIcon />}
                loading={add.isPending}
                disabledReason={disabledReason}
                onClick={addNow}
            />
        );
    }
    return (
        <Tooltip label={disabledReason} disabled={!disabledReason}>
            {/* As RowActionButton does, so the tip still gets a hover. */}
            <Button
                variant="filled"
                leftSection={<PlusIcon />}
                loading={add.isPending}
                data-disabled={disabledReason !== undefined || undefined}
                onClick={() => {
                    if (!disabledReason) addNow();
                }}
            >
                {m.featureScriptsAdd()}
            </Button>
        </Tooltip>
    );
}
