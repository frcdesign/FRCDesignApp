import {
    type DesignFixIn,
    type DesignIssue,
    DesignIssueFix,
    type TabCheck
} from "@backend/features/design-check/contract";
import { type TargetElement } from "../../lib/onshape-launch";
import { m } from "../../paraglide/messages";

/** A fix the app can make, as the confirmation lists it. */
export interface PlannedFix {
    /** Unique among a check's fixes. */
    key: string;
    /** What the fix does, as a sentence's start. */
    description: string;
    tabName: string;
    request: DesignFixIn;
}

export function planFix(
    target: TargetElement,
    tab: TabCheck,
    issue: DesignIssue
): PlannedFix | undefined {
    if (!issue.fix) {
        return undefined;
    }
    return {
        key: [tab.elementId, issue.fix, issue.instanceId ?? ""].join(":"),
        description: getFixDescription(issue.fix, issue.subject ?? ""),
        tabName: tab.name,
        request: {
            documentId: target.documentId,
            instanceId: target.instanceId,
            elementId: tab.elementId,
            fix: issue.fix,
            assemblyInstanceId: issue.instanceId
        }
    };
}

/** Every fix in the document, tab by tab. */
export function planFixes(
    target: TargetElement,
    tabs: TabCheck[]
): PlannedFix[] {
    return tabs.flatMap((tab) =>
        tab.issues.flatMap((issue) => {
            const planned = planFix(target, tab, issue);
            return planned ? [planned] : [];
        })
    );
}

/** The button beside the issue. */
export function getFixLabel(fix: DesignIssueFix): string {
    switch (fix) {
        case DesignIssueFix.MOVE_ROLLBACK_TO_END:
            return m.designCheckFixRollbackLabel();
        case DesignIssueFix.DELETE_INSTANCE:
            return m.designCheckFixDeleteLabel();
        case DesignIssueFix.FASTEN_ORIGIN_CUBE:
            return m.designCheckFixFastenLabel();
    }
}

function getFixDescription(fix: DesignIssueFix, subject: string): string {
    switch (fix) {
        case DesignIssueFix.MOVE_ROLLBACK_TO_END:
            return m.designCheckFixRollback();
        case DesignIssueFix.DELETE_INSTANCE:
            return m.designCheckFixDelete({ subject });
        case DesignIssueFix.FASTEN_ORIGIN_CUBE:
            return m.designCheckFixFasten({ subject });
    }
}
