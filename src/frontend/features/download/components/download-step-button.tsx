import { ReactNode } from "react";
import { Button } from "@mantine/core";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { type InsertableOut } from "@backend/features/library/contract";
import { type PartialSelection } from "@backend/features/configurations/contract";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { useAccessData } from "../../auth/access-level";
import { startSignIn } from "../../auth/sign-in";
import { useIsFetchingConfiguration } from "../../insert/queries";
import { useStepExportMutation } from "../queries";
import { m } from "../../../paraglide/messages";

interface DownloadStepButtonProps {
    insertable: InsertableOut;
    selection?: PartialSelection;
}

/** Standalone only: inside Onshape the part is inserted, and Onshape exports it. */
export function DownloadStepButton(props: DownloadStepButtonProps): ReactNode {
    const { insertable, selection } = props;
    const isConnected = useIsConnectedToOnshape();
    const { signedIn, isPending } = useAccessData();
    const exportMutation = useStepExportMutation(insertable, selection);
    const isLoadingConfiguration = useIsFetchingConfiguration(
        insertable.id,
        insertable.microversionId
    );

    if (isConnected || isPending) {
        return null;
    }

    // The export runs as the caller, since Onshape refuses an unsigned one.
    if (!signedIn) {
        return (
            <Button
                variant="filled"
                leftSection={<DownloadSimpleIcon />}
                onClick={startSignIn}
            >
                {m.downloadStepSignIn()}
            </Button>
        );
    }

    return (
        <Button
            variant="filled"
            leftSection={<DownloadSimpleIcon />}
            loading={isLoadingConfiguration || exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
        >
            {m.downloadStepButton()}
        </Button>
    );
}
