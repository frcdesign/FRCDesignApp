// import { doCallback, doSignIn } from "./auth/auth";

import { app } from "./app";

// app.get("/auth/callback", (c) => {
//   return c.text("Ahhh");
// });

export default app;

// export default {
//   fetch(request) {
//     const url = new URL(request.url);

//     if (url.pathname.startsWith("/api/")) {
//       return Response.json({
//         name: "Cloudflare",
//       });
//     } else if (url.pathname.startsWith("/auth/callback")) {
//       const redirectUrl = doCallback(request);
//       // return redirect({ href: redirectUrl });
//     } else if (url.pathname.startsWith("/auth/sign-in")) {
//       const redirectUrl = doSignIn(url.href);
//     }

//     return new Response(null, { status: 404 });
//   },
// } satisfies ExportedHandler<Env>;
