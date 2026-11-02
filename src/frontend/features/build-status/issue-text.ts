import {
    type BuildIssue,
    BuildIssueType
} from "@backend/features/build-checker/issues";
import {
    AUTO_INDEX_THRESHOLD,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "@backend/features/configurations/combinations";
import { m } from "../../paraglide/messages";

/** What is wrong, in a line. */
export function getIssueTitle(issue: BuildIssue): string {
    switch (issue.type) {
        case BuildIssueType.THUMBNAIL_FAILED:
            return m.buildIssueThumbnailFailed();
        case BuildIssueType.NO_THUMBNAIL_TAB:
            return m.buildIssueNoThumbnailTab();
        case BuildIssueType.NO_VENDORS:
            return m.buildIssueNoVendors();
        case BuildIssueType.NO_PARTS:
            return m.buildIssueNoParts();
        case BuildIssueType.NO_UNHIDDEN_INSERTABLES:
            return m.buildIssueNoUnhiddenInsertables();
        case BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED:
            return m.buildIssueConfigurationLimitExceeded();
        case BuildIssueType.MANUAL_INDEXING_REQUIRED:
            return m.buildIssueManualIndexingRequired();
        case BuildIssueType.MULTIPLE_PARTS:
            return m.buildIssueMultipleParts();
        case BuildIssueType.CONFIGURATION_MULTIPLE_PARTS:
            return m.buildIssueConfigurationMultipleParts({
                count: issue.configurationCount
            });
        case BuildIssueType.UNSTABLE_COMPOSITE:
            return m.buildIssueUnstableComposite({
                count: issue.configurationCount
            });
        case BuildIssueType.UNSTABLE_MATE_CONNECTOR:
            return m.buildIssueUnstableMateConnector();
        case BuildIssueType.INSERTABLES_FAILED:
            return m.buildIssueInsertablesFailed();
        case BuildIssueType.LOAD_FAILED:
            return m.buildIssueLoadFailed();
        case BuildIssueType.NOT_LOADED:
            return m.buildIssueNotLoaded();
    }
}

/** The fix or reason, only where knowing Onshape doesn't make it plain. */
export function getIssueDescription(issue: BuildIssue): string | undefined {
    switch (issue.type) {
        case BuildIssueType.THUMBNAIL_FAILED:
            return m.buildIssueThumbnailFailedHelp();
        case BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED:
            return m.buildIssueConfigurationLimitExceededHelp({
                max: MAX_PART_NUMBER_CONFIGURATIONS
            });
        case BuildIssueType.MANUAL_INDEXING_REQUIRED:
            return m.buildIssueManualIndexingRequiredHelp({
                threshold: AUTO_INDEX_THRESHOLD
            });
        case BuildIssueType.UNSTABLE_COMPOSITE:
            return m.buildIssueUnstableCompositeHelp();
        case BuildIssueType.UNSTABLE_MATE_CONNECTOR:
            return m.buildIssueUnstableMateConnectorHelp();
        case BuildIssueType.NOT_LOADED:
            return m.buildIssueNotLoadedHelp();
        default:
            return undefined;
    }
}
