import flask


router = flask.Blueprint("search", __name__)


@router.get("/search")
def search(**kwargs):
    return {}
