import { DbCollection, DB, TypedDoc } from "./db";
import { UserData } from "./db-models";

export class UserRef extends TypedDoc<UserData> {}

export function getUser(userId: string): UserRef {
    return new UserRef(DB.collection(DbCollection.USER_DATA).doc(userId));
}
