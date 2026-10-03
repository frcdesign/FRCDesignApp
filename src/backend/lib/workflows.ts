/** Statuses of an instance that hasn't finished, one way or the other. */
const ACTIVE_STATUSES = new Set<InstanceStatus["status"]>([
    "queued",
    "running",
    "paused",
    "waiting",
    "waitingForPause"
]);

export function isInstanceActive(status: InstanceStatus["status"]): boolean {
    return ACTIVE_STATUSES.has(status);
}
