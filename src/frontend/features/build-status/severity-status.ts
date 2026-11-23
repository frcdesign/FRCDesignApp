import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import { Status } from "../../lib/status";

/** The status a severity is drawn as; none is a build with nothing to say. */
export function severityStatus(severity?: BuildIssueSeverity): Status {
    switch (severity) {
        case BuildIssueSeverity.ERROR:
            return Status.ERROR;
        case BuildIssueSeverity.WARNING:
            return Status.WARNING;
        case BuildIssueSeverity.INFO:
            return Status.INFO;
        case undefined:
            return Status.SUCCESS;
    }
}
