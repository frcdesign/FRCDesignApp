"""Reader for a Cloud Datastore export: LevelDB log blocks holding EntityProto.

Neither layer is in a library we have, so both are hand-rolled here. The record
framing is the LevelDB log format (32KiB blocks, 7-byte headers); the payloads
are the app-engine datastore v3 `EntityProto`, whose field numbers are fixed by
that (long-stable) schema and hardcoded below.
"""

import struct
from typing import Any, Iterator

BLOCK_SIZE = 32768
HEADER_SIZE = 7
FULL, FIRST, MIDDLE, LAST = 1, 2, 3, 4


def read_records(data: bytes) -> Iterator[bytes]:
    pos = 0
    pending = b""
    while pos + HEADER_SIZE <= len(data):
        block_left = BLOCK_SIZE - (pos % BLOCK_SIZE)
        if block_left < HEADER_SIZE:  # zero-padded block tail
            pos += block_left
            continue
        _crc, length, rtype = struct.unpack("<IHB", data[pos : pos + HEADER_SIZE])
        pos += HEADER_SIZE
        chunk = data[pos : pos + length]
        pos += length
        if rtype == FULL:
            yield chunk
        elif rtype == FIRST:
            pending = chunk
        elif rtype == MIDDLE:
            pending += chunk
        elif rtype == LAST:
            yield pending + chunk
            pending = b""


def _varint(buf: bytes, pos: int) -> tuple[int, int]:
    result = shift = 0
    while True:
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, pos
        shift += 7


def parse_fields(buf: bytes, start: int = 0, end: int | None = None) -> dict[int, list]:
    """Wire-level decode into {field number: [value, ...]}.

    Groups (wire type 3) are returned as their own nested dict, which the
    EntityProto schema needs: Path.Element and PropertyValue's point/user/ref
    values are all groups, not embedded messages.
    """
    end = len(buf) if end is None else end
    out: dict[int, list] = {}
    pos = start
    while pos < end:
        tag, pos = _varint(buf, pos)
        field, wire = tag >> 3, tag & 7
        if wire == 0:
            value, pos = _varint(buf, pos)
        elif wire == 1:
            value = struct.unpack("<d", buf[pos : pos + 8])[0]
            pos += 8
        elif wire == 2:
            length, pos = _varint(buf, pos)
            value = buf[pos : pos + length]
            pos += length
        elif wire == 3:
            depth, group_start = 1, pos
            while depth:
                t, pos = _varint(buf, pos)
                f, w = t >> 3, t & 7
                if w == 3:
                    depth += 1
                elif w == 4:
                    depth -= 1
                elif w == 0:
                    _, pos = _varint(buf, pos)
                elif w == 1:
                    pos += 8
                elif w == 2:
                    length, pos = _varint(buf, pos)
                    pos += length
            value = parse_fields(buf, group_start, pos - 1)
        elif wire == 5:
            value = struct.unpack("<f", buf[pos : pos + 4])[0]
            pos += 4
        else:  # end-group, consumed by the wire==3 branch above
            continue
        out.setdefault(field, []).append(value)
    return out


def _text(v: bytes) -> str:
    return v.decode("utf-8", "replace")


def _property_value(fields: dict[int, list], meaning: int = 0) -> Any:
    # meaning 19 (ENTITY_PROTO) wraps a whole EntityProto in the string value,
    # which is how a nested object (thumbnailUrls, fastenInfo, a token) is stored.
    if meaning == 19 and 3 in fields:
        return parse_entity(fields[3][0])["props"]
    if 1 in fields:
        return fields[1][0]
    if 2 in fields:
        return bool(fields[2][0])
    if 3 in fields:
        return _text(fields[3][0])
    if 4 in fields:
        return fields[4][0]
    if 12 in fields:  # ReferenceValue
        return {"__ref__": _path_from_ref(fields[12][0])}
    return None


def _path_elements(path: dict[int, list]) -> list[tuple[str, Any]]:
    out = []
    for el in path.get(1, []):
        kind = _text(el[2][0]) if 2 in el else ""
        ident = _text(el[4][0]) if 4 in el else el.get(3, [None])[0]
        out.append((kind, ident))
    return out


def _path_from_ref(ref: dict[int, list]) -> list[tuple[str, Any]]:
    # ReferenceValue inlines PathElement groups as field 14 rather than a Path.
    out = []
    for el in ref.get(14, []):
        kind = _text(el[15][0]) if 15 in el else ""
        ident = _text(el[17][0]) if 17 in el else el.get(16, [None])[0]
        out.append((kind, ident))
    return out


def parse_entity(buf: bytes) -> dict[str, Any]:
    top = parse_fields(buf)
    key = top[13][0] if 13 in top else {}
    key_fields = parse_fields(key) if isinstance(key, bytes) else key
    path = parse_fields(key_fields[14][0]) if 14 in key_fields else {}
    elements = _path_elements(path)

    props: dict[str, Any] = {}
    for field in (14, 15):  # property, raw_property
        for raw in top.get(field, []):
            p = parse_fields(raw)
            name = _text(p[3][0])
            meaning = p.get(1, [0])[0]
            value = (
                _property_value(parse_fields(p[5][0]), meaning) if 5 in p else None
            )
            multiple = bool(p.get(4, [0])[0])
            if multiple:
                props.setdefault(name, []).append(value)
            else:
                props[name] = value

    return {
        "kind": elements[-1][0] if elements else None,
        "id": elements[-1][1] if elements else None,
        "path": elements,
        "props": props,
    }


def iter_entities(paths) -> Iterator[dict[str, Any]]:
    for path in paths:
        with open(path, "rb") as f:
            data = f.read()
        for record in read_records(data):
            yield parse_entity(record)
