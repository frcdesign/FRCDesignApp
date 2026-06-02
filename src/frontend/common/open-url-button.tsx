import { Button } from "@mantine/core";
import { IconShare } from "@tabler/icons-react";
import { openUrlInNewTab } from "./url";

interface UrlButtonProps {
    url: string;
    text: string;
}

export function OpenUrlButton(props: UrlButtonProps) {
    return (
        <Button
            color="blue"
            leftSection={<IconShare size={16} />}
            onClick={() => openUrlInNewTab(props.url)}
        >
            {props.text}
        </Button>
    );
}
