import { ScrewdriverIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { ElementType } from "@backend/lib/onshape/element-type";
import { FastenerKind } from "@backend/features/auto-assembly/studios";
import { Callout, CalloutButton } from "../../../components/callout";
import { UtilityTab } from "../../../lib/app-tab";
import { useTargetElement } from "../../../lib/onshape-params";
import { IconSize } from "../../../lib/style-constants";
import { useNavigateToTab } from "../../../lib/tabs";
import { m } from "../../../paraglide/messages";
import { useFastenerSetQuery } from "../queries";

function alsoAvailable(kind: FastenerKind): string {
    switch (kind) {
        case FastenerKind.SCREW:
            return m.autoAssemblyScrewsAvailable();
        case FastenerKind.WASHER:
            return m.autoAssemblyWashersAvailable();
        case FastenerKind.NUT:
            return m.autoAssemblyNutsAvailable();
    }
}

interface AutoAssemblyCalloutProps {
    insertableId: string;
    /** Before switching to Auto Assembly, as a menu closes itself. */
    onOpen: () => void;
}

/** Points a library screw, washer or nut being inserted into an assembly at Auto Assembly, which places them for every hole. */
export function AutoAssemblyCallout(
    props: AutoAssemblyCalloutProps
): ReactNode {
    const { insertableId, onOpen } = props;
    const { data: set } = useFastenerSetQuery();
    const target = useTargetElement();
    const navigateToTab = useNavigateToTab();

    const kind =
        set &&
        Object.values(FastenerKind).find(
            (each) => set.studios[each].insertableId === insertableId
        );
    if (!kind || target?.elementType !== ElementType.ASSEMBLY) {
        return null;
    }

    return (
        <Callout
            text={alsoAvailable(kind)}
            action={
                <CalloutButton
                    icon={<ScrewdriverIcon size={IconSize.SMALL} />}
                    onClick={() => {
                        onOpen();
                        navigateToTab(UtilityTab.AUTO_ASSEMBLY);
                    }}
                >
                    {m.autoAssemblyOpen()}
                </CalloutButton>
            }
        />
    );
}
