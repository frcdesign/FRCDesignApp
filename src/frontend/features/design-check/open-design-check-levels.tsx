import { AppModalBody } from "../../components/app-modal";
import { openAppModal } from "../../components/open-app-modal";
import { m } from "../../paraglide/messages";
import { DesignCheckLevels } from "./components/design-check-levels";

export function openDesignCheckLevels(): void {
    openAppModal({
        title: m.designCheckLevelsTitle(),
        children: (
            <AppModalBody>
                <DesignCheckLevels />
            </AppModalBody>
        )
    });
}
