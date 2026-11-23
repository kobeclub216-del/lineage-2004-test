import hashlib
import importlib.util
import struct
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('index_assets', Path(__file__).with_name('index-lineage-assets.py'))
index = importlib.util.module_from_spec(spec)
spec.loader.exec_module(index)


class AssetIndexTests(unittest.TestCase):
    def test_zip_and_png_deduplicate_and_keep_explicit_provenance(self):
        png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR' + struct.pack('>II', 32, 32) + bytes(9)
        sha = hashlib.sha256(png).hexdigest()
        annotation = {sha: {
            'sha256': sha, 'category': 'monster', 'source': 'fixture',
            'version': 'test', 'rights': 'fixture', 'animations': {
                'idle': {'S': [{'x': 0, 'y': 0, 'width': 32, 'height': 32, 'ms': 100}]}
            }
        }}
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            loose, archive = root/'atlas.png', root/'pack.zip'
            loose.write_bytes(png)
            with zipfile.ZipFile(archive, 'w') as pack:
                pack.writestr('monster/atlas.png', png)
                pack.writestr('terrain.map', b'test map')
                pack.writestr('monster.spr', b'test spr')
            result = index.build([loose, archive], annotation, {sha})['assets']
            self.assertEqual(len(result), 3)
            self.assertEqual(len(result[0]['locations']), 2)
            self.assertEqual(result[0]['category'], 'monster')
            self.assertTrue(result[0]['alreadyIndexed'])
            self.assertEqual([item['status'] for item in result[1:]], ['decoder-required']*2)
            annotation[sha]['animations']['idle']['S'][0]['width'] = 33
            with self.assertRaisesRegex(ValueError, 'exceeds atlas'):
                index.build([loose], annotation, set())

    def test_zip_recognizes_client_resources_and_reads_s32_prefix(self):
        floor = struct.pack('<II', 1, 65537) * (64 * 64)
        attributes = struct.pack('<HH', 1, 257) * (64 * 64)
        prefix = floor + struct.pack('<H', 1) + bytes(6) + attributes
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp)/'client.zip'
            with zipfile.ZipFile(archive, 'w') as pack:
                pack.writestr('map/0/chunk.s32', prefix + struct.pack('<I', 3))
                pack.writestr('map/0/short.s32', prefix)
                for name in ('tile.pak', 'tile.idx', 'old.seg'):
                    pack.writestr(name, name.encode())
            assets = index.build([archive], {}, set())['assets']
        self.assertEqual(assets[0]['category'], 'map')
        self.assertEqual(assets[0]['status'], 's32-prefix-read')
        self.assertEqual(assets[0]['map'], {
            'tilesWide': 64, 'tilesHigh': 64, 'halfTilesPerTile': 2,
            'distinctFloorValues': 2, 'distinctAttributeValues': 2,
            'unknownRecordCount': 1, 'declaredObjectCount': 3,
        })
        self.assertEqual(assets[1]['status'], 's32-truncated-prefix')
        self.assertTrue(all(item['status'] == 'decoder-required' for item in assets[2:]))


    def test_archive_with_unsafe_paths_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp)/'bad.zip'
            with zipfile.ZipFile(archive, 'w') as pack:
                pack.writestr('../outside.png', b'')
            with self.assertRaisesRegex(ValueError, 'Unsafe'):
                index.build([archive], {}, set())


if __name__ == '__main__':
    unittest.main()
