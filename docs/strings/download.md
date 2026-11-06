# Downloads: strings

What [download.md](../architecture/download.md) shows someone using the
standalone app. Every string is a message in `src/frontend/messages/en.json`,
keyed `downloadStep…`.

## Insert menu

| String                                                          | Kind          | Where                    | When                                         | Review    |
| --------------------------------------------------------------- | ------------- | ------------------------ | -------------------------------------------- | --------- |
| "Download STEP"                                                 | Button        | The insert menu's footer | Standalone, signed in                        | **⚑** New |
| "Sign in to download"                                           | Button        | Same                     | Standalone, signed out; starts sign-in       | **⚑** New |
| "Exporting {name} from Onshape..."                              | Loading toast |                          | From the click until the file is ready       | **⚑** New |
| "Downloaded {name}."                                            | Success toast |                          | The browser was handed the file              | **⚑** New |
| "Onshape couldn't export {name}."                               | Error toast   |                          | Onshape failed the translation               | **⚑** New |
| "Onshape is taking too long to export {name}. Try again later." | Error toast   |                          | Still exporting after five minutes           | **⚑** New |
| "Unexpectedly failed to download {name}."                       | Error toast   |                          | Any other failure without wording of its own | **⚑** New |
