"""Catalog a local map bundle and run L1MapViewer on selected S32 maps."""
import argparse
from collections import Counter
from contextlib import nullcontext
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
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


def decode(source, output, viewer, ids, block_box=None, gui=False):
    if output.exists() and (output / 'viewer-input').exists():
        raise ValueError('Choose a new output directory for this run')
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
        root = output / 'viewer-input'
        root.mkdir()
        try:

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
                if not entry or not (entry['files']['s32'] or entry['files']['seg']):
                    row['reason'] = 'No S32 or SEG blocks found'
                    continue
                folder = root / 'map' / map_id
                folder.mkdir(parents=True)
                target = output / map_id
                target.mkdir(exist_ok=True)
                row.update(excludedSeg=len(entry['files']['seg']), ignoredBlocks=[],
                           selectedBlocks=[], selectedSeg=[], outsideRegion=0)
                try:
                    seg_folder = root / 'seg-collision' / map_id
                    seg_folder.mkdir(parents=True)
                    for name in entry['files']['s32'] + entry['files']['seg']:
                        filename = safe_path(name).name.lower()
                        if not re.fullmatch(r'[0-9a-f]{8}\.(s32|seg)', filename):
                            row['ignoredBlocks'].append(name)
                            continue
                        x, y = int(filename[:4], 16), int(filename[4:8], 16)
                        if block_box and not (block_box[0] <= x <= block_box[2] and block_box[1] <= y <= block_box[3]):
                            row['outsideRegion'] += 1
                            continue
                        is_seg = filename.endswith('.seg')
                        dest = (seg_folder if is_seg else folder) / filename
                        if dest.exists():
                            raise ValueError(f'Duplicate block: {filename}')
                        copy(name, dest)
                        row['selectedSeg' if is_seg else 'selectedBlocks'].append(filename)
                    if not (row['selectedBlocks'] or row['selectedSeg']):
                        row['reason'] = 'No standard blocks in selected region'
                        continue
                    errors = {}
                    jobs = []
                    if row['selectedBlocks']:
                        row['viewerFolder'] = folder.relative_to(output).as_posix()
                        jobs.append((folder, 'export-passability', 'passability.txt', ['--dir']))
                        if not gui:
                            jobs.append((folder, 'export-fullmap', 'map.png', ['--max-size', '4096']))
                    if row['selectedSeg']:
                        jobs.append((seg_folder, 'export-passability', 'seg-passability.txt', ['--dir']))
                    for job_folder, command, filename, flags in jobs:
                        artifact = target / filename
                        artifact.unlink(missing_ok=True)
                        log_path = target / (('seg-' if job_folder == seg_folder else '') + command + '.log')
                        try:
                            with log_path.open('wb') as log:
                                result = subprocess.run(
                                    [str(viewer), '-cli', command, str(job_folder), str(artifact), *flags],
                                    stdout=log, stderr=subprocess.STDOUT, timeout=900, check=False)
                            if result.returncode or not artifact.is_file() or artifact.stat().st_size == 0:
                                    errors[filename] = log_path.relative_to(output).as_posix()
                        except (OSError, subprocess.TimeoutExpired) as error:
                            errors[filename] = str(error)
                        if filename in errors:
                            artifact.unlink(missing_ok=True)
                    row['status'] = 'failed' if errors else 'exported'
                    if errors:
                        row['errors'] = errors
                    if gui and row['selectedBlocks']:
                        row['status'] = 'gui-required'
                        row['reason'] = 'PNG export uses the existing viewer GUI'
                    if 'map.png' in errors and (target / 'export-fullmap.log').is_file():
                        log_bytes = (target / 'export-fullmap.log').read_bytes()
                        if b'Platform instance is null' in log_bytes.replace(b'\x00', b''):
                            row['status'] = 'gui-required'
                            row['reason'] = 'Viewer CLI has no Eto platform; open viewer-input in the GUI'
                except (OSError, ValueError, KeyError) as error:
                    row.update(status='failed', reason=str(error))
        finally:
            (output / 'decode-report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--viewer', type=Path)
    parser.add_argument('--ids', nargs='+', default=['0', '4'])
    parser.add_argument('--gui', action='store_true', help='Use the viewer GUI for PNG exports')
    parser.add_argument('--block-box', nargs=4, metavar=('X_MIN', 'Y_MIN', 'X_MAX', 'Y_MAX'),
                        type=lambda value: int(value, 16), help='Inclusive hexadecimal chunk coordinates')
    args = parser.parse_args()
    box = args.block_box
    if box and not (0 <= box[0] <= box[2] <= 0xffff and 0 <= box[1] <= box[3] <= 0xffff):
        parser.error('Invalid block box')
    try:
        results = decode(args.source.resolve(), args.output.resolve(),
                         args.viewer.resolve() if args.viewer else None, args.ids, box, args.gui)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        parser.exit(2, str(error) + '\n')
    return int(any(row['status'] != 'exported' for row in results))


if __name__ == '__main__':
    raise SystemExit(main())
