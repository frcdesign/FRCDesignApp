import { OnshapeApi } from "./onshape-api";

export class OAuthApi extends OnshapeApi {
    constructor(accessToken: string) {
        super({
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json"
            }
        });
    }
}
