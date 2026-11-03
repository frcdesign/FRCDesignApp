import {
    FeedbackCategory,
    FeedbackTopic,
    MAX_FEEDBACK_TITLE
} from "@backend/features/feedback/contract";
import { m } from "../../paraglide/messages";

export function topicLabel(topic: FeedbackTopic): string {
    switch (topic) {
        case FeedbackTopic.APP:
            return m.feedbackTopicApp();
        case FeedbackTopic.VERSION_MANAGER:
            return m.feedbackTopicVersionManager();
        case FeedbackTopic.FRC_DESIGN_LIB:
            return m.feedbackTopicFrcDesignLib();
        case FeedbackTopic.MKCAD:
            return m.feedbackTopicMkcad();
        case FeedbackTopic.CONFIG_LIB:
            return m.feedbackTopicConfigLib();
    }
}

export function typeLabel(category: FeedbackCategory): string {
    switch (category) {
        case FeedbackCategory.BUG:
            return m.feedbackTypeBug();
        case FeedbackCategory.FEATURE_REQUEST:
            return m.feedbackTypeFeatureRequest();
        case FeedbackCategory.PART_REQUEST:
            return m.feedbackTypePartRequest();
        case FeedbackCategory.ORGANIZATION:
            return m.feedbackTypeOrganization();
        case FeedbackCategory.METADATA:
            return m.feedbackTypeMetadata();
        case FeedbackCategory.INCORRECT_GEOMETRY:
            return m.feedbackTypeIncorrectGeometry();
        case FeedbackCategory.BROKEN_CONFIGURATION:
            return m.feedbackTypeBrokenConfiguration();
        case FeedbackCategory.THUMBNAIL:
            return m.feedbackTypeThumbnail();
        case FeedbackCategory.KUDOS:
            return m.feedbackTypeKudos();
        case FeedbackCategory.OTHER:
            return m.feedbackTypeOther();
    }
}

/** What the description box asks for, which follows the type. */
export function descriptionPlaceholder(category: FeedbackCategory): string {
    switch (category) {
        case FeedbackCategory.BUG:
            return m.feedbackDescriptionBug();
        case FeedbackCategory.FEATURE_REQUEST:
            return m.feedbackDescriptionFeatureRequest();
        case FeedbackCategory.PART_REQUEST:
            return m.feedbackDescriptionPartRequest();
        case FeedbackCategory.METADATA:
            return m.feedbackDescriptionMetadata();
        case FeedbackCategory.INCORRECT_GEOMETRY:
            return m.feedbackDescriptionIncorrectGeometry();
        case FeedbackCategory.BROKEN_CONFIGURATION:
            return m.feedbackDescriptionBrokenConfiguration();
        case FeedbackCategory.KUDOS:
            return m.feedbackDescriptionKudos();
        case FeedbackCategory.ORGANIZATION:
        case FeedbackCategory.THUMBNAIL:
        case FeedbackCategory.OTHER:
            return m.feedbackDescriptionOther();
    }
}

interface TitleContext {
    category: FeedbackCategory;
    /** The part a part report names. */
    partName?: string;
    /** What an error report's user was shown. */
    errorShown?: string;
}

/** What the form fills the title in with until the reporter writes their own; none for general feedback. */
export function suggestTitle(context: TitleContext): string | undefined {
    const { category, partName, errorShown } = context;
    let title;
    if (errorShown) {
        title = errorShown.replace(/\.$/, "");
    } else if (partName) {
        title = m.feedbackSuggestedTitle({
            type: typeLabel(category),
            about: partName
        });
    } else {
        return undefined;
    }
    return title.length <= MAX_FEEDBACK_TITLE
        ? title
        : title.slice(0, MAX_FEEDBACK_TITLE - 1) + "…";
}
