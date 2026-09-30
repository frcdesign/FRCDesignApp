/** "1 tab", "2 tabs". */
export function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
