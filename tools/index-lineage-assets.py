"""Index local Lineage asset packs without extracting archives or publishing files."""

import argparse
import hashlib
import json
import struct
import zipfile
from pathlib import Path, PurePosixPath

FORMATS = {'.map', '.spr', '.png', '.webp', '.json', '.s32', '.seg', '.pak', '.idx'}
MAP_FORMATS = {'.map', '.s32', '.seg'}
CATEGORIES = {'character', 'monster', 'npc', 'map', 'item', 'interface'}
DIRECTIONS = {'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'}
LIMIT = 32 * 1024 ** 2


def safe_name(name):
    path = PurePosixPath(name)
    return bool(name and path.parts and not path.is_absolute() and
                '..' not in path.parts and '\\' not in name and ':' not in name)


def fingerprint_stream(stream):
    digest = hashlib.sha256()
    size = 0
    while True:
        chunk = stream.read(1024 * 1024)
        if not chunk:
            break
        digest.update(chunk)
        size += len(chunk)
    return {'sha256': digest.hexdigest(), 'bytes': size,
            'status': 'decoder-required'}


def inputs(path):
    if path.suffix.lower() == '.zip':
        with zipfile.ZipFile(path) as archive:
            names = set()
            for member in archive.infolist():
                if member.is_dir():
                    continue
                name = member.filename
                if not safe_name(name) or name in names:
                    raise ValueError(f'Unsafe or duplicate ZIP member: {name!r}')
                names.add(name)
                if Path(name).suffix.lower() in FORMATS:
                    if Path(name).suffix.lower() == '.pak':
                        with archive.open(member) as stream:
                            yield name, fingerprint_stream(stream)
                        continue
                    if member.file_size > LIMIT:
                        raise ValueError(f'File exceeds 32 MiB: {name}')
                    with archive.open(member) as stream:
                        yield name, stream.read(LIMIT + 1)
        return
    files = sorted(path.rglob('*')) if path.is_dir() else [path]
    for file in files:
        if file.is_symlink() or not file.is_file() or file.suffix.lower() not in FORMATS:
            continue
        name = file.relative_to(path).as_posix() if path.is_dir() else file.name
        if not safe_name(name):
            raise ValueError(f'Unsafe filename: {name!r}')
        if file.suffix.lower() == '.pak':
            with file.open('rb') as stream:
                yield name, fingerprint_stream(stream)
            continue
        if file.stat().st_size > LIMIT:
            raise ValueError(f'File exceeds 32 MiB: {file.name}')
        with file.open('rb') as stream:
            yield name, stream.read(LIMIT + 1)


def inspect_s32(raw):
    # l1j-client 83052f6, layout facts only. The object layer is not decoded.
    half_tiles = 64 * 64 * 2
    floor_bytes = half_tiles * 4
    if len(raw) < floor_bytes + 2:
        return {'status': 's32-truncated-prefix'}
    extra_count, = struct.unpack_from('<H', raw, floor_bytes)
    attributes_offset = floor_bytes + 2 + extra_count * 6
    objects_offset = attributes_offset + half_tiles * 2
    if len(raw) < objects_offset + 4:
        return {'status': 's32-truncated-prefix'}
    floor_ids = {value for value, in struct.iter_unpack('<I', raw[:floor_bytes])}
    attributes = {value for value, in struct.iter_unpack(
        '<H', raw[attributes_offset:objects_offset])}
    return {
        'status': 's32-prefix-read',
        'map': {'tilesWide': 64, 'tilesHigh': 64, 'halfTilesPerTile': 2,
                'distinctFloorValues': len(floor_ids),
                'distinctAttributeValues': len(attributes),
                'unknownRecordCount': extra_count,
                'declaredObjectCount': struct.unpack_from('<I', raw, objects_offset)[0]},
    }


def inspect_idx(raw):
    if len(raw) < 4:
        return {'status': 'idx-invalid-length'}
    count, = struct.unpack_from('<I', raw)
    if len(raw) != 4 + count * 28:
        return {'status': 'idx-unsupported-layout'}
    extensions = {}
    end = 0
    for offset, name, size in struct.iter_unpack('<I20sI', raw[4:]):
        name = name.split(b'\0', 1)[0].decode('ascii', errors='replace')
        ext = PurePosixPath(name).suffix.lower() or '(none)'
        extensions[ext] = extensions.get(ext, 0) + 1
        end = max(end, offset + size)
    return {'status': 'idx-layout-read', 'index': {
        'entryCount': count, 'requiredPakBytes': end,
        'extensions': extensions}}


def inspect(name, raw):
    if len(raw) > LIMIT:
        raise ValueError(f'File exceeds 32 MiB: {name}')
    ext = Path(name).suffix.lower()
    if ext == '.idx':
        return inspect_idx(raw)
    if ext == '.s32':
        return inspect_s32(raw)
    if ext == '.png':
        if (len(raw) < 33 or raw[:8] != b'\x89PNG\r\n\x1a\n' or
                raw[8:16] != b'\x00\x00\x00\rIHDR'):
            return {'status': 'invalid-png'}
        width, height = struct.unpack('>II', raw[16:24])
        if not width or not height:
            return {'status': 'invalid-png'}
        return {'status': 'png-header-read', 'width': width, 'height': height}
    if ext == '.json':
        try:
            json.loads(raw)
        except (ValueError, UnicodeError):
            return {'status': 'invalid-json'}
        return {'status': 'json-parsed'}
    return {'status': 'decoder-required'}


def metadata(info, digest, shape):
    if not info:
        return {}
    if info.get('sha256') != digest or info.get('category') not in CATEGORIES:
        raise ValueError('Metadata requires matching SHA-256 and a supported category')
    for field in ('source', 'version', 'rights'):
        if not isinstance(info.get(field), str) or not info[field].strip():
            raise ValueError(f'Metadata requires {field}')
    clips = info.get('animations', {})
    if not isinstance(clips, dict):
        raise ValueError('Animations must be an object')
    for clip, directions in clips.items():
        if not isinstance(directions, dict) or not directions or not directions.keys() <= DIRECTIONS:
            raise ValueError(f'Invalid directions for {clip}')
        for frames in directions.values():
            if not isinstance(frames, list) or not frames:
                raise ValueError(f'Empty frames for {clip}')
            for frame in frames:
                keys = ('x', 'y', 'width', 'height', 'ms')
                if not isinstance(frame, dict) or any(type(frame.get(k)) is not int for k in keys):
                    raise ValueError(f'Invalid frame for {clip}')
                x, y, w, h, ms = (frame[k] for k in keys)
                if (min(x, y) < 0 or min(w, h, ms) < 1 or
                        x+w > shape.get('width', 0) or y+h > shape.get('height', 0)):
                    raise ValueError(f'Frame exceeds atlas or has invalid time: {clip}')
    return {field: info[field] for field in ('category', 'source', 'version', 'rights')} | {'animations': clips}


def build(paths, annotations, existing):
    records = {}
    for path in paths:
        for name, raw in inputs(path):
            if isinstance(raw, dict):
                digest = raw['sha256']
                size = raw['bytes']
                shape = {'status': raw['status']}
            else:
                digest = hashlib.sha256(raw).hexdigest()
                size = len(raw)
                shape = inspect(name, raw)
            record = records.setdefault(digest, {
                'sha256': digest, 'bytes': size, 'locations': [],
                'category': 'map' if Path(name).suffix.lower() in MAP_FORMATS else 'unclassified',
                'alreadyIndexed': digest in existing, **shape
            })
            record['locations'].append({'input': str(path), 'member': name})
            record.update(metadata(annotations.get(digest), digest, shape))
    return {'schemaVersion': 1, 'assets': list(records.values())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputs', nargs='+', type=Path)
    parser.add_argument('--metadata', type=Path, help='JSON object keyed by asset SHA-256')
    parser.add_argument('--existing', type=Path, help='Existing manifest.json used for deduplication')
    args = parser.parse_args()
    try:
        for source in args.inputs:
            if not source.exists():
                raise ValueError(f'Input not found: {source}')
        annotations = json.loads(args.metadata.read_text(encoding='utf-8')) if args.metadata else {}
        known = json.loads(args.existing.read_text(encoding='utf-8'))['assets'] if args.existing else []
        print(json.dumps(build(args.inputs, annotations, {item['sha256'] for item in known}),
                         ensure_ascii=True, indent=2))
    except (OSError, ValueError, KeyError, TypeError, RuntimeError, zipfile.BadZipFile) as error:
        parser.exit(2, f'{error}\n')


if __name__ == '__main__':
    main()
