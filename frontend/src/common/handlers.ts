import { Dispatch, FormEvent } from "react";

/** Event handler that exposes the target element's value as a boolean. */
export function handleBooleanChange(handler: Dispatch<boolean>) {
    return (event: FormEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).checked);
}

/** Event handler that exposes the target element's value as a string. */
export function handleStringChange(handler: Dispatch<string>) {
    return (event: FormEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).value);
}

/** Event handler that exposes the target element's value as a string. */
export function handleValueChange<T>(handler: Dispatch<T>) {
    return (event: FormEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).value as T);
}
