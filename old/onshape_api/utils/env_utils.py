# from logging import config
import dotenv


def load_env():
    """Loads the .env file from root.

    Throws if no variables are added."""
    if not dotenv.load_dotenv(override=True):
        raise ValueError("Failed to load .env file")
