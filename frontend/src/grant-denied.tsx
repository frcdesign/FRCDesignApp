import { Button } from "@blueprintjs/core";
import { NonIdealStateOverride } from "./components/non-ideal-state-override";

const URL = "https://cad.onshape.com/user/applications";

export function GrantDenied(): JSX.Element {
    const applicationAccessButton = (
        <Button
            text="Open Onshape application page"
            intent="primary"
            icon="share"
            onClick={() => {
                // location.href = URL;
                window.open(URL);
            }}
        />
    );

    return (
        <div style={{ height: "80vh" }}>
            <NonIdealStateOverride
                icon="cross"
                iconIntent="danger"
                title="Grant denied"
                description="Robot manager was denied access to your documents."
                action={applicationAccessButton}
            />
        </div>
    );
}
