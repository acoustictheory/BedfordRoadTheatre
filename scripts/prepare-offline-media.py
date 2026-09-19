"""Restore the exact release media for Android/iOS builds; never runs in the app.

The binary media stays out of Git. CI restores it from the already published
Android release, checking the APK hash and every asset part before building.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'mobile-app'
MANIFEST = APP / 'assets/offline/manifest.json'
RELEASE = ROOT / 'downloads/android-release.json'


def digest_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        while block := handle.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def parts(manifest):
    found = {}
    for asset in manifest['assets'].values():
        for part in asset['parts']:
            path = part['path']
            if not path.startswith('assets/offline/') or Path(path).name != path.split('/')[-1] or '..' in path:
                raise ValueError('Unsafe media path')
            if path in found:
                raise ValueError('Duplicate media path')
            found[path] = part
    return found


def verify_files(manifest):
    for name, part in parts(manifest).items():
        path = APP / name
        if not path.is_file() or path.stat().st_size != part['bytes'] or digest_file(path) != part['sha256']:
            return False
    expected = {Path(name).name for name in parts(manifest)}
    if {p.name for p in (APP / 'assets/offline').glob('*.bin')} != expected:
        raise ValueError('Unexpected stale media parts; review the bundle directory before releasing.')
    return True


def verify_apk(apk, manifest, extract=False):
    with zipfile.ZipFile(apk) as package:
        prefix = 'assets/flutter_assets/'
        if package.read(prefix + 'assets/offline/manifest.json') != MANIFEST.read_bytes():
            raise ValueError('APK catalog does not match the checked-in catalog')
        for name, part in parts(manifest).items():
            digest = hashlib.sha256()
            size = 0
            target = APP / name
            temporary = target.with_suffix('.partial')
            output = None
            try:
                if extract:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    output = temporary.open('wb')
                with package.open(prefix + name) as stream:
                    while block := stream.read(1024 * 1024):
                        digest.update(block)
                        size += len(block)
                        if output:
                            output.write(block)
                if output:
                    output.close()
                    output = None
                if size != part['bytes'] or digest.hexdigest() != part['sha256']:
                    raise ValueError('APK media checksum failed: ' + name)
                if extract:
                    temporary.replace(target)
            finally:
                if output:
                    output.close()
                if temporary.exists():
                    temporary.unlink()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true', help='Check local assets without network access')
    parser.add_argument('--verify-apk', type=Path)
    parser.add_argument('--from-apk', type=Path, help='Restore and verify assets from a local release APK')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if manifest['schemaVersion'] != 1 or len(manifest['tracks']) != 92 or len(manifest['documents']) != 49:
        raise ValueError('Unexpected catalog; review the intended production bundle.')
    if args.verify_apk:
        verify_apk(args.verify_apk, manifest)
    elif args.from_apk:
        verify_apk(args.from_apk, manifest, extract=True)
    elif not verify_files(manifest):
        if args.verify:
            raise ValueError('Offline assets are missing or corrupted. Run prepare-offline-media.py before building.')
        release = json.loads(RELEASE.read_text(encoding='utf-8'))
        if digest_file(MANIFEST) != release['mediaManifestSha256']:
            raise ValueError('Release reference and catalog differ; export the new production media locally first.')
        cache = ROOT / 'backups/offline-build-cache'
        cache.mkdir(parents=True, exist_ok=True)
        apk = cache / (release['sha256'] + '.apk')
        if not apk.exists() or digest_file(apk) != release['sha256']:
            print('Downloading verified build-time media...', flush=True)
            temporary = apk.with_suffix('.partial')
            with urllib.request.urlopen(release['url'], timeout=120) as response, temporary.open('wb') as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
            if digest_file(temporary) != release['sha256']:
                temporary.unlink()
                raise ValueError('Release APK checksum mismatch')
            temporary.replace(apk)
        verify_apk(apk, manifest, extract=True)
    print(f"Verified {len(manifest['tracks'])} tracks, {len(manifest['documents'])} scores, "
          f"{sum(asset['bytes'] for asset in manifest['assets'].values()):,} bundled bytes.")


if __name__ == '__main__':
    main()
