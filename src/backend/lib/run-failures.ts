/**
 * A background run's failures, worded once by the step that met them and read
 * back wherever the run reports. Workflows rebuilds an error that leaves a step
 * with the step's name prefixed to its message, so the marker is found anywhere.
 */
import { UNEXPECTED_FAILURE } from "./api-error";
import { describeOnshapeFailure } from "./onshape/failures";

export interface RunFailures {
    /** A message for the user, as the error a step leaves with. */
    word: (message: string) => string;
    /** The worded message, else what Onshape's status says, else the unexpected. */
    describe: (error: unknown) => string;
}

export function runFailures(marker: string): RunFailures {
    return {
        word: (message) => marker + message,
        describe: (error) => {
            if (error instanceof Error) {
                const at = error.message.indexOf(marker);
                if (at !== -1) {
                    return error.message.slice(at + marker.length);
                }
            }
            return describeOnshapeFailure(error) ?? UNEXPECTED_FAILURE;
        }
    };
}
