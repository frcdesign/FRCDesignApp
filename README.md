# FRCDesignApp

This repo hosts the code for the FRCDesign Onshape App.

## Overview

The app itself lives in the `frontend` and `backend` folders. The app uses Python and flask for the backend and Vite and React for the frontend.
The app is deployed using Google Cloud App Engine, with Google Cloud Firestore as the database.

This repo is intended to be run with VSCode on Linux using WSL Ubuntu.
While it should be possible to use other technologies, they aren't tested and may require additional work to get running.

# Local Development Setup

First, create a new file in the root of this project named `.env` and add the following contents:

```
# Note: API changes won't take effect until you trigger a refresh on the server.
# The easiest way is to save backend/common/env.py again.

# Server config
API_BASE_PATH=https://cad.onshape.com
API_VERSION=12 # Control which version of the Onshape API the app uses

VERBOSE_LOGGING=true # Set to false to reduce logging output

# Onshape API Keys (Optional)
API_ACCESS_KEY=<Your API Access Key>
API_SECRET_KEY=<Your API Secret Key>

# OAuth
OAUTH_CLIENT_ID=<Your OAuth client id>
OAUTH_CLIENT_SECRET=<Your OAuth client secret>
SESSION_SECRET=literallyAnythingWillDo

# One of admin, member, or user, depending on desired access to the app. Does nothing in production.
ACCESS_LEVEL_OVERRIDE=admin

NODE_ENV=development
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

Warning: Unlike practically all other files, the Python development server will not automatically reload in response to changes to environment variables.
You can manually retrigger an update by saving any .py file or by killing and restarting the flask server.

## Python Setup

This project uses (uv)[https://github.com/astral-sh/uv] to manage Python.

Install `uv`:

```
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then use `uv` to install Python 3.12 and all of the project's dependencies:

```
uv python install 3.12
uv sync
```

Note that Python version 3.12 or greater is a hard requirement.

## Onshape OAuth App Setup

To test Onshape app changes, you will need to create an OAuth application in the [Onshape Developer Portal](https://cad.onshape.com/appstore/dev-portal/oauthApps). Fill out the following information:

-   Name: (Arbitrary) FRC Design App Test
-   Primary format: (Arbitrary) com.frc-design-app-test
-   Summary: (Arbitrary) Test for the FRC Design App.
-   Redirect URLs: `https://localhost:3000/redirect`
-   OAuth URL: `https://localhost:3000/sign-in`
-   Check the permissions `can read your profile information`, `can read your documents`, `can write to your documents`, and `can delete your documents and workspaces`.

Click Create application, then copy your OAuth app's OAuth client secret (in the popup) and OAuth client identifier into your `.env` file.

Next, add the necessary Extensions to your OAuth application so you can see it in documents you open:

1. Open your OAuth application in the [Onshape Developer Portal](https://cad.onshape.com/appstore/dev-portal/oauthApps).
2. Go to the Extensions tab.
3. Create two extensions with the following properties:
    - Name: (Arbitrary) FRC Design App Test
    - Location: Element right panel
    - Context: Inside assembly/Inside part studio
    - Action URL:
        - Assembly: `https://localhost:3000/app?elementType=ASSEMBLY&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}`
        - Part Studio: `https://localhost:3000/app?elementType=PARTSTUDIO&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}`
    - Icon: You'll need an arbitrary icon. You should be able to borrow one from `/frontend/src/assets/`.

You should now be able to see your App in the right panel of any Part Studios or Assemblies you open.

## Onshape API Key Setup (optional)

This step is only required if you want to use the Onshape API from local Python scripts using a KeyApi instance.

1. Get an API key from the [Onshape developer portal](https://cad.onshape.com/user/developer/apiKeys).
1. Add your access key and secret key to `.env`.

## Onshape API Limits

Note that Onshape has an annual limit of 2,500 API calls per Onshape account. This amount is not very large, so you should take pains to be careful with your usage in testing in local environments.

In particular, avoid loading large documents into your local environment and only reload the database when necessary.

## Flask Credentials Setup

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

## Frontend Setup

First, install npm in your WSL container:

```
sudo apt install npm
```

Next, use npm to install the dependencies in `frontend`:

```
cd frontend
npm install
```

## Google Cloud Dev Setup

Although this project uses Google Cloud Firestore, which is technically a distinct product from Google Firebase's Firestore, Google Cloud Firestore is still just Firebase's Firestore in a trenchcoat.

In order to emulate the google cloud database locally, you'll need to install the [Firebase CLI](https://firebase.google.com/docs/cli). In Linux, this can be done using:

```
curl -sL https://firebase.tools | bash
```

You may also need to install the Java JRE:

```
sudo apt install openjdk-21-jdk
```

You can then set up the Firebase emulator by running:

```
firebase init emulators firestore storage
```

If you are prompted to select a project, you can select **Don't set up a default project**.

## Development Servers

You should now be able to run the `Launch servers` VSCode task to launch the dev servers necessary to view and test the app.
If everything is setup properly, you should see all three servers start successfully.
You should also be able to launch the FRC Design App from the right panel of any Onshape Part Studio or Assembly and see the FRC Design App UI appear.

To see documents, add one or more documents and push a new app version to rebuild the search database.

Finally, you should also be able to launch the Firebase UI using the link in the VSCode Launch db window to see the current database state directly.

# Deploying To Production

To allow the App to connect to Firestore, the default compute service account must be given the Cloud Datastore User role in IAM.
You will need to add relevant environment variables in the google cloud console after you deploy. This includes the Onshape OAuth client and secret as well as the admin team.
