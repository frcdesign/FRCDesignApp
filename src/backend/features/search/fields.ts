/**
 * The indexed field names, named once. `tokenize` splits by field, `contract`
 * groups them, and `records` reads which ones a hit matched — so a bare string
 * in any of the three has to agree with the other two.
 */

/** The insertable's own title. */
export const NAME_FIELD = "name";

/** The name of the group it sits in. */
export const GROUP_NAME_FIELD = "groupName";

/** Every indexed configuration's part number, space-joined. */
export const PART_NUMBER_FIELD = "partNumbers";

/** Every indexed configuration's part name, space-joined. */
export const PART_NAME_FIELD = "partNames";
