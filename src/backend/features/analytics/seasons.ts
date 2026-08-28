import { LibraryId } from "../library/library-id";

/**
 * Competition seasons, which is what makes usage here comparable at all.
 *
 * A library built for a Jan–Apr competition has a year that looks nothing like
 * a calendar one, so growth is measured season over season and the charts are
 * banded to show why the shape is what it is.
 *
 * Pure date maths on `YYYY-MM-DD` keys, no Worker imports, so the dashboard can
 * import it through `@backend/*` without pulling the Worker into the bundle.
 */
export enum Program {
    FRC = "frc",
    FTC = "ftc"
}

/** Which competition each library serves. */
export const LIBRARY_PROGRAM: Record<LibraryId, Program> = {
    [LibraryId.FRC_DESIGN_LIB]: Program.FRC,
    [LibraryId.MKCAD]: Program.FRC,
    [LibraryId.FTC_DESIGN_LIB]: Program.FTC
};

/**
 * Month a season opens and the month it closes, both inclusive. FTC opens
 * before New Year and closes after it, so its span covers two calendar years.
 */
const SPANS: Record<Program, { startMonth: number; endMonth: number }> = {
    [Program.FRC]: { startMonth: 1, endMonth: 4 },
    [Program.FTC]: { startMonth: 9, endMonth: 4 }
};

export interface Season {
    program: Program;
    /** Inclusive day keys. */
    from: string;
    to: string;
    /**
     * The year the season ends in, which is how both programs name themselves:
     * FTC's Sept 2026 – Apr 2027 is the 2027 season, as is FRC's Jan–Apr 2027.
     */
    year: number;
    /** "2027" or "2026–27" — the season named without naming a program. */
    years: string;
    /** "FRC 2027" or "FTC 2026–27". */
    label: string;
}

function pad(value: number): string {
    return value.toString().padStart(2, "0");
}

/** Last day of a month, so a season's end never lands on the 31st of April. */
function endOfMonth(year: number, month: number): string {
    const next = new Date(Date.UTC(year, month, 1));
    next.setUTCDate(next.getUTCDate() - 1);
    return next.toISOString().slice(0, 10);
}

/** The season of the given program that ends in `year`. */
export function seasonOf(program: Program, year: number): Season {
    const { startMonth, endMonth } = SPANS[program];
    // A start month after the end month means the season opened last year.
    const startYear = startMonth > endMonth ? year - 1 : year;
    const years =
        startYear === year ? `${year}` : `${startYear}–${pad(year % 100)}`;
    return {
        program,
        from: `${startYear}-${pad(startMonth)}-01`,
        to: endOfMonth(year, endMonth),
        year,
        years,
        label: `${program.toUpperCase()} ${years}`
    };
}

/**
 * The day the season culminates, for a chart marker.
 *
 * Both programs finish at the same event, so a season year has one of these.
 * The real date moves every year within the second half of April; this is an
 * approximation, which is all a chart bucketed by week or month can show.
 */
export function championshipOf(season: Season): string {
    return `${season.year}-04-20`;
}

/** The season containing `day`, or null when the day is between seasons. */
export function currentSeason(program: Program, day: string): Season | null {
    const year = Number(day.slice(0, 4));
    // A day in January belongs to a season that opened the previous year, so
    // both candidates have to be tried.
    for (const candidate of [
        seasonOf(program, year),
        seasonOf(program, year + 1)
    ]) {
        if (day >= candidate.from && day <= candidate.to) return candidate;
    }
    return null;
}

export function previousSeason(season: Season): Season {
    return seasonOf(season.program, season.year - 1);
}

/** The most recent season that has already finished on `day`. */
export function lastCompleteSeason(program: Program, day: string): Season {
    const year = Number(day.slice(0, 4));
    for (const candidate of [
        seasonOf(program, year + 1),
        seasonOf(program, year)
    ]) {
        if (candidate.to < day) return candidate;
    }
    return seasonOf(program, year - 1);
}

export interface SeasonWindow {
    /** The window to measure. */
    from: string;
    to: string;
    season: Season;
    /** Days elapsed, inclusive, so the baseline can be clipped to match. */
    elapsedDays: number;
    /** False when the season has finished and the window is the whole of it. */
    inProgress: boolean;
}

/** Inclusive day count between two keys. */
function daysBetween(from: string, to: string): number {
    const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
    return Math.round(ms / (24 * 3600 * 1000)) + 1;
}

function addDays(day: string, count: number): string {
    const at = Date.parse(`${day}T00:00:00Z`) + count * 24 * 3600 * 1000;
    return new Date(at).toISOString().slice(0, 10);
}

/**
 * The window to report on, and how much of a season it covers.
 *
 * In season that is the season so far; between seasons it is the last complete
 * one, entire — comparing an off-season week against a full season would show
 * a collapse every May that means nothing.
 */
export function seasonWindow(program: Program, day: string): SeasonWindow {
    const current = currentSeason(program, day);
    if (current === null) {
        const season = lastCompleteSeason(program, day);
        return {
            from: season.from,
            to: season.to,
            season,
            elapsedDays: daysBetween(season.from, season.to),
            inProgress: false
        };
    }
    return {
        from: current.from,
        to: day,
        season: current,
        elapsedDays: daysBetween(current.from, day),
        inProgress: true
    };
}

/**
 * The same stretch of the previous season, so a half-finished season is
 * compared against half of the one before rather than all of it.
 */
export function baselineWindow(window: SeasonWindow): {
    from: string;
    to: string;
    season: Season;
} {
    const season = previousSeason(window.season);
    return {
        from: season.from,
        to: window.inProgress
            ? addDays(season.from, window.elapsedDays - 1)
            : season.to,
        season
    };
}

/** Every season of the program that overlaps the range, for chart bands. */
export function seasonsBetween(
    program: Program,
    from: string,
    to: string
): Season[] {
    const seasons: Season[] = [];
    const firstYear = Number(from.slice(0, 4));
    const lastYear = Number(to.slice(0, 4)) + 1;
    for (let year = firstYear; year <= lastYear; year++) {
        const season = seasonOf(program, year);
        if (season.to >= from && season.from <= to) seasons.push(season);
    }
    return seasons;
}
