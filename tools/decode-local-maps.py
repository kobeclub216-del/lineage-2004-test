"""Catalog a local map bundle and run L1MapViewer on selected S32 maps."""
import argparse
from collections import Counter
from contextlib import nullcontext
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tempfile
import zipfile

MANIFEST = 'local-map-bundle.json'


def safe_path(value):
    path = PurePosixPath(value)
    if not path.parts or path.is_absolute() or '..' in path.parts or ':' in value or '\\' in value:
        raise ValueError(f'Invalid bundle path: {value}')
    return path


def catalog(manifest):
    if manifest['schemaVersion'] != 1:
        raise ValueError('Unsupported bundle manifest version')
    groups = {}
    counts = Counter()
    unassigned = []
    for row in manifest['maps']:
        path = safe_path(row['path'])
        kind = path.suffix.lower()[1:]
        if kind not in {'s32', 'seg', 'map'}:
            continue
        counts[kind] += 1
        map_id = row['mapId']
        if map_id is None:
            if kind != 'map' or not re.fullmatch(r'[0-9]+', path.stem):
                unassigned.append(path.as_posix())
                continue
            map_id = path.stem
        if not isinstance(map_id, str) or not re.fullmatch(r'[0-9]+', map_id):
            raise ValueError(f'Invalid map ID: {map_id}')
        slot = groups.setdefault(map_id, {'s32': [], 'seg': [], 'map': []})
        slot[kind].append(path.as_posix())
    entries = {}
    for map_id, files in sorted(groups.items(), key=lambda item: int(item[0])):
        kinds = [kind for kind, paths in files.items() if paths]
        entries[map_id] = {'formats': kinds, 'clientVersion': None, 'files': files}
    return {'schemaVersion': 1, 'counts': dict(counts), 'maps': entries,
            'unassigned': unassigned, 'tilePairs': manifest['tilePairs']}


def decode(source, output, viewer, ids):
    output.mkdir(parents=True, exist_ok=True)
    if source.suffix.lower() == '.json' and viewer is None:
        inventory = catalog(json.loads(source.read_text(encoding='utf-8-sig')))
        (output / 'map-catalog.json').write_text(json.dumps(inventory, indent=2), encoding='utf-8')
        return []
    with (zipfile.ZipFile(source) if source.is_file() else nullcontext()) as archive:
        def read(name):
            path = safe_path(name)
            if archive:
                return archive.open(path.as_posix())
            local = source / path
            if not local.resolve().is_relative_to(source.resolve()):
                raise ValueError(f'File outside source: {name}')
            return local.open('rb')

        with read(MANIFEST) as stream:
            inventory = catalog(json.load(stream))
        (output / 'map-catalog.json').write_text(json.dumps(inventory, indent=2), encoding='utf-8')
        if viewer is None:
            return []
        if len(inventory['tilePairs']) != 1:
            raise ValueError('Exactly one Tile.idx/Tile.pak pair is required for decoding')
        results = []
        with tempfile.TemporaryDirectory(prefix='lineage-map-') as temp:
            root = Path(temp)

            def copy(name, dest):
                with read(name) as stream, dest.open('xb') as target:
                    shutil.copyfileobj(stream, target)

            pair = inventory['tilePairs'][0]
            copy(pair['idx'], root / 'Tile.idx')
            copy(pair['pak'], root / 'Tile.pak')
            for map_id in dict.fromkeys(ids):
                entry = inventory['maps'].get(map_id)
                row = {'mapId': map_id, 'status': 'skipped'}
                results.append(row)
                if not entry or not entry['files']['s32']:
                    row['reason'] = 'No S32 blocks supported by full-map renderer'
                    continue
                folder = root / 'map' / map_id
                folder.mkdir(parents=True)
                target = output / map_id
                target.mkdir(exist_ok=True)
                row['excludedSeg'] = len(entry['files']['seg'])
                try:
                    for name in entry['files']['s32']:
                        filename = safe_path(name).name.lower()
                        if not re.fullmatch(r'[0-9a-f]{8}\.s32', filename):
                            raise ValueError(f'Unsupported block name: {filename}')
                        copy(name, folder / filename)
                    for command, filename, flags in (
                        ('export-fullmap', 'map.png', ['--max-size', '4096']),
                        ('export-passability', 'passability.txt', ['--dir']),
                    ):
                        artifact = target / filename
                        artifact.unlink(missing_ok=True)
                        with (target / (command + '.log')).open('wb') as log:
                            result = subprocess.run(
                                [str(viewer), '-cli', command, str(folder), str(artifact), *flags],
                                stdout=log, stderr=subprocess.STDOUT, timeout=900, check=False)
                        if result.returncode or not artifact.is_file() or artifact.stat().st_size == 0:
                            raise ValueError(f'{command} failed, see log')
                    row['status'] = 'exported'
                except (OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
                    row.update(status='failed', reason=str(error))
        (output / 'decode-report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--viewer', type=Path)
    parser.add_argument('--ids', nargs='+', default=['0', '4'])
    args = parser.parse_args()
    try:
        results = decode(args.source.resolve(), args.output.resolve(),
                         args.viewer.resolve() if args.viewer else None, args.ids)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        parser.exit(2, str(error) + '\n')
    return int(any(row['status'] != 'exported' for row in results))


if __name__ == '__main__':
    raise SystemExit(main())
