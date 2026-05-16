import { Button } from "@blueprintjs/core";
import { openUrlInNewTab } from "./url";

interface UrlButtonProps {
    url: string;
    text: string;
}

export function OpenUrlButton(props: UrlButtonProps) {
    return (
        <Button
            text={props.text}
            intent="primary"
            icon="share"
            onClick={() => openUrlInNewTab(props.url)}
        />
    );
}
