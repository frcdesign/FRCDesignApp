# Previews and the Companion: strings

What [previews.md](../architecture/previews.md) shows a person. They're
messages in `src/frontend/messages/en.json`, keyed `companion…`. The
Companion's own name and description are in its manifest,
`src/extension/public/manifest.json`, which the Chrome Web Store and the
browser's extensions page show.

## The navbar

| String                | Kind    | Where                       | When                                                         | Review    |
| --------------------- | ------- | --------------------------- | ------------------------------------------------------------ | --------- |
| "Get the extension"   | Tooltip | The puzzle piece, top right | Inside Onshape, in Chrome, Edge or Opera, without it running | **⚑** New |
| "Extension connected" | Tooltip | The puzzle piece, green     | The Companion answered                                       | **⚑** New |

## After an insert

| String                                                                                       | Kind               | When                                                                                        | Review    |
| -------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- | --------- |
| "Tip: Get the FRCDesignApp Companion extension to preview Auto Assembly's parts in Onshape." | Tip toast          | A library insert or an Auto Assembly run started, once a load, three times, until connected | **⚑** New |
| "Get it"                                                                                     | Button, in the tip | With the tip                                                                                | **⚑** New |

## The Companion

| String                                                                                                           | Kind                  | Where                                     | When   | Review    |
| ---------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------- | ------ | --------- |
| "FRCDesignApp Companion"                                                                                         | Extension name        | The Chrome Web Store, the extensions page | Always | **⚑** New |
| "Gives FRCDesignApp additional functionality inside Onshape, such as previews of parts before they're inserted." | Extension description | The Chrome Web Store, the extensions page | Always | **⚑** New |
