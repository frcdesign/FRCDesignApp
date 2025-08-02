import os
import dotenv

dotenv.load_dotenv(override=True)

client_id = os.environ["OAUTH_CLIENT_ID"]
client_secret = os.environ["OAUTH_CLIENT_SECRET"]
session_secret = os.environ["SESSION_SECRET"]

is_production = os.getenv("NODE_ENV", "production") == "production"

# search_key = os.environ["ELASTICSEARCH_KEY"]
