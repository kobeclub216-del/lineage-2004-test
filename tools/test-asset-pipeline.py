"""Synthetic regression tests; no original game assets required."""
import hashlib
import importlib.util
import struct
import tempfile
import unittest
import zipfile
from unittest.mock import patch
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
map_decoder = load('decode-local-maps')

class AssetTests(unittest.TestCase):
    def test_map_decoder_stages_same_s32_set_for_image_and_collision(self):
        manifest = {
            'schemaVersion': 1,
            'maps': [{'path': 'map/4/80008001.S32', 'mapId': '4'},
                     {'path': 'map/4/tempseg.s32', 'mapId': '4'},
                     {'path': 'map/4/80008003.s32', 'mapId': '4'},
                     {'path': 'map/4/80008002.seg', 'mapId': '4'},
                     {'path': 'map/4.map', 'mapId': None}],
            'tilePairs': [{'idx': 'Tile.idx', 'pak': 'Tile.pak'}],
        }
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bundle = root / 'input.zip'
            with zipfile.ZipFile(bundle, 'w') as archive:
                archive.writestr('local-map-bundle.json', map_decoder.json.dumps(manifest))
                for name in ('map/4/80008001.S32', 'map/4/80008002.seg', 'Tile.idx', 'Tile.pak'):
                    archive.writestr(name, 'fixture')
            calls = []
            def viewer(args, **kwargs):
                folder = Path(args[3])
                self.assertEqual([p.name for p in folder.iterdir()], ['80008001.s32'])
                self.assertTrue((folder.parents[1] / 'Tile.pak').is_file())
                calls.append(args[2])
                Path(args[4]).write_bytes(b'fixture')
                return map_decoder.subprocess.CompletedProcess(args, 0)
            with patch.object(map_decoder.subprocess, 'run', side_effect=viewer):
                result = map_decoder.decode(bundle, root / 'out', root / 'viewer.exe', ['0', '4'],
                                            (0x8000, 0x8001, 0x8000, 0x8001))
            self.assertEqual([entry['status'] for entry in result], ['skipped', 'exported'])
            self.assertEqual(calls, ['export-passability', 'export-fullmap'])
            self.assertEqual(result[1]['ignoredBlocks'], ['map/4/tempseg.s32'])
            self.assertEqual(result[1]['outsideRegion'], 2)
            self.assertEqual(result[1]['excludedSeg'], 1)
            self.assertEqual(map_decoder.catalog(manifest)['maps']['4']['formats'], ['s32', 'seg', 'map'])
            def broken_platform(args, **kwargs):
                if args[2] == 'export-fullmap':
                    kwargs['stdout'].write(b'Platform instance is null. Have you created your application?')
                    return map_decoder.subprocess.CompletedProcess(args, 1)
                return viewer(args, **kwargs)
            with patch.object(map_decoder.subprocess, 'run', side_effect=broken_platform):
                fallback = map_decoder.decode(bundle, root / 'fallback', root / 'viewer.exe', ['4'],
                                              (0x8000, 0x8001, 0x8000, 0x8001))
            self.assertEqual(fallback[0]['status'], 'gui-required')
            self.assertTrue((root / 'fallback/4/passability.txt').is_file())
            self.assertTrue((root / 'fallback/viewer-input/map/4/80008001.s32').is_file())

            def gui_viewer(args, **kwargs):
                self.assertEqual(args[2], 'export-passability')
                folder, output = Path(args[3]), Path(args[4])
                names = [p.name for p in folder.iterdir()]
                self.assertEqual(names, ['80008002.seg'] if output.name.startswith('seg-') else ['80008001.s32'])
                output.write_bytes(b'fixture')
                return map_decoder.subprocess.CompletedProcess(args, 0)
            with patch.object(map_decoder.subprocess, 'run', side_effect=gui_viewer):
                gui = map_decoder.decode(bundle, root / 'gui', root / 'viewer.exe', ['4'],
                                         (0x8000, 0x8001, 0x8000, 0x8002), gui=True)
            self.assertEqual(gui[0]['status'], 'gui-required')
            self.assertEqual(gui[0]['selectedSeg'], ['80008002.seg'])
            self.assertTrue((root / 'gui/4/seg-passability.txt').is_file())
            self.assertFalse((root / 'gui/4/export-fullmap.log').exists())

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
