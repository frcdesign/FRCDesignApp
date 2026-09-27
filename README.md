# FRCDesignApp

This repo hosts the code for the FRCDesign Onshape App, which lets users browse
the FRCDesign part libraries and insert parts into their documents.

The app is a Cloudflare Worker (`src/backend`) serving an API and a React SPA
(`src/frontend`), which runs both in Onshape's element right panel and directly
in a browser. See `AGENTS.md` for how `src` is laid out.

## Overview

This repo is intended to be run with VSCode on Linux using WSL Ubuntu.

The local dev environment typically needs either Google Chrome or Firefox to work correctly with Onshape.

_Other browsers, such as Brave, can have default security policies that prevent the dev environment from working with Onshape._

# Local Development Setup

Create a new file in the root of this project named `.env` and add the following contents:

```
# Server config
VERBOSE_LOGGING=true # Set to false to reduce logging output

# Onshape API Keys (Optional)
API_ACCESS_KEY=<Your API Access Key>
API_SECRET_KEY=<Your API Secret Key>

# OAuth
OAUTH_CLIENT_ID=<Your OAuth client id>
OAUTH_CLIENT_SECRET=<Your OAuth client secret>

# One of admin, editor, or user. Granted by the server and viewed by the client,
# so both sides agree. Ignored in production.
VITE_ACCESS_LEVEL_OVERRIDE=admin

# Signs you in as a fake user, so signed-in UI can be tested without an Onshape
# session. Onshape calls it reveals won't work, so leave it unset normally.
FORCE_SIGNED_IN=false
```

## Onshape OAuth App Setup

To test Onshape app changes, you will need to create an OAuth application in the [Onshape Developer Portal](https://cad.onshape.com/appstore/dev-portal/oauthApps). Fill out the following information:

- Name: (Arbitrary) FRC Design App Test
- Primary format: (Arbitrary) com.frc-design-app.dev
- Summary: (Arbitrary) Test for the FRC Design App.
- Redirect URLs: `https://<your hostname>/auth/callback`
- OAuth URL: `https://<your hostname>/auth/sign-in`
- Check the permissions `can read your profile information`, `can read your documents`, `can write to your documents`, and `can delete your documents and workspaces`.

Click Create application, then copy your OAuth app's OAuth client secret (from the popup) and OAuth client identifier into your `.env` file.

Next, add the necessary Extensions to your OAuth application so you can see it in documents you open:

1. Open your OAuth application in the [Onshape Developer Portal](https://cad.onshape.com/appstore/dev-portal/oauthApps).
2. Go to the Extensions tab.
3. Create two extensions with the following properties:
    - Name: (Arbitrary) FRC Design App Test
    - Location: Element right panel
    - Context: Inside assembly/Inside part studio
    - Action URL:
        - Assembly: `https://<your hostname>/init?elementType=ASSEMBLY&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}`
        - Part Studio: `https://<your hostname>/init?elementType=PARTSTUDIO&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}`
    - Icon: You'll need an icon. A good choice is the one at `/public/frc-design-app-dev.svg`.
4. Open the [Onshape App Store](https://cad.onshape.com/appstore/myapps) and go to My apps. Find your App and Subscribe to it.
    - If it doesn't show up, try creating a Store Entry first.

You should now be able to see your Test App in the right panel of any Part Studios or Assemblies you open.

## Onshape API Key Setup (optional)

This step is only required if you want to use the Onshape API from local Python scripts using a KeyApi instance.

1. Get an API key from the [Onshape developer portal](https://cad.onshape.com/user/developer/apiKeys).
1. Add your access key and secret key to `.env`.

## Onshape API Limits

Note that Onshape has an annual limit of 2,500 API calls per Onshape account. This amount is not very large, so you should take pains to be careful with your usage in testing in local environments.

In particular, avoid loading large documents into your local environment and only force reload the database when necessary.

## Tunnel Setup

Onshape loads the app over https and delivers webhooks from its own servers, so the dev server needs a public https url. A [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) gives it a fixed hostname, so the urls in your Onshape OAuth app are set once. It needs a domain on your Cloudflare account; the hostname can be any subdomain of it, such as `frc-design-dev.example.com`.

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).
1. Create the tunnel and point your hostname at it, once:

```
cloudflared tunnel login
cloudflared tunnel create frc-design-app-dev
cloudflared tunnel route dns frc-design-app-dev <your hostname>
```

1. Add your hostname to `.env`, so Vite accepts requests for it:

```
DEV_HOSTNAME=<your hostname>
```

`npm run tunnel` runs the tunnel next to `npm run dev`; the `Launch servers` VSCode task starts both. Open the app at `https://<your hostname>`.

## VSCode Setup

Install nvm (node version manager) in your WSL container, install npm, and then install the dependencies:

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash
nvm i node
npm i
```

## Development Servers

You should now be able to run the `Launch servers` VSCode task to launch Vite and the tunnel.
You should then be able to launch the FRC Design App from the right panel of any Onshape Part Studio or Assembly and see the FRC Design App UI appear.

To see documents, add one or more documents and push a new app version to rebuild the search database.
Alternatively, import a dump of the loaded cert database into local D1, and (optionally) its thumbnails into local R2:

```
npx wrangler d1 execute DB --local --file=<cert-dump>.sql
npx wrangler r2 object put frc-design-app-dev-thumbnails/thumbnails/<size>/<elementId> --file=<thumb>.gif
```

To view the state of Cloudflare, type `e` in Vite to launch the local Cloudflare UI instance.

# Troubleshooting

## Onshape fails to load

Double check your Action URLs configured in Onshape. You can also open Browser Dev Tools (usually F12), then open the app in Onshape and see if any errors or warnings appear in the Console or the Network tab.

## Port Taken/Not Available

Occasionally, a process will fail to fully shut down, causing problems when you next attempt to `Launch servers` since the port is already taken.
If a process fails to start because a port is already taken, you can kill the process squatting on the port by running `lsof -i :<port number>`, e.g., `lsof -i :3000`, to get the PID of the process.
You can then kill the process using `kill <PID>` (or, possibly, `kill -9 <PID>`).
