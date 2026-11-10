import {
    type DesignIssue,
    DesignIssueType
} from "@backend/features/design-check/contract";
import { m } from "../../paraglide/messages";

/** What the issue is, as a heading; a type without one fails tsc. */
export function getDesignIssueName(type: DesignIssueType): string {
    switch (type) {
        case DesignIssueType.SKETCH_UNDERDEFINED:
            return m.designCheckSketchUnderdefined();
        case DesignIssueType.SKETCH_OVERDEFINED:
            return m.designCheckSketchOverdefined();
        case DesignIssueType.ORIGIN_CUBE_MISSING:
            return m.designCheckOriginCubeMissing();
        case DesignIssueType.ORIGIN_CUBE_NOT_FIRST:
            return m.designCheckOriginCubeNotFirst();
        case DesignIssueType.ORIGIN_CUBE_SUPPRESSED:
            return m.designCheckOriginCubeSuppressed();
        case DesignIssueType.FEATURE_ERROR:
            return m.designCheckFeatureError();
        case DesignIssueType.FEATURE_WARNING:
            return m.designCheckFeatureWarning();
        case DesignIssueType.FEATURE_SUPPRESSED:
            return m.designCheckFeatureSuppressed();
        case DesignIssueType.ROLLBACK_NOT_AT_END:
            return m.designCheckRollbackNotAtEnd();
        case DesignIssueType.PART_NO_MATERIAL:
            return m.designCheckPartNoMaterial();
        case DesignIssueType.PART_NO_PART_NUMBER:
            return m.designCheckPartNoPartNumber();
        case DesignIssueType.PART_NO_DESCRIPTION:
            return m.designCheckPartNoDescription();
        case DesignIssueType.INSTANCE_FIXED:
            return m.designCheckInstanceFixed();
        case DesignIssueType.INSTANCE_FLOATING:
            return m.designCheckInstanceFloating();
        case DesignIssueType.INSTANCE_BROKEN:
            return m.designCheckInstanceBroken();
    }
}

/** What to do about it, from the first issue of its type, which carries any count. */
export function getDesignIssueHelp(issue: DesignIssue): string {
    const count = issue.count ?? 0;
    switch (issue.type) {
        case DesignIssueType.SKETCH_UNDERDEFINED:
            return m.designCheckSketchUnderdefinedHelp();
        case DesignIssueType.SKETCH_OVERDEFINED:
            return m.designCheckSketchOverdefinedHelp();
        case DesignIssueType.ORIGIN_CUBE_MISSING:
            return m.designCheckOriginCubeMissingHelp();
        case DesignIssueType.ORIGIN_CUBE_NOT_FIRST:
            return m.designCheckOriginCubeNotFirstHelp({ position: count });
        case DesignIssueType.ORIGIN_CUBE_SUPPRESSED:
            return m.designCheckOriginCubeSuppressedHelp();
        case DesignIssueType.FEATURE_ERROR:
            return m.designCheckFeatureErrorHelp();
        case DesignIssueType.FEATURE_WARNING:
            return m.designCheckFeatureWarningHelp();
        case DesignIssueType.FEATURE_SUPPRESSED:
            return m.designCheckFeatureSuppressedHelp();
        case DesignIssueType.ROLLBACK_NOT_AT_END:
            return m.designCheckRollbackNotAtEndHelp({ count });
        case DesignIssueType.PART_NO_MATERIAL:
            return m.designCheckPartNoMaterialHelp();
        case DesignIssueType.PART_NO_PART_NUMBER:
            return m.designCheckPartNoPartNumberHelp();
        case DesignIssueType.PART_NO_DESCRIPTION:
            return m.designCheckPartNoDescriptionHelp();
        case DesignIssueType.INSTANCE_FIXED:
            return m.designCheckInstanceFixedHelp();
        case DesignIssueType.INSTANCE_FLOATING:
            return m.designCheckInstanceFloatingHelp();
        case DesignIssueType.INSTANCE_BROKEN:
            return m.designCheckInstanceBrokenHelp();
    }
}
