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

    def test_archive_with_unsafe_paths_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp)/'bad.zip'
            with zipfile.ZipFile(archive, 'w') as pack:
                pack.writestr('../outside.png', b'')
            with self.assertRaisesRegex(ValueError, 'Unsafe'):
                index.build([archive], {}, set())


if __name__ == '__main__':
    unittest.main()
