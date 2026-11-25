"""Select explicit character IDs and build a deduplicated SPR export queue."""
import argparse
import json
from pathlib import Path

def plan(data, ids):
    selected = [e for e in data['entries'] if e['id'] in ids]
    missing = sorted(set(ids) - {e['id'] for e in selected})
    if missing:
        raise ValueError(f'Missing entry IDs: {missing}')
    files = set()
    issues = []
    for e in selected:
        for a in e['actions']:
            if not a['countMatches']:
                issues.append([e['id'], a['id'], 'frame-count-mismatch'])
            for f in a['frames']:
                if not f.get('files'):
                    issues.append([e['id'], a['id'], 'unresolved-frame'])
                files.update(f.get('files', []))
    return {'entries': selected, 'files': sorted(files), 'issues': issues,
            'timingUnit': data['timingUnit']}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('ids', nargs='+', type=int)
    a = p.parse_args()
    result = plan(json.loads(a.manifest.read_text(encoding='utf-8')), a.ids)
    a.output.mkdir(parents=True, exist_ok=False)
    (a.output / 'plan.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    (a.output / 'names.txt').write_text('\n'.join(result['files'])+'\n', encoding='utf-8')

if __name__ == '__main__':
    main()
