import { LinkDirection } from "@backend/features/version-manager/contract";
import { showTipToast } from "../../lib/notifications";
import { m } from "../../paraglide/messages";

/** After a recursive run from the form, which the link's menu starts in one click under the same defaults. */
export function showQuickRecursiveTip(direction: LinkDirection): void {
    showTipToast(
        direction === LinkDirection.CHILD
            ? m.versionManagerQuickRecursivePushTip()
            : m.versionManagerQuickRecursivePullTip(),
        "quick-recursive-tip"
    );
}
