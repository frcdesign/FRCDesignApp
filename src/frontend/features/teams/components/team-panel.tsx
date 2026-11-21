import {
    ActionIcon,
    Button,
    ColorInput,
    ColorSwatch,
    CopyButton,
    Divider,
    Group,
    MultiSelect,
    Select,
    Stack,
    Text,
    TextInput
} from "@mantine/core";
import {
    ArrowsClockwiseIcon,
    CheckIcon,
    CopyIcon,
    TrashIcon,
    UserPlusIcon,
    UsersThreeIcon,
    XIcon
} from "@phosphor-icons/react";
import { ReactNode, useId, useState } from "react";
import {
    GenericVendorPolicy,
    MAX_COLOR_NAME_LENGTH,
    MAX_TEAM_COLORS,
    type TeamColor,
    PERSONAL,
    TeamContextSource,
    TeamRole,
    teamLabel,
    type MyTeam
} from "@backend/features/teams/contract";
import { getVendorName, Vendor } from "@backend/features/library/vendors";
import { InputRow } from "../../../components/input-row";
import { OpenUrlButton } from "../../../components/open-url-button";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { useAppModal } from "../../../components/open-app-modal";
import { m } from "../../../paraglide/messages";
import { openRegisterTeam } from "../open-register";
import { inviteUrl } from "../invite";
import {
    teamApi,
    useChooseTeamMutation,
    useRefreshFirstTeamsMutation,
    useCreateInviteMutation,
    useCurrentTeam,
    useTeamAdminMutation,
    useTeamAdminQuery,
    useTeamContextQuery,
    useTeamSettingsMutation
} from "../queries";

/** The Team panel: which team, its dashboard, registering, and the current team's settings for its admins. */
export function TeamPanelContent(): ReactNode {
    return (
        <Stack gap="md">
            <TeamSection />
            <TeamAdminSettings />
        </Stack>
    );
}

/** Wide enough for a team's number and the start of its name. */
const TEAM_SELECT_WIDTH = 240;

/** Which team, its dashboard, and registering the document's organization. */
function TeamSection(): ReactNode {
    const contextQuery = useTeamContextQuery();
    const chooseMutation = useChooseTeamMutation();
    const documentId = useOnshapeLaunch((state) => state.documentId);
    const modal = useAppModal();
    const id = useId();

    const context = contextQuery.data;
    if (!context) return null;
    const { teams, current, organization } = context;
    const decidedByDocument = current?.source === TeamContextSource.DOCUMENT;

    return (
        <Stack gap="sm">
            {teams.length > 0 && (
                <InputRow label={m.teamLabel()} htmlFor={id}>
                    <Select
                        id={id}
                        w={TEAM_SELECT_WIDTH}
                        data={[
                            ...teams.map((team) => ({
                                value: team.id,
                                label: teamLabel(team.first)
                            })),
                            // Only where a choice decides anything.
                            ...(decidedByDocument
                                ? []
                                : [
                                      {
                                          value: PERSONAL,
                                          label: m.teamPersonal()
                                      }
                                  ])
                        ]}
                        value={current?.teamId ?? PERSONAL}
                        disabled={decidedByDocument}
                        description={
                            decidedByDocument
                                ? m.teamSetByDocument()
                                : undefined
                        }
                        allowDeselect={false}
                        checkIconPosition="right"
                        onChange={(value) => {
                            if (value) chooseMutation.mutate(value);
                        }}
                    />
                </InputRow>
            )}
            {current && (
                <InputRow label={m.teamDashboard()}>
                    <OpenUrlButton
                        text={m.teamOpenDashboard()}
                        url={`/dashboard/teams/${current.teamId}`}
                    />
                </InputRow>
            )}
            {organization && documentId && (
                <InputRow label={m.teamOrganization()}>
                    <Button
                        leftSection={<UsersThreeIcon />}
                        onClick={() => {
                            modal.close();
                            openRegisterTeam(documentId, organization, teams);
                        }}
                    >
                        {m.teamRegisterButton()}
                    </Button>
                </InputRow>
            )}
        </Stack>
    );
}

/** The current team's settings, for its admins. */
function TeamAdminSettings(): ReactNode {
    const team = useCurrentTeam();
    if (team?.role !== TeamRole.ADMIN) return null;
    return <TeamAdminForm team={team} />;
}

function genericVendorLabel(policy: GenericVendorPolicy): string {
    switch (policy) {
        case GenericVendorPolicy.REQUIRE:
            return m.teamGenericRequire();
        case GenericVendorPolicy.PREFER:
            return m.teamGenericPrefer();
        case GenericVendorPolicy.ANY:
            return m.teamGenericAny();
        case GenericVendorPolicy.AVOID:
            return m.teamGenericAvoid();
        case GenericVendorPolicy.BAN:
            return m.teamGenericBan();
    }
}

interface TeamAdminFormProps {
    team: MyTeam;
}

/** Who edits the team's favorites; a switch's two states, read as who. */
enum FavoritesEditors {
    EVERYONE = "everyone",
    ADMINS = "admins"
}

function TeamAdminForm(props: TeamAdminFormProps): ReactNode {
    const { team } = props;
    const settingsMutation = useTeamSettingsMutation(team.id);
    const { settings } = team;

    return (
        <Stack gap="sm">
            <Divider label={m.teamSettings()} labelPosition="left" />
            <Select
                label={m.teamEditFavorites()}
                data={[
                    {
                        value: FavoritesEditors.EVERYONE,
                        label: m.teamEditFavoritesEveryone()
                    },
                    {
                        value: FavoritesEditors.ADMINS,
                        label: m.teamEditFavoritesAdmins()
                    }
                ]}
                value={
                    settings.membersEditFavorites
                        ? FavoritesEditors.EVERYONE
                        : FavoritesEditors.ADMINS
                }
                allowDeselect={false}
                checkIconPosition="right"
                onChange={(value) => {
                    if (value) {
                        settingsMutation.mutate({
                            membersEditFavorites:
                                value === FavoritesEditors.EVERYONE
                        });
                    }
                }}
            />
            <Select
                label={m.teamGenericVendor()}
                data={Object.values(GenericVendorPolicy).map((policy) => ({
                    value: policy,
                    label: genericVendorLabel(policy)
                }))}
                value={settings.genericVendor}
                allowDeselect={false}
                checkIconPosition="right"
                onChange={(value) => {
                    if (value) {
                        settingsMutation.mutate({
                            genericVendor: value
                        });
                    }
                }}
            />
            <MultiSelect
                label={m.teamPreferredVendors()}
                description={m.teamPreferredVendorsDescription()}
                data={Object.values(Vendor).map((vendor) => ({
                    value: vendor,
                    label: getVendorName(vendor)
                }))}
                value={settings.vendorRanking}
                searchable
                onChange={(value) =>
                    settingsMutation.mutate({
                        vendorRanking: value
                    })
                }
            />
            <TeamColors
                colors={settings.colors}
                onChange={(colors) => settingsMutation.mutate({ colors })}
            />
            <TeamPeople teamId={team.id} />
        </Stack>
    );
}

interface TeamColorsProps {
    colors: TeamColor[];
    onChange: (colors: TeamColor[]) => void;
}

/** Each color under its name, and a row adding another. */
function TeamColors(props: TeamColorsProps): ReactNode {
    const { colors, onChange } = props;
    const [name, setName] = useState("");
    const [hex, setHex] = useState("");
    const canAdd = name.trim() !== "" && /^#[0-9a-f]{6}$/i.test(hex);

    return (
        <Stack gap={4}>
            <Text size="sm" fw={500}>
                {m.teamColors()}
            </Text>
            {colors.map((color) => (
                <Group key={color.hex} justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                        <ColorSwatch color={color.hex} size={20} />
                        <Text size="sm">{color.name}</Text>
                    </Group>
                    <ActionIcon
                        size="sm"
                        variant="subtle"
                        title={m.teamRemoveColor()}
                        onClick={() =>
                            onChange(
                                colors.filter((each) => each.hex !== color.hex)
                            )
                        }
                    >
                        <XIcon />
                    </ActionIcon>
                </Group>
            ))}
            {colors.length < MAX_TEAM_COLORS && (
                <Group gap="xs" wrap="nowrap" align="flex-start">
                    <TextInput
                        flex={1}
                        placeholder={m.teamColorName()}
                        maxLength={MAX_COLOR_NAME_LENGTH}
                        value={name}
                        onChange={(event) => setName(event.currentTarget.value)}
                    />
                    <ColorInput
                        flex={1}
                        format="hex"
                        value={hex}
                        onChange={setHex}
                        placeholder={m.teamColorPlaceholder()}
                    />
                    <Button
                        variant="default"
                        disabled={!canAdd}
                        onClick={() => {
                            onChange([
                                ...colors,
                                { name: name.trim(), hex: hex.toLowerCase() }
                            ]);
                            setName("");
                            setHex("");
                        }}
                    >
                        {m.teamAddColor()}
                    </Button>
                </Group>
            )}
        </Stack>
    );
}

interface TeamPeopleProps {
    teamId: string;
}

/** Its organizations, and how many members and admins Onshape gives it. */
function TeamPeople(props: TeamPeopleProps): ReactNode {
    const { teamId } = props;
    const adminQuery = useTeamAdminQuery(teamId);
    const removeOrganization = useTeamAdminMutation((id: string) =>
        teamApi.removeOrganization(teamId, id)
    );
    const refreshOrganization = useTeamAdminMutation((id: string) =>
        teamApi.refreshOrganization(teamId, id)
    );

    if (!adminQuery.data) return null;
    const { organizations, memberCount, adminCount } = adminQuery.data;

    return (
        <>
            <Text size="sm" fw={500}>
                {m.teamOrganizations()}
            </Text>
            {organizations.map((organization) => (
                <Group
                    key={organization.id}
                    justify="space-between"
                    wrap="nowrap"
                >
                    <Text size="sm">
                        {organization.subteamId
                            ? m.teamOrganizationSubteam({
                                  organization: organization.name,
                                  count: organization.subteamMemberCount ?? 0
                              })
                            : organization.name}
                    </Text>
                    <Group gap={4} wrap="nowrap">
                        {organization.subteamId && (
                            <ActionIcon
                                variant="subtle"
                                title={m.teamRefreshSubteam()}
                                loading={refreshOrganization.isPending}
                                onClick={() =>
                                    refreshOrganization.mutate(organization.id)
                                }
                            >
                                <ArrowsClockwiseIcon />
                            </ActionIcon>
                        )}
                        <ActionIcon
                            variant="subtle"
                            color="red"
                            title={m.teamRemove()}
                            onClick={() =>
                                removeOrganization.mutate(organization.id)
                            }
                        >
                            <TrashIcon />
                        </ActionIcon>
                    </Group>
                </Group>
            ))}
            <Text size="sm" fw={500}>
                {m.teamMemberCounts({
                    members: memberCount,
                    admins: adminCount
                })}
            </Text>
            <Text size="xs" c="dimmed">
                {m.teamRolesFromOnshape()}
            </Text>
            <TeamInvite teamId={teamId} />
        </>
    );
}

interface TeamInviteProps {
    teamId: string;
}

/** A link anybody signed in joins the team by, until it expires. */
function TeamInvite(props: TeamInviteProps): ReactNode {
    const { teamId } = props;
    const inviteMutation = useCreateInviteMutation(teamId);
    const invite = inviteMutation.data;
    if (!invite) {
        return (
            <Button
                variant="default"
                leftSection={<UserPlusIcon />}
                loading={inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
            >
                {m.teamAddMember()}
            </Button>
        );
    }
    const url = inviteUrl(invite.token);
    return (
        <TextInput
            label={m.teamInviteLink()}
            description={m.teamInviteExpires({
                date: new Date(invite.expiresAt).toLocaleDateString()
            })}
            value={url}
            readOnly
            rightSection={
                <CopyButton value={url}>
                    {({ copied, copy }) => (
                        <ActionIcon
                            variant="subtle"
                            title={
                                copied
                                    ? m.teamInviteCopied()
                                    : m.teamInviteCopy()
                            }
                            onClick={copy}
                        >
                            {copied ? <CheckIcon /> : <CopyIcon />}
                        </ActionIcon>
                    )}
                </CopyButton>
            }
        />
    );
}

/** The owner's: FIRST's lists now, rather than at the weekly refresh. */
export function RefreshFirstTeamsButton(): ReactNode {
    const mutation = useRefreshFirstTeamsMutation();
    return (
        <Button
            leftSection={<ArrowsClockwiseIcon />}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
        >
            {m.teamRefreshFirst()}
        </Button>
    );
}
