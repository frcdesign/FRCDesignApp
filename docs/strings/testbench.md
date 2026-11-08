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

| String                                                                        | Kind              | Where                 | When                              | Review    |
| ----------------------------------------------------------------------------- | ----------------- | --------------------- | --------------------------------- | --------- |
| "Makes each call once and shows the rate-limit headers Onshape answers with." | Description       | Top of the tab        | Always                            | **⚑** New |
| "An Onshape url, copied from the address bar with the tab open."              | Field description | Part Studio, Assembly | Always                            | **⚑** New |
| "That url doesn't name a tab in a document."                                  | Field error       | Same                  | The url names no element          | **⚑** New |
| "Needs the url above"                                                         | Row note          | A call's row          | Its url isn't pasted              | **⚑** New |
| "No rate-limit headers; every header"                                         | Disclosure        | A checked row         | Onshape sent no limit-like header | **⚑** New |

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
