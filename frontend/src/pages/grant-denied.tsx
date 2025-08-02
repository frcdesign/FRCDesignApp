import { Icon, NonIdealState, NonIdealStateIconSize } from "@blueprintjs/core";
import { OpenUrlButton } from "../common/open-url-button";

const URL = "https://cad.onshape.com/user/applications";

export function GrantDenied(): JSX.Element {
    const applicationAccessButton = (
        <OpenUrlButton text="Open onshape application page" url={URL} />
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
                title="Grant denied"
                description="You denied FRCDesignLib access to your documents."
                action={applicationAccessButton}
            />
        </div>
    );
}
