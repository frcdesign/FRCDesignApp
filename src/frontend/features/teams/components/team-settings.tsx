import {
    ActionIcon,
    Button,
    ColorInput,
    ColorSwatch,
    Group,
    MultiSelect,
    Select,
    Stack,
    Switch,
    Text
} from "@mantine/core";
import {
    ArrowsClockwiseIcon,
    TrashIcon,
    UsersThreeIcon,
    XIcon
} from "@phosphor-icons/react";
import { ReactNode, useId, useState } from "react";
import {
    GenericVendorPolicy,
    MAX_TEAM_COLORS,
    PERSONAL,
    TeamContextSource,
    TeamRole,
    teamLabel,
    type MyTeam
} from "@backend/features/teams/contract";
import { getVendorName, Vendor } from "@backend/features/library/vendors";
import { InputRow } from "../../../components/input-row";
import { OpenUrlButton } from "../../../components/open-url-button";
import { SETTING_CONTROL_WIDTH } from "../../../lib/style-constants";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { useAppModal } from "../../../components/open-app-modal";
import { m } from "../../../paraglide/messages";
import { openRegisterTeam } from "../open-register";
import {
    teamApi,
    useChooseTeamMutation,
    useRefreshFirstTeamsMutation,
    useCurrentTeam,
    useTeamAdminMutation,
    useTeamAdminQuery,
    useTeamContextQuery,
    useTeamSettingsMutation
} from "../queries";

/** The settings menu's team rows: which team, registering one, and its dashboard. */
export function TeamSection(): ReactNode {
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
                        w={SETTING_CONTROL_WIDTH}
                        data={[
                            ...teams.map((team) => ({
                                value: team.id,
                                label: `${team.first.program} ${team.first.number}`
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
export function TeamAdminSettings(): ReactNode {
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

function TeamAdminForm(props: TeamAdminFormProps): ReactNode {
    const { team } = props;
    const settingsMutation = useTeamSettingsMutation(team.id);
    const { settings } = team;
    const [newColor, setNewColor] = useState("");

    const setColors = (colors: string[]) => settingsMutation.mutate({ colors });

    return (
        <Stack gap="sm">
            <Text fw={600}>{teamLabel(team.first)}</Text>
            <Switch
                label={m.teamMembersEditFavorites()}
                description={m.teamMembersEditFavoritesDescription()}
                checked={settings.membersEditFavorites}
                onChange={(event) =>
                    settingsMutation.mutate({
                        membersEditFavorites: event.currentTarget.checked
                    })
                }
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
            <Select
                label={m.teamGenericVendor()}
                description={m.teamGenericVendorDescription()}
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
            <Stack gap={4}>
                <Text size="sm" fw={500}>
                    {m.teamColors()}
                </Text>
                <Group gap="xs">
                    {settings.colors.map((color) => (
                        <Group key={color} gap={2} wrap="nowrap">
                            <ColorSwatch color={color} size={20} />
                            <ActionIcon
                                size="sm"
                                variant="subtle"
                                title={m.teamRemoveColor()}
                                onClick={() =>
                                    setColors(
                                        settings.colors.filter(
                                            (each) => each !== color
                                        )
                                    )
                                }
                            >
                                <XIcon />
                            </ActionIcon>
                        </Group>
                    ))}
                </Group>
                {settings.colors.length < MAX_TEAM_COLORS && (
                    <Group gap="xs" wrap="nowrap">
                        <ColorInput
                            flex={1}
                            format="hex"
                            value={newColor}
                            onChange={setNewColor}
                            placeholder={m.teamColorPlaceholder()}
                        />
                        <Button
                            variant="default"
                            disabled={!/^#[0-9a-f]{6}$/i.test(newColor)}
                            onClick={() => {
                                setColors([...settings.colors, newColor]);
                                setNewColor("");
                            }}
                        >
                            {m.teamAddColor()}
                        </Button>
                    </Group>
                )}
            </Stack>
            <TeamPeople teamId={team.id} />
        </Stack>
    );
}

interface TeamPeopleProps {
    teamId: string;
}

/** Its organizations and members. Members are shown by Onshape id: the app knows no names. */
function TeamPeople(props: TeamPeopleProps): ReactNode {
    const { teamId } = props;
    const adminQuery = useTeamAdminQuery(teamId);
    const removeOrganization = useTeamAdminMutation((id: string) =>
        teamApi.removeOrganization(teamId, id)
    );
    const refreshOrganization = useTeamAdminMutation((id: string) =>
        teamApi.refreshOrganization(teamId, id)
    );
    const setRole = useTeamAdminMutation(
        ({ userId, role }: { userId: string; role: TeamRole }) =>
            teamApi.setRole(teamId, userId, role)
    );
    const removeMember = useTeamAdminMutation((userId: string) =>
        teamApi.removeMember(teamId, userId)
    );

    if (!adminQuery.data) return null;
    const { organizations, members } = adminQuery.data;

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
                {m.teamMembers({ count: members.length })}
            </Text>
            {members.map((member) => (
                <Group
                    key={member.userId}
                    justify="space-between"
                    wrap="nowrap"
                >
                    <Text size="sm" ff="monospace" truncate>
                        {member.userId}
                    </Text>
                    <Group gap={4} wrap="nowrap">
                        <Select
                            w={110}
                            size="xs"
                            data={[
                                {
                                    value: TeamRole.ADMIN,
                                    label: m.teamRoleAdmin()
                                },
                                {
                                    value: TeamRole.MEMBER,
                                    label: m.teamRoleMember()
                                }
                            ]}
                            value={member.role}
                            allowDeselect={false}
                            onChange={(role) => {
                                if (role) {
                                    setRole.mutate({
                                        userId: member.userId,
                                        role: role
                                    });
                                }
                            }}
                        />
                        <ActionIcon
                            variant="subtle"
                            color="red"
                            title={m.teamRemove()}
                            onClick={() => removeMember.mutate(member.userId)}
                        >
                            <TrashIcon />
                        </ActionIcon>
                    </Group>
                </Group>
            ))}
        </>
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
