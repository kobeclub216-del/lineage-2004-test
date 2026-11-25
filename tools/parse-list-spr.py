"""Parse local list.spr animation definitions without guessing timing units."""
import argparse
import json
import re
from pathlib import Path

HEADER = re.compile(r'^#(\d+)\s+(\d+)(?:=(\d+))?\s*(.*)')
ACTION = re.compile(r'(\d+)\.([^()\r\n]+)\(([01])\s+(\d+)\s*,([^()]*)\)')
FRAME = re.compile(r'(-?\d+)\.(\d+):(\d+)([!<>\[\]0-9]*)')

def parse(text):
    entries = []
    for block in re.split(r'(?m)(?=^#\d+\s)', text):
        h = HEADER.match(block)
        if not h:
            continue
        ident, count, linked, tail = h.groups()
        sprite = int(linked or ident)
        actions = []
        for a in ACTION.finditer(block):
            number, name, directional, expected, body = a.groups()
            frames = []
            for token in body.split():
                f = FRAME.fullmatch(token)
                if not f:
                    frames.append({'unparsed': token})
                    continue
                image, frame, duration, events = f.groups()
                image = int(image)
                frames.append({'imageId': image, 'frameIndex': int(frame),
                    'durationRaw': int(duration), 'eventsRaw': events,
                    'files': [f'{sprite}-{image+d}.spr' for d in range(8 if directional == '1' else 1)] if image >= 0 else [],
                    'unresolvedReference': image < 0})
            actions.append({'id': int(number), 'name': name.strip(),
                'directional': directional == '1', 'declaredFrames': int(expected),
                'frames': frames, 'countMatches': len(frames) == int(expected)})
        name = re.split(r'\d+\.[^()]+\(', tail, maxsplit=1)[0].strip()
        entries.append({'id': int(ident), 'spriteId': sprite, 'declaredImages': int(count),
                        'name': name, 'actions': actions})
    return {'schemaVersion': 1, 'timingUnit': 'unverified', 'entries': entries}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('--encoding', default='big5')
    a = p.parse_args()
    result = parse(a.source.read_text(encoding=a.encoding, errors='surrogateescape'))
    with a.output.open('x', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=True, indent=2)

if __name__ == '__main__':
    main()
