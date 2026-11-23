import { Button, Checkbox, Stack, Text } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { useAppModal } from "../../../components/open-app-modal";
import { type TargetElement } from "../../../lib/onshape-launch";
import { m } from "../../../paraglide/messages";
import { type PlannedFix } from "../fixes";
import { useApplyFixesMutation } from "../queries";

interface FixDialogProps {
    target: TargetElement;
    fixes: PlannedFix[];
}

/** Every fix about to be made, each checked until unchecked, made only on confirming. */
export function FixDialog(props: FixDialogProps): ReactNode {
    const { target, fixes } = props;
    const modal = useAppModal();
    const apply = useApplyFixesMutation(target);
    const [chosen, setChosen] = useState(
        () => new Set(fixes.map((fix) => fix.key))
    );
    const selected = fixes.filter((fix) => chosen.has(fix.key));

    const toggle = (key: string) => {
        setChosen((previous) => {
            const next = new Set(previous);
            if (!next.delete(key)) {
                next.add(key);
            }
            return next;
        });
    };

    return (
        <>
            <AppModalBody>
                <Text size="sm" c="dimmed">
                    {m.designCheckFixDescription()}
                </Text>
                <Stack gap="xs">
                    {fixes.map((fix) => (
                        <Checkbox
                            key={fix.key}
                            checked={chosen.has(fix.key)}
                            onChange={() => toggle(fix.key)}
                            label={fix.description}
                            description={fix.tabName}
                        />
                    ))}
                </Stack>
            </AppModalBody>
            <AppModalFooter>
                <Button variant="default" onClick={modal.close}>
                    {m.designCheckFixCancel()}
                </Button>
                <Button
                    loading={apply.isPending}
                    disabled={selected.length === 0}
                    onClick={() =>
                        apply.mutate(
                            selected.map((fix) => fix.request),
                            { onSettled: modal.close }
                        )
                    }
                >
                    {m.designCheckFixConfirm({ count: selected.length })}
                </Button>
            </AppModalFooter>
        </>
    );
}
