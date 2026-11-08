# Testbench: strings

What [testbench.md](../architecture/testbench.md) shows the owner at
`/testbench`. Every string is a message in `src/frontend/messages/en.json`,
keyed `testbench…`. Labels that only name an input are left out.

## The page

| String                                  | Kind        | Where           | When                     | Review    |
| --------------------------------------- | ----------- | --------------- | ------------------------ | --------- |
| "Only the owner can use the testbench." | Alert       | Instead of tabs | Anyone below owner       | **⚑** New |
| "That isn't valid JSON."                | Error toast |                 | A JSON field won't parse | **⚑** New |

## Rate limits

| String                                                                                                                                                                         | Kind              | Where             | When                           | Review          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ----------------- | ------------------------------ | --------------- |
| "Every call here counts against the account's Onshape API allocation, and a burst can make hundreds. Onshape may also rate-limit your own use of Onshape while a limit lasts." | Alert             | Top of the tab    | Always                         | **⚑** New, long |
| "An Onshape url, copied from the address bar with the right tab open."                                                                                                         | Field description | Element           | A preset that needs an element | **⚑** New       |
| "That url doesn't name a tab in a document."                                                                                                                                   | Field error       | Element           | The url names no element       | **⚑** New       |
| "Stop at the first 429 and time how long the limit lasts"                                                                                                                      | Checkbox          | Above Start       | Always                         | **⚑** New       |
| "{sent} sent: {ok} ok, {limited} limited, {failed} failed, over {seconds} s; {rate} calls a second until the first 429."                                                       | Summary           | Under the buttons | After a burst starts           | **⚑** New       |
| "First 429 on call {index}, after {okBefore} ok calls and {seconds} s." / "No 429."                                                                                            | Summary           | Same              | Same                           | **⚑** New       |
| "The limit lifted within {seconds} s of the first 429." / "The limit hadn't lifted when the wait ended."                                                                       | Summary           | Same              | After a 429                    | **⚑** New       |

## Custom toolbar

| String                                                                                                                                                                                                            | Kind        | Where                     | When        | Review          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------- | ----------- | --------------- |
| "Reads, adds to and removes from your custom toolbar through the internal endpoints Onshape's web client calls. They're undocumented: try the app's API version first, then 14, the version the web client uses." | Description | Top of the tab            | Always      | **⚑** New, long |
| "{total} tools, {own} of them yours"                                                                                                                                                                              | Count       | Beside the list's heading | Once listed | **⚑** New       |
| "Copy to create" / "Remove"                                                                                                                                                                                       | Buttons     | Each of the owner's tools | Once listed | **⚑** New       |

## Webhooks

| String                                                                                                                                                              | Kind          | Where                           | When                        | Review    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------- | --------------------------- | --------- |
| "Registers a webhook under your Onshape token, pointed back here, and lists what Onshape sends it. Deliveries are kept for a day; delete a probe to unregister it." | Description   | Top of the tab                  | Always                      | **⚑** New |
| "Onshape refused: {error}"                                                                                                                                          | Result        | Beside Register, and on a probe | Onshape refused the webhook |           |
| "{createdAt}: webhook {webhookId}" / "{createdAt}: not registered"                                                                                                  | Probe heading | Each probe                      | Always                      |           |
