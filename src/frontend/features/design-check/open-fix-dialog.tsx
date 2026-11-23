import { openAppModal } from "../../components/open-app-modal";
import { type TargetElement } from "../../lib/onshape-launch";
import { m } from "../../paraglide/messages";
import { FixDialog } from "./components/fix-dialog";
import { type PlannedFix } from "./fixes";

export function openFixDialog(
    target: TargetElement,
    fixes: PlannedFix[]
): void {
    openAppModal({
        title: m.designCheckFixTitle(),
        children: <FixDialog target={target} fixes={fixes} />
    });
}
