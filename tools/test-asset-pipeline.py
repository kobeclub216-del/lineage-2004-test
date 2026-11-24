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

class AssetTests(unittest.TestCase):
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
