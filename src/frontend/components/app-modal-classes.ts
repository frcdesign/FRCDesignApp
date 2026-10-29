import styles from "../lib/styles.module.css";
import classes from "./app-modal.module.css";

/** The framing both halves of the app's modals draw. */
export const APP_MODAL_CLASSES = {
    content: classes.content,
    header: `${classes.header} ${styles.frame}`,
    title: classes.title,
    body: classes.body
};
