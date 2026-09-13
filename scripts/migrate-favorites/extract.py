"""Pulls the favorites out of the legacy Datastore export into one JSON file.

Step one of the favorites migration; `build-sql.ts` turns what this writes into
D1 statements. Split in two because only Python can read the export's LevelDB
framing, and only TypeScript can canonicalize a selection the way the app does.

    python3 scripts/migrate-favorites/extract.py db-export out/favorites.json

A legacy favorite is addressed by its key path alone —
`libraries/<library>/library-user-data/<user>/favorites/<element>` — and carries
nothing but the configuration it opens with. Display order lives apart from it,
in the owning `library-user-data` row's `favoriteOrder`.
"""

import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import datastore


def extract(export_dir: str) -> dict:
    files = sorted(glob.glob(f"{export_dir}/all_namespaces/all_kinds/output-*"))
    if not files:
        raise SystemExit(f"no export output files under {export_dir}")

    favorites = []
    favorite_order = {}
    user_library = {}
    for entity in datastore.iter_entities(files):
        kind, path, props = entity["kind"], entity["path"], entity["props"]
        if kind == "favorites":
            favorites.append(
                {
                    "libraryId": path[0][1],
                    "userId": path[1][1],
                    "elementId": path[2][1],
                    "configuration": props.get("defaultConfiguration"),
                }
            )
        elif kind == "library-user-data":
            favorite_order[f"{path[0][1]}|{path[1][1]}"] = (
                props.get("favoriteOrder") or []
            )
        elif kind == "user-data":
            library = (props.get("settings") or {}).get("library")
            if library:
                user_library[path[0][1]] = library

    return {
        "favorites": favorites,
        "favoriteOrder": favorite_order,
        "userLibrary": user_library,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    export_dir, out_path = sys.argv[1], sys.argv[2]
    data = extract(export_dir)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(data, f)
    print(
        f"{len(data['favorites'])} favorites, "
        f"{len(data['favoriteOrder'])} order rows, "
        f"{len(data['userLibrary'])} known user libraries -> {out_path}"
    )
