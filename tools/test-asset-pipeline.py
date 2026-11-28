"""Synthetic regression tests; no original game assets required."""
import hashlib
import importlib.util
import struct
import tempfile
import unittest
import zipfile
from pathlib import Path

def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

index = load('index-lineage-assets')
extractor = load('extract-lineage-entries')
batch = load('plan-sprite-batch')
maps = load('bundle-local-maps')

class AssetTests(unittest.TestCase):
    def test_collects_selected_map_ids_and_same_directory_tile_pairs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'client'
            for name in ('map/4/a.s32', 'map/7/b.seg', 'Tile.idx', 'Tile.pak', 'extra/tile.idx'):
                path = source / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b'fixture')
            output = root / 'maps.zip'
            result = maps.bundle(source, output, ('4',))
            self.assertEqual(result['maps'], [{'path': 'map/4/a.s32', 'mapId': '4'}])
            self.assertEqual(result['unpairedTiles'], ['extra/tile.idx'])
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(set(archive.namelist()), {
                    'map/4/a.s32', 'Tile.idx', 'Tile.pak', 'local-map-bundle.json',
                })

    def test_sprite_batch_uses_index_ids_and_reports_incomplete_actions(self):
        text = (
            '#310 7=999 goblin\n'
            '0.walk(1 1, 8.0:4)\n1.attack(1 2, 8.0:4 broken)\n'
            '2.death(0 1, 8.0:6)\n'
            '#420 3 pandora\n0.stand(0 1, 4.0:10)\n'
            '#421 3 pandora\n0.stand(0 1, 4.0:10)\n'
            '#500 2 knight male\n0.pick up(0 1, 5.0:7)\n'
        )
        result = batch.build(batch.parse(text), batch.default_catalog())
        candidates = {entry['candidate']: entry for entry in result['candidates']}
        self.assertEqual(candidates['goblin']['entryId'], 310)
        self.assertEqual(candidates['goblin']['spriteId'], 999)
        self.assertEqual(candidates['goblin']['missing'], ['attack', 'hit', 'idle'])
        self.assertIn('death', candidates['goblin']['missingEightDirections'])
        self.assertEqual(len(candidates['goblin']['rejected']), 1)
        self.assertEqual(candidates['pandora']['status'], 'ambiguous')
        self.assertEqual(candidates['gereng']['status'], 'unmatched')
        self.assertEqual(candidates['male knight']['entryId'], 500)
        self.assertEqual(set(result['files']), {'500-5.spr'} |
                         {f'999-{direction}.spr' for direction in range(8, 16)})

    def test_pipeline(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'source'
            source.mkdir()
            idx = source / 'Sprite.idx'
            pak = source / 'Sprite.pak'
            idx.write_bytes(struct.pack('<II20sI', 1, 3, b'1-0.spr', 4))
            pak.write_bytes(b'abcTEST')
            assets = index.build([source], {}, set())['assets']
            entry = next(a for a in assets if a['status'] == 'idx-layout-read')
            self.assertEqual(entry['index']['entryCount'], 1)
            self.assertEqual(entry['pakPairs'][0]['status'], 'capacity-compatible')
            report = extractor.extract(idx, pak, root / 'out', ['1-0.spr'])
            self.assertEqual((root / 'out' / '1-0.spr').read_bytes(), b'TEST')
            self.assertEqual(report[0]['sha256'], hashlib.sha256(b'TEST').hexdigest())
            pak.write_bytes(b'x')
            assets = index.build([source], {}, set())['assets']
            entry = next(a for a in assets if a['status'] == 'idx-layout-read')
            self.assertEqual(entry['pakPairs'][0]['status'], 'pak-too-small')
            with self.assertRaises(ValueError):
                extractor.extract(idx, pak, root / 'bad', ['1-0.spr'])

    def test_large_pak(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'Large.pak'
            with path.open('wb') as f:
                f.truncate(33 * 1024**2)
            result = index.build([path], {}, set())['assets'][0]
            self.assertEqual(result['bytes'], 33 * 1024**2)
            self.assertEqual(result['sha256'], hashlib.sha256(bytes(33 * 1024**2)).hexdigest())

    def test_zip_pair(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'assets.zip'
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('a/Tile.idx', struct.pack('<II20sI', 1, 0, b'1.til', 1))
                z.writestr('a/Tile.pak', b'x')
            assets = index.build([path], {}, set())['assets']
            entry = next(a for a in assets if a['status'] == 'idx-layout-read')
            self.assertEqual(entry['pakPairs'][0]['status'], 'capacity-compatible')

if __name__ == '__main__':
    unittest.main()
