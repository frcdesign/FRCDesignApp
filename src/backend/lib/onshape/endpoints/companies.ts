import { OnshapeApi } from "../client";

/** As much of Onshape's `BTCompanyInfo` as anything reads; see ONSHAPE.md. */
export interface OnshapeCompanyInfo {
    id: string;
    name: string;
    /** Whether the caller administers the company. Unverified for a classroom. */
    admin?: boolean;
}

export function getCompany(
    client: OnshapeApi,
    companyId: string
): Promise<OnshapeCompanyInfo> {
    return client.get(`/companies/${encodeURIComponent(companyId)}`);
}
