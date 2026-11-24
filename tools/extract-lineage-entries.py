"""Extract explicitly selected local IDX/PAK entries; no decoding or upload."""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path

def extract(idx, pak, out, names):
    raw = idx.read_bytes()
    if len(raw) < 4 or len(raw) != 4 + 28 * struct.unpack_from('<I', raw)[0]:
        raise ValueError('Unsupported IDX layout')
    entries = {}
    capacity = pak.stat().st_size
    for offset, field, size in struct.iter_unpack('<I20sI', raw[4:]):
        name = field.split(b'\0', 1)[0].decode('ascii', errors='replace')
        if offset + size > capacity:
            raise ValueError('IDX exceeds PAK capacity')
        if name in entries:
            raise ValueError('Duplicate IDX name: ' + name)
        entries[name] = (offset, size)
    if idx.stem.casefold() != pak.stem.casefold():
        raise ValueError('IDX and PAK names do not match')
    for name in names:
        if not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9]+', name) or name not in entries:
            raise ValueError('Invalid or missing resource: ' + name)
        if entries[name][1] > 32 * 1024**2:
            raise ValueError('Selected entry exceeds 32 MiB')
    out.mkdir(parents=True, exist_ok=False)
    report = []
    with pak.open('rb') as stream:
        for name in dict.fromkeys(names):
            offset, size = entries[name]
            stream.seek(offset)
            data = stream.read(size)
            if len(data) != size:
                raise ValueError('Truncated resource: ' + name)
            with (out / name).open('xb') as target:
                target.write(data)
            report.append(dict(name=name, offset=offset, size=size,
                               sha256=hashlib.sha256(data).hexdigest()))
    (out / 'manifest.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('idx', type=Path)
    parser.add_argument('pak', type=Path)
    parser.add_argument('out', type=Path)
    parser.add_argument('names', nargs='+')
    args = parser.parse_args()
    try:
        extract(args.idx, args.pak, args.out, args.names)
    except (ValueError, OSError) as exc:
        parser.exit(2, str(exc) + '\n')

if __name__ == '__main__':
    main()
