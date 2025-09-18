/**
 * Errors which are generated and thrown on the client.
 * Unlike other errors, the message is displayed directly to the user.
 */
export class HandledError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Errors reported by the backend and handled on the client.
 */
export class ReportedError extends Error {
    public type: string;

    constructor(type: string) {
        super(type);
        Object.setPrototypeOf(this, new.target.prototype);
        this.type = type;
    }
}

// export class MissingPermissionError extends ReportedError {
//     public constructor(
//         public permission: string,
//         public documentName?: string
//     ) {
//         super("MISSING_PERMISSION");
//         Object.setPrototypeOf(this, new.target.prototype);
//     }

//     public getDescription(
//         isCurrentDocument?: boolean,
//         unknownAccessMessage?: string
//     ): string {
//         if (isCurrentDocument ?? true) {
//             // You need to have Write access to this document.
//             return `You need to have ${this.permission} access to this document.`;
//         } else if (this.documentName) {
//             // You need to have Write access to My Test Document.
//             return `You need to have ${this.permission} access to ${this.documentName}.`;
//         }
//         return (
//             unknownAccessMessage ??
//             `You don't have access to a needed document.`
//         );
//     }
// }

export const FEEDBACK_FORM_URL = "https://forms.gle/WVXUwnrrpLGKdiBx9";
