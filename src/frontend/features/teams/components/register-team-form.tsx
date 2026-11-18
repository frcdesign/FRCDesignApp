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

enum Mode {
    NEW = "new",
    EXISTING = "existing"
}

interface RegisterTeamFormProps {
    documentId: string;
    organization: DocumentOrganization;
    teams: MyTeam[];
}

/** Registers the launch's organization: to a new team, or to one the caller administers. */
export function RegisterTeamForm(props: RegisterTeamFormProps): ReactNode {
    const { documentId, organization, teams } = props;
    const modal = useAppModal();
    const adminTeams = teams.filter((team) => team.role === TeamRole.ADMIN);
    const [mode, setMode] = useState(Mode.NEW);
    const [program, setProgram] = useState(Program.FRC);
    const [search, setSearch] = useState("");
    const [debounced] = useDebouncedValue(search, 250);
    const [number, setNumber] = useState<string | null>(null);
    const [teamId, setTeamId] = useState<string | null>(
        adminTeams[0]?.id ?? null
    );
    const [subteam, setSubteam] = useState("");
    const searchQuery = useFirstTeamSearch(program, debounced);
    const registerMutation = useRegisterTeamMutation();

    const subteamId = subteam.trim() ? parseOnshapeTeamId(subteam) : undefined;
    const subteamInvalid = subteam.trim() !== "" && subteamId === undefined;
    const ready =
        !subteamInvalid &&
        (mode === Mode.NEW ? number !== null : teamId !== null);

    const register = () => {
        registerMutation.mutate(
            {
                documentId,
                subteamId,
                ...(mode === Mode.NEW
                    ? { first: { program, number: Number(number) } }
                    : { teamId: teamId ?? undefined })
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
                {adminTeams.length > 0 && (
                    <SegmentedControl
                        value={mode}
                        onChange={(value) => setMode(value)}
                        data={[
                            { value: Mode.NEW, label: m.teamRegisterNew() },
                            {
                                value: Mode.EXISTING,
                                label: m.teamRegisterExisting()
                            }
                        ]}
                    />
                )}
                {mode === Mode.NEW ? (
                    <>
                        <SegmentedControl
                            value={program}
                            onChange={(value) => {
                                setProgram(value);
                                setNumber(null);
                            }}
                            data={Object.values(Program)}
                        />
                        <Select
                            label={m.teamRegisterTeam()}
                            placeholder={m.teamRegisterTeamPlaceholder()}
                            searchable
                            searchValue={search}
                            onSearchChange={setSearch}
                            // The server searched already.
                            filter={({ options }) => options}
                            data={(searchQuery.data ?? []).map((team) => ({
                                value: String(team.number),
                                label: teamLabel(team)
                            }))}
                            value={number}
                            onChange={setNumber}
                            nothingFoundMessage={
                                debounced && !searchQuery.isPending
                                    ? m.teamRegisterNoTeam()
                                    : undefined
                            }
                        />
                    </>
                ) : (
                    <Select
                        label={m.teamRegisterTeam()}
                        data={adminTeams.map((team) => ({
                            value: team.id,
                            label: teamLabel(team.first)
                        }))}
                        value={teamId}
                        onChange={setTeamId}
                        allowDeselect={false}
                    />
                )}
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
