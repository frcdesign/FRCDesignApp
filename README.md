# FRCDesignApp

This repo hosts the code for the FRCDesign Onshape App.

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
SESSION_SECRET=gNSzdRbs4dJYz0obHfeRwaD+u5QbZgJx+V8/rgUH6AiOdoppP3wjeaM97nZmxeJa

# One of admin, editor, or user. Sets the max access level granted. Does nothing in production.
ACCESS_LEVEL_OVERRIDE=admin

# One of admin, editor, or user. The level the app is viewed as by default (client-side).
VITE_DEFAULT_ACCESS_LEVEL=admin
```

## Onshape OAuth App Setup

To test Onshape app changes, you will need to create an OAuth application in the [Onshape Developer Portal](https://cad.onshape.com/appstore/dev-portal/oauthApps). Fill out the following information:

- Name: (Arbitrary) FRC Design App Test
- Primary format: (Arbitrary) com.frc-design-app.dev
- Summary: (Arbitrary) Test for the FRC Design App.
- Redirect URLs: `https://localhost:3000/auth/callback`
- OAuth URL: `https://localhost:3000/auth/sign-in`
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
        - Assembly: `https://localhost:3000/init?elementType=ASSEMBLY&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}`
        - Part Studio: `https://localhost:3000/init?elementType=PARTSTUDIO&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}`
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

## HTTPS Setup

Onshape requires all apps, even temporary test apps, to use https. This creates a big headache for local development.

You can get around this by using [mkcert](https://github.com/FiloSottile/mkcert) to create a self signed certificate which your browser will trust.

1. Install mkcert on your local machine (not in the dev container!).
   If you are on Windows, this will likely mean installing [Chocolately](https://chocolatey.org/install) and running `choco install mkcert` using a Powershell terminal you run as an Administrator.
1. Create a local Certificate Authority (CA):

```
mkcert -install
```

1. Create a localhost certificate (localhost-key.pem and localhost.pem) and copy them into the root of this project:

```
cd ~ # Switch to your user directory
cd Documents # Switch to the Documents folder - you can also use any other folder you recognize, like Downloads
mkcert localhost # Create a certificate which allows localhost to run
```

1. You can then open your Documents folder in File Explorer and copy and paste `localhost-key.pem` and `localhost.pem` into the root of this project.

If you use a chromium-based browser like Google Chrome, MKCert should install the certificate automatically.
If it doesn't, you'll need to add the Certificate Authority manually. In Firefox, the procedure is:

1. In PowerShell, run `mkcert -CAROOT` and note down the path.
1. Open Firefox and go to `Settings > Certificates > View Certificates... > Authorities > Import...`
1. Navigate to the `CAROOT` path and select `rootCA.pem`.

## VSCode Setup

Install nvm (node version manager) in your WSL container, install npm, and then install the dependencies:

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash
nvm i node
npm i
```

## Development Servers

You should now be able to run the `Launch dev` VSCode task to launch Vite.
You should then be able to launch the FRC Design App from the right panel of any Onshape Part Studio or Assembly and see the FRC Design App UI appear.

To see documents, add one or more documents and push a new app version to rebuild the search database.

To view the state of Cloudflare, type `e` in Vite to launch the local Cloudflare UI instance.

## Standalone (not-signed-in) mode

The app also runs without an Onshape login. Opening it directly (e.g.
`https://localhost:3000/`, rather than launching it from the Onshape panel)
serves the read-only library UI: browse groups, search, and open the
configuration menu. Anything that needs Onshape — inserting/deriving, favorites,
saving settings server-side, and live configuration previews — is hidden and
guarded server-side behind sign-in. Settings (theme/library) fall back to
`localStorage`, and the configuration menu uses default units and the stored
(static) thumbnail.

This needs a populated database. Import a dump of the loaded cert DB into local
D1, and (optionally) its thumbnails into local R2:

```
npx wrangler d1 execute DB --local --file=<cert-dump>.sql
npx wrangler r2 object put frc-design-app-dev-thumbnails/thumbnails/<size>/<elementId> --file=<thumb>.gif
```

To exercise the signed-in-only UI (favorites, insert button) without a real
Onshape session, set `FORCE_SIGNED_IN=true` in your `.env`. This is a
testing-only escape hatch — it uses a fake user id and Onshape calls it reveals
won't actually work, so leave it unset normally. Combine with
`ACCESS_LEVEL_OVERRIDE=admin` to also show editor/admin controls.

# Troubleshooting

## Onshape fails to load

Double check your Action URLs configured in Onshape. You can also open Browser Dev Tools (usually F12), then open the app in Onshape and see if any errors or warnings appear in the Console or the Network tab.

## Port Taken/Not Available

Occasionally, a process will fail to fully shut down, causing problems when you next attempt to `Launch servers` since the port is already taken.
If a process fails to start because a port is already taken, you can kill the process squatting on the port by running `lsof -i :<port number>`, e.g., `lsof -i :3000`, to get the PID of the process.
You can then kill the process using `kill <PID>` (or, possibly, `kill -9 <PID>`).
