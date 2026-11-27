"""Match named candidates against a local list.spr and queue supported actions."""
import argparse
import json
import re
from pathlib import Path
from runpy import run_path

parse = run_path(str(Path(__file__).with_name('parse-list-spr.py')))['parse']

MONSTERS = (
    'goblin', 'orc', 'orc archer', 'orc warrior', 'orc fighter', 'werewolf',
    'lycanthrope', 'skeleton', 'skeleton archer', 'skeleton guard', 'zombie',
    'ghoul', 'bugbear', 'ogre', 'troll', 'kobold', 'gnoll', 'lizardman',
    'giant ant', 'giant spider', 'imp', 'dwarf', 'golem', 'bat',
)
NPCS = (
    'pandora', 'gereng', 'mayer', 'ruun', 'karen', 'balsim', 'dilong',
    'homer', 'kent guard', 'talking island guard', 'innkeeper', 'blacksmith',
)
ROLES = ('prince', 'princess', 'male knight', 'female knight', 'male elf',
         'female elf', 'male wizard', 'female wizard')


def normalize(name):
    return ' '.join(re.findall(r'[^\W_]+', name.casefold()))


def action_type(name):
    words = set(normalize(name).split())
    for action, aliases in (
        ('cast', {'spell', 'cast', 'magic', 'spellcast'}),
        ('pickup', {'pickup', 'pick', 'get'}),
        ('death', {'die', 'death'}),
        ('hit', {'hit', 'damage', 'hurt'}),
        ('attack', {'attack', 'swing', 'shoot'}),
        ('walk', {'walk', 'move', 'run'}),
        ('idle', {'idle', 'stand', 'stance', 'standing', 'breath'}),
    ):
        if words & aliases:
            return action
    return None


def build(index, catalog):
    by_name = {}
    for entry in index['entries']:
        by_name.setdefault(normalize(entry['name']), []).append(entry)
    queue, results = set(), []
    for candidate in catalog:
        matches = {e['id']: e for alias in candidate['aliases']
                   for e in by_name.get(normalize(alias), [])}
        result = {'candidate': candidate['name'], 'kind': candidate['kind'],
                  'matches': sorted(matches)}
        results.append(result)
        if len(matches) != 1:
            result['status'] = 'ambiguous' if matches else 'unmatched'
            continue
        entry = next(iter(matches.values()))
        result.update(status='matched', entryId=entry['id'], spriteId=entry['spriteId'],
                      sourceName=entry['name'], actions=[], rejected=[])
        for action in entry['actions']:
            kind = action_type(action['name'])
            if kind not in candidate['actions']:
                continue
            frames = action['frames']
            directions = 8 if action['directional'] else 1
            if not frames or not action['countMatches'] or any(
                len(frame.get('files', [])) != directions for frame in frames
            ):
                result['rejected'].append({'id': action['id'], 'name': action['name']})
                continue
            result['actions'].append({**action, 'kind': kind, 'directions': directions})
            queue.update(name for frame in frames for name in frame['files'])
        result['missing'] = sorted(set(candidate['actions']) -
                                   {action['kind'] for action in result['actions']})
        result['missingEightDirections'] = sorted(set(candidate['actions']) -
            {action['kind'] for action in result['actions'] if action['directions'] == 8})
    return {'schemaVersion': 1, 'timingUnit': index['timingUnit'],
            'candidates': results, 'files': sorted(queue)}


def default_catalog():
    catalog = []
    for kind, names, actions in (
        ('monster', MONSTERS, ['idle', 'walk', 'attack', 'hit', 'death']),
        ('npc', NPCS, ['idle']),
        ('character', ROLES, ['cast', 'pickup']),
    ):
        for name in names:
            variants = name.split()
            aliases = [name]
            if kind == 'character' and len(variants) == 2:
                aliases.append(' '.join(reversed(variants)))
            catalog.append({'name': name, 'kind': kind, 'aliases': aliases,
                            'actions': actions})
    return catalog


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--encoding', default='big5')
    parser.add_argument('--catalog', type=Path, help='JSON list overriding exact name aliases and actions')
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding='utf-8-sig')) if args.catalog else default_catalog()
    index = parse(args.source.read_text(encoding=args.encoding, errors='surrogateescape'))
    if not index['entries']:
        parser.error('No list.spr entries were parsed. Check the source and encoding.')
    result = build(index, catalog)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'sprite-batch-plan.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    (args.output / 'names.txt').write_text('\n'.join(result['files']) + '\n', encoding='utf-8')
    print(f"{len(index['entries'])} source entries, {len(result['files'])} unique SPR files")
    return 0 if result['files'] else 2


if __name__ == '__main__':
    raise SystemExit(main())
