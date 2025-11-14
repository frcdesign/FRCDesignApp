# See https://github.com/koxudaxi/datamodel-code-generator for additional information
uv run datamodel-codegen --url https://raw.githubusercontent.com/onshape-public/go-client/master/openapi.json \
    --input-file-type openapi \
    --output ./onshape_api/onshape_models.py \
    --target-python-version 3.12 \
    --output-model-type pydantic_v2.BaseModel \
    --openapi-scopes schemas \
    --use-union-operator \
    --use-standard-collections \
    --use-double-quotes \
    --disable-warnings \
    --field-constraints \
    --set-default-enum-member \
    --strict-types int float \
    --strict-nullable \
