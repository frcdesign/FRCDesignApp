import os
import dotenv

dotenv.load_dotenv(override=True)

CLIENT_ID = os.environ["OAUTH_CLIENT_ID"]
CLIENT_SECRET = os.environ["OAUTH_CLIENT_SECRET"]
SESSION_SECRET = os.environ["SESSION_SECRET"]

IS_PRODUCTION = os.getenv("NODE_ENV", "production") == "production"

VERBOSE_LOGGING = os.getenv("VERBOSE_LOGGING", "false").lower() == "true"

ACCESS_LEVEL_OVERRIDE = None if IS_PRODUCTION else os.getenv("ACCESS_LEVEL_OVERRIDE")
ADMIN_TEAM = os.getenv("ADMIN_TEAM")
