import { Icon, NonIdealState, NonIdealStateIconSize } from "@blueprintjs/core";
import { OpenUrlButton } from "../common/open-url-button";

const URL =
    "https://support.apple.com/guide/safari/prevent-cross-site-tracking-sfri40732/mac";

export function SafariError(): JSX.Element {
    const applicationAccessButton = (
        <OpenUrlButton text="More information" url={URL} />
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
                title="Cannot Authenticate in Safari"
                description="The FRCDesignApp does not work on Safari unless you manually disable 'Prevent cross-site tracking' in your browser settings."
                action={applicationAccessButton}
            />
        </div>
    );
}
