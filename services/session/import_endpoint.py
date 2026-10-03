import pickle
from flask import Blueprint, request

session_import = Blueprint("session_import", __name__)

@session_import.route("/api/sessions/import", methods=["POST"])
def import_session():
    snapshot = pickle.loads(request.get_data())
    return {"session_id": snapshot["session_id"]}
