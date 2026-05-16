import { createFileRoute } from "@tanstack/react-router";
import { Icon, NonIdealState, NonIdealStateIconSize } from "@blueprintjs/core";
import { OpenUrlButton } from "../../common/open-url-button";

export const Route = createFileRoute("/_pages/grant-denied")({
    component: GrantDenied
});

const URL = "https://cad.onshape.com/user/applications";

function GrantDenied(): JSX.Element {
    const applicationAccessButton = (
        <OpenUrlButton text="Open Onshape Applications page" url={URL} />
    );

    return (
        <div style={{ height: "80vh" }}>
            <NonIdealState
                icon={
                    <Icon
                        icon="cross"
                        intent="danger"
                        size={NonIdealStateIconSize.STANDARD}
                    />
                }
                title="Grant Denied"
                description="You denied the FRCDesignApp access to your documents."
                action={applicationAccessButton}
            />
        </div>
    );
}
