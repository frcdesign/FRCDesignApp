import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
    firstTeams,
    teamMembers,
    teamOrganizations,
    teams
} from "../../db/schema";
import * as Companies from "../../lib/onshape/endpoints/companies";
import * as Documents from "../../lib/onshape/endpoints/documents";
import * as Teams from "../../lib/onshape/endpoints/teams";
import { OnshapePermission } from "../../lib/onshape/endpoints/permissions";
import {
    OnshapeOwnerType,
    type OnshapeDocumentInfo
} from "../../lib/onshape/types";
import {
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    TEST_USER_ID,
    createTestApp,
    jsonRequest,
    seedPartStudio
} from "../../../__test_utils__";
import { dailyTeamMetrics, dailyTeamUsers, events } from "../analytics/schema";
import { recordInserts } from "../analytics/tracking";
import { AppFeature, UseSource } from "../analytics/usage";
import { ElementType } from "../../lib/onshape/element-type";
import {
    ALL_USES,
    GenericVendorPolicy,
    MIN_RANKED_TEAMS,
    PERSONAL,
    Program,
    TeamContextSource,
    TeamRole,
    type TeamContextOut,
    type TeamReportOut
} from "./contract";
import { writeTeamRecentInsert } from "./recents";
import { refreshFirstTeams, upsertTeams } from "./first-teams";
import { toDayKey } from "../analytics/day";
import type { FavoritesData } from "../favorites/contract";
import type { RecentsData } from "../recents/contract";

const db = getDb(env.DB);
const COMPANY = "company-1";
const ORG_DOC = "org-doc";
const PERSONAL_DOC = "personal-doc";

function orgDocument(
    permissionSet: string[] = [OnshapePermission.WRITE],
    id = ORG_DOC,
    companyId = COMPANY
): OnshapeDocumentInfo {
    return {
        id,
        name: "Robot",
        public: false,
        permissionSet,
        owner: {
            id: companyId,
            type: OnshapeOwnerType.COMPANY,
            isEnterpriseOwnedResource: true
        }
    };
}

const personalDocument: OnshapeDocumentInfo = {
    id: PERSONAL_DOC,
    name: "Mine",
    public: false,
    permissionSet: [OnshapePermission.WRITE],
    owner: { id: TEST_USER_ID, type: OnshapeOwnerType.USER }
};

function launch(document: OnshapeDocumentInfo, userId = TEST_USER_ID) {
    vi.spyOn(Documents, "getDocument").mockResolvedValue(document);
    return createTestApp({ userId }).request(
        `/init?documentId=${document.id}`,
        jsonRequest("GET"),
        env
    );
}

async function seedFirst(number = 254, program = Program.FRC) {
    await upsertTeams(db, program, 2027, [
        {
            teamNumber: number,
            nameShort: `Team ${number} name`,
            city: "San Jose"
        }
    ]);
}

/** A team registered straight into D1, as `registerOrganization` would leave it. */
async function seedTeam(
    options: {
        id?: string;
        number?: number;
        companyId?: string;
        subteamId?: string;
        subteamMembers?: string[];
        admins?: string[];
        members?: string[];
    } = {}
): Promise<string> {
    const id = options.id ?? crypto.randomUUID();
    const number = options.number ?? 254;
    await seedFirst(number);
    const now = new Date();
    await db.insert(teams).values({
        id,
        program: Program.FRC,
        number,
        registeredAt: now,
        registeredBy: "someone"
    });
    if (options.companyId) {
        await db.insert(teamOrganizations).values({
            teamId: id,
            companyId: options.companyId,
            kind: "enterprise" as never,
            name: "School",
            subteamId: options.subteamId ?? "",
            subteamMembers: options.subteamMembers ?? [],
            registeredAt: now,
            registeredBy: "someone"
        });
    }
    for (const [role, users] of [
        [TeamRole.ADMIN, options.admins ?? []],
        [TeamRole.MEMBER, options.members ?? []]
    ] as const) {
        for (const userId of users) {
            await db.insert(teamMembers).values({
                teamId: id,
                userId,
                role,
                joinedAt: now,
                lastSeenAt: now
            });
        }
    }
    return id;
}

async function getContext(
    documentId?: string,
    userId = TEST_USER_ID
): Promise<TeamContextOut> {
    const query = documentId ? `?documentId=${documentId}` : "";
    const res = await createTestApp({ userId }).request(
        `/api/teams/context${query}`,
        jsonRequest("GET"),
        env
    );
    expect(res.status).toBe(200);
    return res.json();
}

function choose(teamId: string | undefined, userId = TEST_USER_ID) {
    return createTestApp({ userId }).request(
        "/api/teams/chosen",
        jsonRequest("POST", { teamId }),
        env
    );
}

async function memberIds(teamId: string): Promise<string[]> {
    const rows = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));
    return rows.map((row) => row.userId).sort();
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("membership at launch", () => {
    it("joins every editor of a registered organization", async () => {
        const teamId = await seedTeam({ companyId: COMPANY });
        await launch(orgDocument());
        expect(await memberIds(teamId)).toEqual([TEST_USER_ID]);
    });

    it("doesn't join a caller who can only view the document", async () => {
        const teamId = await seedTeam({ companyId: COMPANY });
        await launch(orgDocument([OnshapePermission.READ]));
        expect(await memberIds(teamId)).toEqual([]);
    });

    it("joins a subteam's team only for its members", async () => {
        const teamId = await seedTeam({
            companyId: COMPANY,
            subteamId: "onshape-team",
            subteamMembers: ["in-subteam"]
        });
        await launch(orgDocument(), "in-subteam");
        await launch(orgDocument(), "outsider");
        expect(await memberIds(teamId)).toEqual(["in-subteam"]);
    });

    it("never changes an admin's role", async () => {
        const teamId = await seedTeam({
            companyId: COMPANY,
            admins: [TEST_USER_ID]
        });
        await launch(orgDocument());
        const row = await db
            .select({ role: teamMembers.role })
            .from(teamMembers)
            .where(eq(teamMembers.teamId, teamId))
            .get();
        expect(row?.role).toBe(TeamRole.ADMIN);
    });
});

describe("team context", () => {
    it("credits an organization's document to its team", async () => {
        const teamId = await seedTeam({ companyId: COMPANY });
        await launch(orgDocument());

        const context = await getContext(ORG_DOC);
        expect(context.current).toEqual({
            teamId,
            source: TeamContextSource.DOCUMENT
        });
        expect(context.organization?.teams.map((team) => team.id)).toEqual([
            teamId
        ]);
    });

    it("keeps the document's team even after choosing Personal", async () => {
        const teamId = await seedTeam({ companyId: COMPANY });
        await launch(orgDocument());
        await choose(PERSONAL);
        expect((await getContext(ORG_DOC)).current?.teamId).toBe(teamId);
    });

    it("credits a personal document to the chosen team, or none for Personal", async () => {
        const first = await seedTeam({ members: [TEST_USER_ID] });
        const second = await seedTeam({
            number: 1678,
            members: [TEST_USER_ID]
        });
        await launch(personalDocument);

        await choose(second);
        expect((await getContext(PERSONAL_DOC)).current).toEqual({
            teamId: second,
            source: TeamContextSource.CHOSEN
        });
        await choose(PERSONAL);
        expect((await getContext(PERSONAL_DOC)).current).toBeUndefined();
        await choose(first);
        expect((await getContext()).current?.teamId).toBe(first);
    });

    it("refuses choosing a team the caller isn't on", async () => {
        const teamId = await seedTeam();
        expect((await choose(teamId)).status).toBe(403);
    });

    it("picks the chosen team among an organization's several", async () => {
        const frc = await seedTeam({
            companyId: COMPANY,
            subteamId: "frc",
            subteamMembers: [TEST_USER_ID]
        });
        const ftc = await seedTeam({ number: 9999 });
        await db.insert(teamOrganizations).values({
            teamId: ftc,
            companyId: COMPANY,
            kind: "enterprise" as never,
            name: "School",
            subteamId: "ftc",
            subteamMembers: [TEST_USER_ID],
            registeredAt: new Date(),
            registeredBy: "someone"
        });
        await launch(orgDocument());

        await choose(ftc);
        expect((await getContext(ORG_DOC)).current?.teamId).toBe(ftc);
        await choose(frc);
        expect((await getContext(ORG_DOC)).current?.teamId).toBe(frc);
    });
});

describe("POST /api/teams/register", () => {
    function register(body: object, userId = TEST_USER_ID) {
        return createTestApp({ userId }).request(
            "/api/teams/register",
            jsonRequest("POST", body),
            env
        );
    }

    function asCompanyAdmin(admin = true) {
        vi.spyOn(Documents, "getDocument").mockResolvedValue(orgDocument());
        vi.spyOn(Companies, "getCompany").mockResolvedValue({
            id: COMPANY,
            name: "School",
            admin
        });
    }

    it("creates the team with the caller as its admin", async () => {
        await seedFirst(254);
        asCompanyAdmin();
        const res = await register({
            documentId: ORG_DOC,
            first: { program: Program.FRC, number: 254 }
        });
        expect(res.status).toBe(200);
        const { teamId } = await res.json<{ teamId: string }>();

        const context = await getContext(ORG_DOC);
        expect(context.teams).toMatchObject([
            {
                id: teamId,
                role: TeamRole.ADMIN,
                first: {
                    program: Program.FRC,
                    number: 254,
                    name: "Team 254 name"
                }
            }
        ]);
        expect(context.organization?.name).toBe("School");
    });

    it("refuses anyone but a company admin", async () => {
        await seedFirst(254);
        asCompanyAdmin(false);
        const res = await register({
            documentId: ORG_DOC,
            first: { program: Program.FRC, number: 254 }
        });
        expect(res.status).toBe(403);
        expect(await db.select().from(teams)).toEqual([]);
    });

    it("refuses an organization already registered, but lets another claim the number", async () => {
        await seedFirst(254);
        asCompanyAdmin();
        const body = {
            documentId: ORG_DOC,
            first: { program: Program.FRC, number: 254 }
        };
        expect((await register(body)).status).toBe(200);
        expect((await register(body)).status).toBe(409);

        vi.spyOn(Documents, "getDocument").mockResolvedValue(
            orgDocument(undefined, "other-doc", "company-2")
        );
        expect(
            (await register({ ...body, documentId: "other-doc" })).status
        ).toBe(200);
        expect(await db.select().from(teams)).toHaveLength(2);
    });

    it("refuses a team FIRST doesn't list", async () => {
        asCompanyAdmin();
        const res = await register({
            documentId: ORG_DOC,
            first: { program: Program.FRC, number: 99999 }
        });
        expect(res.status).toBe(400);
    });

    it("adds a second organization to the caller's team", async () => {
        const teamId = await seedTeam({ admins: [TEST_USER_ID] });
        asCompanyAdmin();
        const res = await register({ documentId: ORG_DOC, teamId });
        expect(res.status).toBe(200);
        const organizations = await db
            .select()
            .from(teamOrganizations)
            .where(eq(teamOrganizations.teamId, teamId));
        expect(organizations.map((each) => each.companyId)).toEqual([COMPANY]);
    });

    it("registers a subteam of the organization with its members", async () => {
        await seedFirst(254);
        asCompanyAdmin();
        vi.spyOn(Teams, "getTeam").mockResolvedValue({
            id: "onshape-team",
            name: "FRC",
            owner: { type: OnshapeOwnerType.COMPANY, id: COMPANY }
        });
        vi.spyOn(Teams, "getTeamMembers").mockResolvedValue([
            { admin: false, member: { id: "student" } }
        ]);
        const res = await register({
            documentId: ORG_DOC,
            subteamId: "onshape-team",
            first: { program: Program.FRC, number: 254 }
        });
        expect(res.status).toBe(200);
        const row = await db.select().from(teamOrganizations).get();
        expect(row?.subteamMembers).toEqual(["student"]);
    });

    it("refuses a subteam another company owns", async () => {
        await seedFirst(254);
        asCompanyAdmin();
        vi.spyOn(Teams, "getTeam").mockResolvedValue({
            id: "onshape-team",
            name: "Elsewhere",
            owner: { type: OnshapeOwnerType.COMPANY, id: "company-2" }
        });
        const res = await register({
            documentId: ORG_DOC,
            subteamId: "onshape-team",
            first: { program: Program.FRC, number: 254 }
        });
        expect(res.status).toBe(400);
    });
});

describe("team administration", () => {
    it("lets only an admin change settings, and keeps colors to hex", async () => {
        const teamId = await seedTeam({
            admins: ["admin"],
            members: [TEST_USER_ID]
        });
        const url = `/api/teams/${teamId}/settings`;
        const asMember = await createTestApp().request(
            url,
            jsonRequest("POST", { membersEditFavorites: true }),
            env
        );
        expect(asMember.status).toBe(403);

        const bad = await createTestApp({ userId: "admin" }).request(
            url,
            jsonRequest("POST", { colors: ["red"] }),
            env
        );
        expect(bad.status).toBe(400);

        const ok = await createTestApp({ userId: "admin" }).request(
            url,
            jsonRequest("POST", { colors: ["#FF0000", "#ff0000", "#00ff00"] }),
            env
        );
        expect(ok.status).toBe(200);
        const team = await db.select().from(teams).get();
        expect(team?.colors).toEqual(["#ff0000", "#00ff00"]);

        const policy = (genericVendor: string) =>
            createTestApp({ userId: "admin" }).request(
                url,
                jsonRequest("POST", { genericVendor }),
                env
            );
        expect((await policy("sometimes")).status).toBe(400);
        expect((await policy(GenericVendorPolicy.BAN)).status).toBe(200);
        expect((await db.select().from(teams).get())?.genericVendor).toBe(
            GenericVendorPolicy.BAN
        );
    });

    it("keeps the last admin", async () => {
        const teamId = await seedTeam({
            admins: [TEST_USER_ID],
            members: ["member"]
        });
        const leave = await createTestApp().request(
            `/api/teams/${teamId}/members/${TEST_USER_ID}`,
            jsonRequest("DELETE"),
            env
        );
        expect(leave.status).toBe(409);

        await createTestApp().request(
            `/api/teams/${teamId}/members/member`,
            jsonRequest("POST", { role: TeamRole.ADMIN }),
            env
        );
        const again = await createTestApp().request(
            `/api/teams/${teamId}/members/${TEST_USER_ID}`,
            jsonRequest("DELETE"),
            env
        );
        expect(again.status).toBe(200);
        expect(await memberIds(teamId)).toEqual(["member"]);
    });

    it("lets a member leave but not remove another", async () => {
        const teamId = await seedTeam({
            admins: ["admin"],
            members: [TEST_USER_ID, "other"]
        });
        const removeOther = await createTestApp().request(
            `/api/teams/${teamId}/members/other`,
            jsonRequest("DELETE"),
            env
        );
        expect(removeOther.status).toBe(403);
        const leave = await createTestApp().request(
            `/api/teams/${teamId}/members/${TEST_USER_ID}`,
            jsonRequest("DELETE"),
            env
        );
        expect(leave.status).toBe(200);
    });
});

describe("team favorites and recents", () => {
    async function addFavorite(teamId: string, userId: string) {
        return createTestApp({ userId }).request(
            `/api/teams/${teamId}/favorites/library/${TEST_LIBRARY_ID}?insertableId=${TEST_PART_STUDIO_ID}&id=fav-1`,
            jsonRequest("POST", {}),
            env
        );
    }

    it("lets members edit favorites only when the team allows it", async () => {
        await seedPartStudio(db);
        const teamId = await seedTeam({
            admins: ["admin"],
            members: [TEST_USER_ID]
        });
        expect((await addFavorite(teamId, TEST_USER_ID)).status).toBe(403);
        await db
            .update(teams)
            .set({ membersEditFavorites: true })
            .where(eq(teams.id, teamId));
        expect((await addFavorite(teamId, TEST_USER_ID)).status).toBe(200);

        const res = await createTestApp().request(
            `/api/teams/${teamId}/favorites/library/${TEST_LIBRARY_ID}`,
            jsonRequest("GET"),
            env
        );
        const data = await res.json<FavoritesData>();
        expect(data.favoriteOrder).toEqual(["fav-1"]);
    });

    it("shows a team's recents to its members alone", async () => {
        await seedPartStudio(db);
        const teamId = await seedTeam({ members: [TEST_USER_ID] });
        await writeTeamRecentInsert(
            db,
            teamId,
            "teammate",
            {
                libraryId: TEST_LIBRARY_ID,
                insertableId: TEST_PART_STUDIO_ID,
                selection: undefined,
                parameters: []
            },
            new Date()
        );
        const url = `/api/teams/${teamId}/recents/library/${TEST_LIBRARY_ID}`;
        const res = await createTestApp().request(url, jsonRequest("GET"), env);
        const data = await res.json<RecentsData>();
        expect(data.recents.map((recent) => recent.insertableId)).toEqual([
            TEST_PART_STUDIO_ID
        ]);
        const outsider = await createTestApp({ userId: "outsider" }).request(
            url,
            jsonRequest("GET"),
            env
        );
        expect(outsider.status).toBe(403);
    });
});

describe("team usage", () => {
    function insertInto(documentId: string, source = UseSource.FAVORITES) {
        return {
            libraryId: TEST_LIBRARY_ID,
            path: {
                documentId: "lib-doc",
                instanceType: "v" as const,
                instanceId: "v1",
                elementId: "el"
            },
            insertableId: "ins",
            selection: undefined,
            parameters: [],
            isFavorite: false,
            source,
            targetDocumentId: documentId,
            targetElementType: ElementType.PART_STUDIO,
            isQuickInsert: false,
            fasten: false,
            fastenable: false,
            preselected: false,
            atInsertLocation: false
        };
    }

    it("credits an insert to the team and its rollups", async () => {
        const teamId = await seedTeam({ companyId: COMPANY });
        await launch(orgDocument());
        await recordInserts(env, TEST_USER_ID, [insertInto(ORG_DOC)]);

        const event = await db.select().from(events).get();
        expect(event?.teamId).toBe(teamId);
        const metrics = await db.select().from(dailyTeamMetrics);
        expect(metrics.map((row) => [row.category, row.count]).sort()).toEqual(
            [
                [AppFeature.FAVORITES, 1],
                [ALL_USES, 1]
            ].sort()
        );
        expect(await db.select().from(dailyTeamUsers)).toHaveLength(1);
    });

    it("credits nobody's team for a user on none", async () => {
        await recordInserts(env, TEST_USER_ID, [insertInto(PERSONAL_DOC)]);
        const event = await db.select().from(events).get();
        expect(event?.teamId).toBeNull();
        expect(await db.select().from(dailyTeamMetrics)).toEqual([]);
    });

    it("ranks a team only once enough teams used a category", async () => {
        const mine = await seedTeam({ members: [TEST_USER_ID] });
        const day = toDayKey(Date.now());
        const others = Array.from({ length: MIN_RANKED_TEAMS - 1 }, (_, i) =>
            seedTeam({ number: 1000 + i })
        );
        const otherIds = await Promise.all(others);
        const seedUses = (teamId: string, count: number) =>
            db.insert(dailyTeamMetrics).values({
                teamId,
                day,
                category: ALL_USES,
                count
            });
        await seedUses(mine, 100);
        for (const [index, id] of otherIds.entries()) {
            await seedUses(id, index + 1);
        }

        const report = async () => {
            const res = await createTestApp().request(
                `/api/teams/${mine}/report`,
                jsonRequest("GET"),
                env
            );
            expect(res.status).toBe(200);
            const out = await res.json<TeamReportOut>();
            return out.standings.find((each) => each.category === ALL_USES);
        };
        expect((await report())?.ranking).toBeDefined();

        await db
            .delete(dailyTeamMetrics)
            .where(eq(dailyTeamMetrics.teamId, otherIds[0]));
        const below = await report();
        expect(below?.uses).toBe(100);
        expect(below?.ranking).toBeUndefined();
    });

    it("refuses the report to anyone off the team", async () => {
        const teamId = await seedTeam();
        const res = await createTestApp().request(
            `/api/teams/${teamId}/report`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(403);
    });
});

describe("refreshFirstTeams", () => {
    it("pages FIRST's list for each program with credentials", async () => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation((input) => {
                const url = new URL(input as string);
                const page = Number(url.searchParams.get("page"));
                return Promise.resolve(
                    Response.json({
                        teams: [
                            {
                                teamNumber: page,
                                nameShort: `Team ${page}`,
                                city: "Somewhere"
                            }
                        ],
                        pageCurrent: page,
                        pageTotal: 2
                    })
                );
            });
        await refreshFirstTeams(
            {
                ...env,
                FIRST_FRC_API_USERNAME: "user",
                FIRST_FRC_API_TOKEN: "token"
            },
            new Date("2026-03-01T00:00:00Z")
        );

        // FTC has no credentials here, so only FRC's two pages.
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        const header = new Headers(fetchSpy.mock.calls[0][1]?.headers);
        expect(header.get("Authorization")).toBe(`Basic ${btoa("user:token")}`);
        const rows = await db.select().from(firstTeams);
        expect(rows.map((row) => row.number).sort()).toEqual([1, 2]);
        expect(rows[0].lastSeason).toBe(2026);
    });
});
