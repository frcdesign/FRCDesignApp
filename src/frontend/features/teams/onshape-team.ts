/** An Onshape team's id, from its url or as pasted. */
export function parseOnshapeTeamId(input: string): string | undefined {
    const match = /[0-9a-f]{24}/i.exec(input);
    return match?.[0].toLowerCase();
}
