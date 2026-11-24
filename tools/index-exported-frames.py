"""Index exported PNG frames locally, without guessing animation semantics."""
import argparse
import hashlib
import json
import struct
from pathlib import Path

def scan(root):
    records = []
    for path in sorted(root.rglob('*')):
        if path.is_symlink() or not path.is_file() or path.suffix.lower() != '.png':
            continue
        with path.open('rb') as stream:
            header = stream.read(33)
            if len(header) != 33 or header[:16] != b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR':
                raise ValueError('Invalid PNG header: ' + str(path))
            width, height = struct.unpack('>II', header[16:24])
            if not width or not height:
                raise ValueError('Invalid dimensions: ' + str(path))
            digest = hashlib.sha256(header)
            for chunk in iter(lambda: stream.read(1024**2), b''):
                digest.update(chunk)
        records.append({'path': path.relative_to(root).as_posix(),
                        'group': path.parent.relative_to(root).as_posix(),
                        'width': width, 'height': height,
                        'sha256': digest.hexdigest(),
                        'animationStatus': 'unassigned'})
    return {'schemaVersion': 1, 'frames': records}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if not args.directory.is_dir():
        parser.error('Input directory does not exist')
    try:
        result = scan(args.directory)
        with args.output.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, indent=2, ensure_ascii=False)
    except (OSError, ValueError) as exc:
        parser.exit(2, str(exc) + '\n')

if __name__ == '__main__':
    main()
