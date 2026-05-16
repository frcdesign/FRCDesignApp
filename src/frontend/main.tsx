import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

const router = getRouter();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
