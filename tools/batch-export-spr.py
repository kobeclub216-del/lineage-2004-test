"""Batch export local SPR frames using an independently installed PakViewer CLI."""
import argparse
import json
import re
import subprocess
from pathlib import Path

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('cli', type=Path)
    p.add_argument('source', type=Path)
    p.add_argument('names', type=Path, help='Text file: one SPR filename per line')
    p.add_argument('output', type=Path)
    a = p.parse_args()
    if not a.cli.is_file() or not a.source.exists():
        p.error('CLI or source not found')
    names = list(dict.fromkeys(n.strip() for n in a.names.read_text(encoding='utf-8-sig').splitlines() if n.strip()))
    if not names or any(not re.fullmatch(r'[0-9]+(?:-[0-9]+)*\.spr', n, re.I) for n in names):
        p.error('Expected numeric SPR filenames')
    a.output.mkdir(parents=True, exist_ok=False)
    report = []
    for name in names:
        dest = a.output / Path(name).stem
        dest.mkdir()
        command = [str(a.cli.resolve()), 'spr', 'export', str(a.source.resolve()), name, '-o', str(dest.resolve())]
        try:
            result = subprocess.run(command, capture_output=True, text=True, errors='replace', timeout=120)
            count = len(list(dest.glob('*.png')))
            status = 'exported' if result.returncode == 0 and count else 'failed'
            report.append(dict(name=name, status=status, frames=count, log=result.stdout, error=result.stderr))
        except (OSError, subprocess.TimeoutExpired) as exc:
            report.append(dict(name=name, status='failed', error=str(exc)))
        (a.output / 'export-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    return int(any(r['status'] != 'exported' for r in report))

if __name__ == '__main__':
    raise SystemExit(main())
