/**
 * Capitalizes the first letter of a string and lower cases everything else.
 */
export function capitalize(val: string) {
    return val[0].toUpperCase() + val.slice(1).toLowerCase();
}
