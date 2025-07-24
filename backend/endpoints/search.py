import flask

from backend.common.connect import get_query_arg
from backend.common.search import Search, get_search_client


router = flask.Blueprint("search", __name__)


@router.get("/search")
def search(**kwargs):
    client = get_search_client()
    search = Search(client)
    query = get_query_arg("query")
    result = search.search_home(query)
    return {"elements": result}
