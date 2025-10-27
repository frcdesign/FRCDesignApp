import flask

from backend.common.connect import (
    get_api,
    get_body_arg,
    get_db,
    get_library_ref,
    get_query_param,
    get_route_library,
    library_route,
)
from backend.common.app_access import require_access_level
from backend.common.backend_exceptions import HandledException
from backend.endpoints.documents import clean_favorites, save_document
from backend.endpoints.preserved_info import PreservedInfo
from onshape_api.endpoints.documents import get_document
from onshape_api.endpoints.versions import get_latest_version_path
from onshape_api.paths.doc_path import DocumentPath


router = flask.Blueprint("document-order", __name__)


@router.post("/document-order" + library_route())
@require_access_level()
def set_document_order():
    library_ref = get_library_ref()
    new_document_order = get_body_arg("documentOrder")

    library_ref.documents.set_order(new_document_order)
    return {"success": True}


@router.post("/document" + library_route())
@require_access_level()
async def add_document():
    db = get_db()
    library = get_route_library()
    api = get_api(db)

    new_document_id = get_body_arg("newDocumentId")
    new_path = DocumentPath(new_document_id)
    # selected_document_id = connect.get_optional_body_arg("selectedDocumentId")

    try:
        document_name = get_document(api, new_path)["name"]
    except:
        raise HandledException("Failed to find the specified document.")

    try:
        latest_version = get_latest_version_path(api, new_path)
    except:
        raise HandledException("Failed to find a document version to use.")

    # documents = library_ref.documents()
    # if new_document_id in documents.keys():
    #     raise ClientException("Document has already been added.")

    await save_document(api, db.library_ref(library), latest_version, PreservedInfo())
    return {"name": document_name}


@router.delete("/document" + library_route())
@require_access_level()
def delete_document():
    library_ref = get_library_ref()

    document_id = get_query_param("documentId")

    library_ref.documents.delete(document_id)
    clean_favorites(library_ref)
    return {"Success": True}
