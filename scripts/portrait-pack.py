"""Package inspected, generated portrait PNGs as small local WebP assets.

Only resizing/encoding occurs here. Images are generated using the built-in
imagegen tool; this script never generates faces or edits reference identity.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'portrait-references'
DEST = ROOT / 'public' / 'portraits'
IDS = ['hazawa-tsugumi', 'mitake-ran', 'aoba-moca', 'uehara-himari',
       'udagawa-tomoe', 'toyokawa-sakiko', 'mao-zedong', 'deng-xiaoping', 'xi-jinping']

for slug in IDS:
    source = CACHE / f'{slug}-generated.png'
    old = DEST / f'{slug}.png'
    if not source.exists() and old.exists():
        # Exact allowlisted files, verified to stay in this project.
        assert old.resolve().parent == DEST.resolve()
        assert source.resolve().parent == CACHE.resolve()
        old.replace(source)
    if not source.exists():
        raise FileNotFoundError(source)
    with Image.open(source) as image:
        image.thumbnail((640, 960), Image.Resampling.LANCZOS)
        image.save(DEST / f'{slug}.webp', 'WEBP', quality=86, method=6)
        print(slug, image.size, (DEST / f'{slug}.webp').stat().st_size)
