import { Button } from "@mantine/core";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { m } from "../../../paraglide/messages";
import { useReloadFeatureScriptsMutation } from "../queries";

/** The owner's: loads the latest version of the frontend document. */
export function FeatureScriptsReloadButton(): ReactNode {
    const reload = useReloadFeatureScriptsMutation();
    return (
        <Button
            leftSection={<ArrowsClockwiseIcon />}
            onClick={() => reload.mutate()}
            loading={reload.isPending}
        >
            {m.featureScriptsReload()}
        </Button>
    );
}
