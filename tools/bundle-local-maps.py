"""Collect local map segments and paired tile archives in one private ZIP."""
import argparse
import json
import os
from pathlib import Path
import tempfile
import zipfile

MAP_EXTENSIONS = {'.s32', '.seg', '.map'}


def bundle(source, output, map_ids=()):
    source, output = source.resolve(), output.resolve()
    if not source.is_dir() or output.is_relative_to(source):
        raise ValueError('Choose a client directory and an output outside it')
    maps, tiles = [], {}
    for path in sorted(source.rglob('*')):
        if path.is_symlink() or not path.is_file():
            continue
        relative = path.relative_to(source)
        if path.name.lower() in {'tile.idx', 'tile.pak'}:
            tiles.setdefault(relative.parent, {})[path.suffix.lower()] = relative
        elif path.suffix.lower() in MAP_EXTENSIONS:
            map_id = relative.parent.name if relative.parent.name.isdecimal() else None
            if not map_ids or map_id in map_ids:
                maps.append((relative, map_id))
    if not maps:
        raise ValueError('No loose MAP, S32 or SEG files matched')
    pairs = [pair for pair in tiles.values() if pair.keys() == {'.idx', '.pak'}]
    manifest = {
        'schemaVersion': 1,
        'maps': [{'path': path.as_posix(), 'mapId': map_id} for path, map_id in maps],
        'tilePairs': [{key[1:]: path.as_posix() for key, path in pair.items()} for pair in pairs],
        'unpairedTiles': [path.as_posix() for pair in tiles.values() if pair not in pairs
                          for path in pair.values()],
    }
    fd, temporary = tempfile.mkstemp(dir=output.parent, suffix='.zip')
    os.close(fd)
    try:
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_STORED) as archive:
            for relative in [path for path, _ in maps] + [p for pair in pairs for p in pair.values()]:
                archive.write(source / relative, relative.as_posix())
            archive.writestr('local-map-bundle.json', json.dumps(manifest, indent=2))
        os.replace(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('map_ids', nargs='*')
    args = parser.parse_args()
    try:
        result = bundle(args.source, args.output, args.map_ids)
    except (OSError, ValueError) as error:
        parser.exit(2, str(error) + '\n')
    print(f"Collected {len(result['maps'])} map files and {len(result['tilePairs'])} tile pairs")


if __name__ == '__main__':
    main()
