import { createBrowserRouter } from "react-router-dom";
import { Root } from "./root";
import { App } from "./app/app";
import { PartStudio } from "./part-studio/part-studio";
import { GenerateAssembly } from "./part-studio/generate-assembly";
import { GrantDenied } from "./grant-denied";
import { Versions } from "./versions/versions";
import { PushVersion } from "./versions/push-version";
import { UpdateAllReferences } from "./versions/update-all-references";
import { Assembly } from "./assembly/assembly";
import { ManageLinks } from "./manage-links/manage-links";
import { loadLinks } from "./manage-links/link-loader";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <Root />,
        children: [
            {
                path: "app",
                element: <App />,
                children: [
                    {
                        path: "part-studio",
                        element: <PartStudio />,
                        children: [
                            {
                                path: "generate-assembly",
                                element: <GenerateAssembly />
                            }
                        ]
                    },
                    {
                        path: "assembly",
                        element: <Assembly />,
                        children: []
                    },
                    {
                        path: "versions",
                        element: <Versions />,
                        children: [
                            {
                                path: "manage-links",
                                element: <ManageLinks />,
                                loader: loadLinks
                            },
                            {
                                path: "push-version",
                                element: <PushVersion />
                            },
                            {
                                path: "update-all-references",
                                element: <UpdateAllReferences />
                            }
                        ]
                    }
                ]
            },
            {
                path: "grant-denied",
                element: <GrantDenied />
            }
        ]
    }
]);
