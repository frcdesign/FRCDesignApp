import { Button, SegmentedControl, Select, TextInput } from "@mantine/core";
import { ReactNode, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import {
    Program,
    TeamRole,
    teamLabel,
    type DocumentOrganization,
    type MyTeam
} from "@backend/features/teams/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { useAppModal } from "../../../components/open-app-modal";
import { showSuccessToast } from "../../../lib/notifications";
import { showReportableErrorToast } from "../../../lib/errors";
import { m } from "../../../paraglide/messages";
import { useFirstTeamSearch, useRegisterTeamMutation } from "../queries";
import { parseOnshapeTeamId } from "../onshape-team";

/** A team of the caller's, which the organization joins. */
const TEAM_PREFIX = "team:";
/** A FIRST team's number, which a new team claims. */
const FIRST_PREFIX = "first:";

interface RegisterTeamFormProps {
    documentId: string;
    organization: DocumentOrganization;
    teams: MyTeam[];
}

/** Registers the launch's organization to a team of the caller's, or to a new one. */
export function RegisterTeamForm(props: RegisterTeamFormProps): ReactNode {
    const { documentId, organization, teams } = props;
    const modal = useAppModal();
    const [program, setProgram] = useState(Program.FRC);
    const [search, setSearch] = useState("");
    const [debounced] = useDebouncedValue(search, 250);
    const [value, setValue] = useState<string | null>(null);
    const [subteam, setSubteam] = useState("");
    const searchQuery = useFirstTeamSearch(program, debounced);
    const registerMutation = useRegisterTeamMutation();

    const typed = search.trim().toLowerCase();
    // Shown so a member sees their team, but only an admin adds to it.
    const yourTeams = teams
        .filter(
            (team) =>
                value === TEAM_PREFIX + team.id ||
                teamLabel(team.first).toLowerCase().includes(typed)
        )
        .sort(
            (a, b) =>
                Number(b.role === TeamRole.ADMIN) -
                Number(a.role === TeamRole.ADMIN)
        );
    const firstTeams = (searchQuery.data ?? []).filter(
        (first) =>
            !teams.some(
                (team) =>
                    team.first.program === first.program &&
                    team.first.number === first.number
            )
    );
    const data = [
        ...(yourTeams.length > 0
            ? [
                  {
                      group: m.teamRegisterYourTeams(),
                      items: yourTeams.map((team) => ({
                          value: TEAM_PREFIX + team.id,
                          label: teamLabel(team.first),
                          disabled: team.role !== TeamRole.ADMIN
                      }))
                  }
              ]
            : []),
        ...(firstTeams.length > 0
            ? [
                  {
                      group: m.teamRegisterFirstTeams({ program }),
                      items: firstTeams.map((first) => ({
                          value: FIRST_PREFIX + first.number,
                          label: teamLabel(first)
                      }))
                  }
              ]
            : [])
    ];

    const subteamId = subteam.trim() ? parseOnshapeTeamId(subteam) : undefined;
    const subteamInvalid = subteam.trim() !== "" && subteamId === undefined;
    const ready = !subteamInvalid && value !== null;

    const register = () => {
        if (value === null) return;
        registerMutation.mutate(
            {
                documentId,
                subteamId,
                ...(value.startsWith(TEAM_PREFIX)
                    ? { teamId: value.slice(TEAM_PREFIX.length) }
                    : {
                          first: {
                              program,
                              number: Number(value.slice(FIRST_PREFIX.length))
                          }
                      })
            },
            {
                onSuccess: () => {
                    showSuccessToast(m.teamRegistered());
                    modal.close();
                },
                onError: (error) =>
                    showReportableErrorToast(m.teamRegisterFailed(), error)
            }
        );
    };

    return (
        <>
            <AppModalBody>
                {organization.name && (
                    <div>
                        {m.teamRegisterDescription({
                            organization: organization.name
                        })}
                    </div>
                )}
                <SegmentedControl
                    value={program}
                    onChange={(next) => {
                        setProgram(next);
                        if (value?.startsWith(FIRST_PREFIX)) setValue(null);
                    }}
                    data={Object.values(Program)}
                />
                <Select
                    label={m.teamRegisterTeam()}
                    placeholder={m.teamRegisterTeamPlaceholder()}
                    searchable
                    searchValue={search}
                    onSearchChange={setSearch}
                    // The server searched FIRST's teams; the caller's are always offered.
                    filter={({ options }) => options}
                    data={data}
                    value={value}
                    onChange={setValue}
                    nothingFoundMessage={
                        debounced && !searchQuery.isPending
                            ? m.teamRegisterNoTeam()
                            : undefined
                    }
                />
                <TextInput
                    label={m.teamRegisterSubteam()}
                    description={m.teamRegisterSubteamDescription()}
                    value={subteam}
                    onChange={(event) => setSubteam(event.currentTarget.value)}
                    error={
                        subteamInvalid
                            ? m.teamRegisterSubteamInvalid()
                            : undefined
                    }
                />
            </AppModalBody>
            <AppModalFooter>
                <Button
                    disabled={!ready}
                    loading={registerMutation.isPending}
                    onClick={register}
                >
                    {m.teamRegisterButton()}
                </Button>
            </AppModalFooter>
        </>
    );
}
