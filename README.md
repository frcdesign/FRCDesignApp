# FRC Design App

This repo hosts the code for the FRC Design Onshape App.

## Overview

The app itself lives in the `frontend` and `backend` folders. The app uses Python and flask for the backend and Vite and React for the frontend.
The app is deployed using Google Cloud App Engine, with Google Cloud Firestore as the database.

This repo is intended to be run with VSCode on Linux using WSL Ubuntu.
While it should be possible to use other technologies, they aren't tested and may require additional work to get running.

# Local Development Setup

First, create a new file in the root of this project named `.env` and add the following contents:

```
# Server config
API_LOGGING=true # Enable or disable logging
API_BASE_PATH=https://cad.onshape.com
API_VERSION=11 # Control which version of the Onshape API the app uses

# API Keys (Optional)
API_ACCESS_KEY=<Your API Access Key>
API_SECRET_KEY=<Your API Secret Key>

# OAuth
OAUTH_CLIENT_ID=<Your OAuth client id>
OAUTH_CLIENT_SECRET=<Your OAuth client secret>
SESSION_SECRET=literallyAnythingWillDo

NODE_ENV=development
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

You only need API keys if you plan on accessing the Onshape API via regular python script.
You will likely need OAuth keys if you plan on accessing the Onshape API via the FRC Design App.

## Python Setup

This project uses (uv)[https://github.com/astral-sh/uv] to manage Python.

Install `uv`:

```
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then use `uv` to install Python 3.12:

```
uv python install 3.12
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
        - Part Studio: `https://localhost:3000/app?elementType=PART_STUDIO&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}`
    - Icon: You'll need an arbitrary icon. You should be able to borrow one from `/frontend/src/assets/`.

You should now be able to see your App in the right panel of any Part Studios or Assemblies you open.

## Onshape API Key Setup (Optional)

This isn't required for running the FRC Design App, but will allow you to use the Onshape API with API keys via locally developed Python scripts.

1. Get an API key from the [Onshape developer portal](https://dev-portal.onshape.com/keys).
1. Add your access key and secret key to `.env`.

You can then call `make_key_api()` inside a locally running Python script to get an `Api` instance you can pass to endpoints in `onshape_api/endpoints`.

## Flask Credentials Setup

Onshape requires all apps, even temporary test apps, to use https. This creates a big headache for local development.
In order to solve this issue, you'll need to generate a certificate and add it to a folder named `credentials` in the root of this project:

```
/credentials/cert.pem
/credentials/key.pem
```

This can be done automatically by running the script `make_credentials.sh`:

```
./scripts/make_credentials.sh
```

If successful, this should create a folder named `credentials` in the root of the project containing `cert.pem` and `key.pem`.

You'll then need to add a security exception to your browser to avoid getting blocked.
In Firefox, the procedure is:

1. Start the development servers using the `Launch servers` VSCode task.
2. Open Firefox and go to `Settings > Certificates > View Certificates... > Servers > Add Exception...`
3. Enter `https://localhost:3000` as the Location and click `Get Certificate`.
4. Check `Permanently store this exception` and then click `Confirm Security Exception`.

## Frontend Setup

Install Node.js on your computer, then use npm to install the dependencies in `frontend`:

```
cd frontend
npm install
```

## Google Cloud Dev Setup

To emulate the google cloud database locally, you'll need to install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install#deb).

You should also install the firestore emulator and a Java JRE:

```
sudo apt install google-cloud-cli-firestore-emulator default-jre
```

You can test your build by starting up the google cloud emulator:

```
gcloud emulators firestore start
```

<!-- Then restart the distro. This prevents google cloud from using the google cloud version located outside of WSL. -->

Note: this project uses Google Cloud Firestore as it's database. This is not to be confused with Google Firebase or Google Firebase's Firestore (yikes), as Google Firebase is a separate project from Google Cloud.

## Development Servers

You should now be able to run the `Launch servers` VSCode task to launch the dev servers necessary to view and test the app.
If everything is setup properly, you should see all three servers start successfully.
You should also be able to launch the FRC Design App from the right panel of any Onshape Part Studio or Assembly and see the FRC Design App UI appear.

# Deploying To Production

The FRC Design App can be deployed to production by running the script `./scripts/deploy.sh`.

Some notes:

-   To allow the App deployed in the App Engine to connect to Firestore, the App Engine service account must be given the Firestore user role in IAM.
-   You'll need to create an app.yaml file to deploy. A suitable app.yaml is:

```
runtime: python312

instance_class: F1

env_variables:
    API_VERSION: 11
    NODE_ENV: "production"
    OAUTH_CLIENT_ID: "<YOUR PRODUCTION OAUTH CLIENT ID IN QUOTES>"
    OAUTH_CLIENT_SECRET: "<YOUR PRODUCTION OAUTH CLIENT SECRET IN QUOTES>"
    SESSION_SECRET: "<AN ARBITRARY SECRET YOU MAKE UP>"

# Ran out of memory with F1 instance and 2 workers, so only 2 workers on F2
entrypoint: uv run gunicorn -b :8080 -w 2 -t 60 "backend.server:create_app()"
```
