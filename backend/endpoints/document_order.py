import flask

from backend.common import connect
from backend.common.app_access import require_member_access
from backend.common.backend_exceptions import ClientException
from backend.endpoints.reload_documents import save_document
from onshape_api.endpoints.documents import get_document
from onshape_api.endpoints.versions import get_latest_version_path
from onshape_api.paths.doc_path import DocumentPath


router = flask.Blueprint("document-order", __name__)


@router.get("/document-order")
def get_document_order():
    db = connect.get_db()
    return {"documentOrder": db.get_document_order()}


@router.post("/document-order")
@require_member_access()
def set_document_order():
    db = connect.get_db()
    new_document_order = connect.get_body_arg("documentOrder")
    db.set_document_order(new_document_order)
    return {"success": True}


@router.post("/document")
@require_member_access()
def add_document():
    db = connect.get_db()
    api = connect.get_api(db)

    new_document_id = connect.get_body_arg("newDocumentId")
    new_path = DocumentPath(new_document_id)
    selected_document_id = connect.get_body_arg("selectedDocumentId")

    try:
        document_name = get_document(api, new_path)["name"]
    except:
        raise ClientException("Failed to find a document to use.")

    try:
        latest_version = get_latest_version_path(api, new_path)
    except:
        raise ClientException("Failed to find a document version to use.")

    order = db.get_document_order()
    try:
        index = order.index(selected_document_id)
        # Append after selected_document_id
        order.insert(index + 1, new_document_id)
    except ValueError:
        order.append(new_document_id)

    db.set_document_order(order)
    save_document(api, db, latest_version)

    return {"name": document_name}


@router.delete("/document")
@require_member_access()
def delete_document():
    db = connect.get_db()

    document_id = connect.get_query_param("documentId")

    order = db.get_document_order()
    index = order.index(document_id)
    order.pop(index)
    db.set_document_order(order)
    db.delete_document(document_id)
    return {"Success": True}
