/** Kept out of the component files, so those export only components for React Refresh. */
import { type ElementPath } from "@backend/lib/onshape/path";
import { AppModalBody } from "../../components/app-modal";
import { openAppModal } from "../../components/open-app-modal";
import { JobDetails, JobDetailsTitle } from "./components/job-details";

/** How the run this assembly last started is going, or went. */
export function openJobDetails(assembly: ElementPath): void {
    openAppModal({
        title: <JobDetailsTitle assembly={assembly} />,
        children: (
            <AppModalBody>
                <JobDetails assembly={assembly} />
            </AppModalBody>
        )
    });
}
