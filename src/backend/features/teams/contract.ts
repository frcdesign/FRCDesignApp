/** What the frontend shares with the teams feature: a leaf, so it lands in the client bundle alone. */
import { Program } from "../analytics/seasons";
import { AppFeature } from "../analytics/usage";
import { Vendor } from "../library/vendors";
import { type Histogram } from "../analytics/histogram";

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

/** How Vendor lists and Auto Assembly treat the Generic vendor, which sells every standard length without part numbers. */
export enum GenericVendorPolicy {
    /** Always Generic; the vendor inputs are hidden. */
    REQUIRE = "require",
    /** Generic until somebody picks another. */
    PREFER = "prefer",
    /** The vendor ranking decides, as for any vendor. */
    ANY = "any",
    /** The best-ranked other vendor until somebody picks Generic. */
    AVOID = "avoid",
    /** Never Generic; it is left out of the vendor inputs. */
    BAN = "ban"
}

/** What the current team asks of vendors; `NO_PREFERENCES` off a team. */
export interface VendorPreferences {
    ranking: Vendor[];
    generic: GenericVendorPolicy;
}

export const NO_PREFERENCES: VendorPreferences = {
    ranking: [],
    generic: GenericVendorPolicy.ANY
};

export function toVendorPreferences(
    settings: TeamSettings | undefined
): VendorPreferences {
    return settings
        ? { ranking: settings.vendorRanking, generic: settings.genericVendor }
        : NO_PREFERENCES;
}

/** An Onshape team's member, as a registration keeps it. */
export interface SubteamMember {
    userId: string;
    /** Administers the Onshape team, which makes them the team's admin. */
    admin: boolean;
}

/** A membership no launch has proven again in this long lapses. */
export const MEMBERSHIP_DAYS = 90;

/** How long a role or a subteam's members are trusted before a launch asks Onshape again. */
export const ONSHAPE_RECHECK_HOURS = 24;

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

/** A color a team offers, under the name its people know it by. */
export interface TeamColor {
    name: string;
    /** `#rrggbb`. */
    hex: string;
}

export const MAX_COLOR_NAME_LENGTH = 30;

/** How someone joined: by Onshape (a launch or registration), or by an admin's invite link. */
export enum MembershipSource {
    ONSHAPE = "onshape",
    INVITE = "invite"
}

/** How long an invite link works. */
export const INVITE_DAYS = 7;

/** `POST /api/teams/:teamId/invites`. */
export interface TeamInviteOut {
    token: string;
    /** Milliseconds since the epoch. */
    expiresAt: number;
}

export interface TeamSettings {
    /** Whether members, not only admins, may add, order and remove team favorites. */
    membersEditFavorites: boolean;
    /** Most preferred first; a vendor left out ranks after every listed one. */
    vendorRanking: Vendor[];
    /** In the order offered. At most `MAX_TEAM_COLORS`. */
    colors: TeamColor[];
    genericVendor: GenericVendorPolicy;
}

export const DEFAULT_TEAM_SETTINGS: TeamSettings = {
    membersEditFavorites: false,
    vendorRanking: [],
    colors: [],
    genericVendor: GenericVendorPolicy.ANY
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
    /** Whether the caller administers it, as Onshape said within a day; undefined when it wouldn't say. */
    isAdmin?: boolean;
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

/** What a team admin sees and manages. Members are counted, never listed. */
export interface TeamAdminOut {
    organizations: TeamOrganizationOut[];
    /** Members proven within `MEMBERSHIP_DAYS`. */
    memberCount: number;
    adminCount: number;
}

/** What a team is ranked in: every use, and each feature's. */
export type TeamCategory = typeof ALL_USES | AppFeature;

export const ALL_USES = "uses";

/** Lists one person keeps for themselves aren't something a team does better or worse. */
const UNRANKED_FEATURES: readonly AppFeature[] = [
    AppFeature.FAVORITES,
    AppFeature.RECENTS,
    AppFeature.TEAM_FAVORITES,
    AppFeature.TEAM_RECENTS
];

export const TEAM_CATEGORIES: TeamCategory[] = [
    ALL_USES,
    ...Object.values(AppFeature).filter(
        (feature) => !UNRANKED_FEATURES.includes(feature)
    )
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
        /** Every ranked team's uses per member, binned; no bin names a team. */
        distribution: Histogram;
        /** This team's bin in `distribution`. */
        teamBin: number;
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
