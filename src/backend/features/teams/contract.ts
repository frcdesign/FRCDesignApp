/** What the frontend shares with the teams feature: a leaf, so it lands in the client bundle alone. */
import { Program } from "../analytics/seasons";
import { AppFeature } from "../analytics/usage";
import { Vendor } from "../library/vendors";

export { Program };

export enum TeamRole {
    ADMIN = "admin",
    MEMBER = "member"
}

/** Which kind of Onshape company an organization is; see ONSHAPE.md. */
export enum OrganizationKind {
    ENTERPRISE = "enterprise",
    CLASSROOM = "classroom"
}

/** Why a use is credited to the team it is. */
export enum TeamContextSource {
    /** The document's organization registered the team, and the user is its member. */
    DOCUMENT = "document",
    /** The user's choice, for a document no team of theirs owns, or no document. */
    CHOSEN = "chosen"
}

/** Who chose Personal: their uses count toward no team until they choose one. */
export const PERSONAL = "personal";

export const MAX_TEAM_COLORS = 6;
/** Low enough that reordering stays one batch, as a user's favorites are. */
export const MAX_TEAM_FAVORITES = 250;
export const MAX_TEAM_RECENTS = 100;

/** A team as FIRST lists it. */
export interface FirstTeam {
    program: Program;
    number: number;
    /** FIRST's short name, such as "The Cheesy Poofs". */
    name: string;
    city?: string;
    stateProvince?: string;
    country?: string;
}

export interface TeamSettings {
    /** Whether members, not only admins, may add, order and remove team favorites. */
    membersEditFavorites: boolean;
    /** Most preferred first; a vendor left out ranks after every listed one. */
    vendorRanking: Vendor[];
    /** `#rrggbb`, in the order offered. At most `MAX_TEAM_COLORS`. */
    colors: string[];
}

export const DEFAULT_TEAM_SETTINGS: TeamSettings = {
    membersEditFavorites: false,
    vendorRanking: [],
    colors: []
};

/** One of the caller's teams. A team is its own id: several may claim one FIRST number. */
export interface MyTeam {
    id: string;
    first: FirstTeam;
    role: TeamRole;
    settings: TeamSettings;
}

/** The organization that owns the launch's document, as the server knows it. */
export interface DocumentOrganization {
    companyId: string;
    kind: OrganizationKind;
    /** Undefined until somebody registers it, which asks Onshape for its name. */
    name?: string;
    /** The teams it registered, the caller's or not. */
    teams: { id: string; first: FirstTeam }[];
}

/** `GET /api/teams/context`: everything the app shows about teams. */
export interface TeamContextOut {
    teams: MyTeam[];
    /** The team uses are credited to now; undefined for none. */
    current?: { teamId: string; source: TeamContextSource };
    /** A team id or `PERSONAL`: the caller's choice for documents no team of theirs owns. Undefined for the default. */
    chosen?: string;
    /** Set when the document belongs to a company; undefined for a personal one or none. */
    organization?: DocumentOrganization;
}

export interface RegisterTeamIn {
    /** The launch's document, whose owner is the organization registered. */
    documentId: string;
    /** An Onshape team in the organization, whose members alone join; omitted for every editor. */
    subteamId?: string;
    /** A FIRST team, for a new team; omitted with `teamId`. */
    first?: { program: Program; number: number };
    /** One of the caller's teams the organization joins, as its admin. */
    teamId?: string;
}

export interface TeamOrganizationOut {
    id: string;
    companyId: string;
    kind: OrganizationKind;
    name: string;
    /** The Onshape team whose members join; undefined for every editor. */
    subteamId?: string;
    /** How many of the subteam's members were last synced. */
    subteamMemberCount?: number;
}

export interface TeamMemberOut {
    userId: string;
    role: TeamRole;
    /** Milliseconds since the epoch. */
    lastSeenAt: number;
}

/** What a team admin sees and manages. */
export interface TeamAdminOut {
    organizations: TeamOrganizationOut[];
    members: TeamMemberOut[];
}

/** What a team is ranked in: every use, and each feature's. */
export type TeamCategory = typeof ALL_USES | AppFeature;

export const ALL_USES = "uses";

export const TEAM_CATEGORIES: TeamCategory[] = [
    ALL_USES,
    ...Object.values(AppFeature)
];

/** A ranking means nothing among fewer teams, and would point at one. */
export const MIN_RANKED_TEAMS = 10;

export enum Medal {
    GOLD = "gold",
    SILVER = "silver",
    BRONZE = "bronze"
}

/** One category's standing; the other teams stay anonymous. */
export interface TeamStanding {
    category: TeamCategory;
    uses: number;
    /** Over the team's active members this year. */
    usesPerMember: number;
    /** Undefined while fewer than `MIN_RANKED_TEAMS` used the category this year. */
    ranking?: {
        /** "Top 4%": the share of ranked teams at or above this team, rounded up. */
        topPercent: number;
        medal?: Medal;
    };
}

export interface TeamReportOut {
    first: FirstTeam;
    /** "2026–27": September to August, which spans either program's season. */
    year: string;
    activeMembers: number;
    standings: TeamStanding[];
}

export function teamLabel(first: FirstTeam): string {
    return `${first.program} ${first.number} ${first.name}`;
}
