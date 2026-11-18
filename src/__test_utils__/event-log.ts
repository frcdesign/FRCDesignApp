import { vi } from "vitest";
import * as eventLog from "../backend/features/analytics/event-log";
import { type LoggedEvent } from "../backend/features/analytics/schema";

const logged: LoggedEvent[] = [];

/** What tracking sent to the event log in this test, oldest first. */
export function loggedEvents(): LoggedEvent[] {
    return logged;
}

/** Before each worker test: no stream is bound there, so sends are kept here instead. */
export function captureEventLog(): void {
    logged.length = 0;
    vi.spyOn(eventLog, "logEvents").mockImplementation((_env, events) => {
        logged.push(...events);
        return Promise.resolve();
    });
}
