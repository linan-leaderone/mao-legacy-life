"""Read the MOD's full-sized flags, losslessly convert and deduplicate them.

This only reads the MOD. Run build-country-catalog.mjs first so the geographic
and political metadata uses the final opening state. No generative edits occur.
"""
from pathlib import Path
from collections import Counter
import argparse, hashlib, io, json, re
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def parse_script(text):
    tokens = re.findall(r'"(?:\\.|[^"\\])*"|#[^\n]*|[{}=]|[^\s{}=#]+', text)
    tokens = [t for t in tokens if not t.startswith('#')]
    index = 0

    def body():
        nonlocal index
        result = []
        while index < len(tokens):
            token = tokens[index]
            index += 1
            if token == '}':
                break
            if index < len(tokens) and tokens[index] == '=':
                index += 1
                value = tokens[index]
                index += 1
                result.append((token, body() if value == '{' else value.strip('"')))
        return result
    return body()


def block(nodes, key):
    return next((value for name, value in nodes if name == key and isinstance(value, list)), [])


def clean(text):
    return re.sub(r'\s+', ' ', re.sub(r'§.|£[\w.]+|\[[^\]]+\]', '', text.replace('\\n', ' '))).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mod', type=Path, default=ROOT.parent / 'TFR-xinzuo-rebuild')
    args = parser.parse_args()
    mod = args.mod.resolve()
    flags = mod / 'gfx/flags'
    output = ROOT / 'public/flags'
    output.mkdir(parents=True, exist_ok=True)
    countries = json.loads((ROOT / 'src/data/countries.json').read_text(encoding='utf-8'))
    groups, subtypes = {}, {}
    for path in sorted((mod / 'common/ideologies').glob('*.txt')):
        for group, nodes in block(parse_script(path.read_text(encoding='utf-8-sig')), 'ideologies'):
            groups[group] = group
            for subtype, _ in block(nodes, 'types'):
                subtypes[subtype] = group
    ideology_map = {**groups, **subtypes}
    suffixes = sorted(ideology_map, key=lambda key: (-len(key), key))

    # Chinese localization takes priority. Equal-priority later files override.
    localization = {}
    for path in sorted((mod / 'localisation').rglob('*.yml'), key=lambda p: p.as_posix().lower()):
        text = path.read_text(encoding='utf-8-sig', errors='replace')
        language = re.search(r'^\s*l_(simp_chinese|english)\s*:', text, re.M)
        if not language:
            continue
        score = (10 if language[1] == 'simp_chinese' else 0) + (2 if '/replace/' in path.as_posix() else 0)
        for match in re.finditer(r'^\s*([^#\s:]+):\s*(?:\d+\s*)?"(.*)"\s*(?:#.*)?$', text, re.M):
            key, value = match.groups()
            if key not in localization or score >= localization[key][0]:
                localization[key] = (score, value)

    def label(key, depth=0):
        value = localization.get(key, (0, ''))[1]
        if depth < 5:
            value = re.sub(r'\$([\w.]+)\$', lambda m: label(m[1], depth + 1), value)
        return clean(value)

    selected, all_sources = {}, []
    for directory, tier in [(flags, 'standard'), (flags / 'medium', 'medium'), (flags / 'small', 'small')]:
        for path in sorted(directory.glob('*'), key=lambda p: p.name.lower()):
            if path.suffix.lower() not in {'.tga', '.dds', '.png'}:
                continue
            record = {'id': path.stem, 'path': path.relative_to(mod).as_posix(), 'sha256': digest(path.read_bytes()), 'tier': tier}
            all_sources.append(record)
            # Keep unique small variants at their native size. Standard wins
            # over medium and small; the UI receives the actual quality tier.
            selected.setdefault(path.stem.lower(), (path, record))

    entries, assets, failed = {}, {}, []
    for key, (path, source) in selected.items():
        try:
            with Image.open(path) as original:
                image = original.convert('RGBA')
                pixels = image.size[0].to_bytes(4, 'big') + image.size[1].to_bytes(4, 'big') + image.tobytes()
                asset_id = digest(pixels)[:24]
                name = asset_id + '.png'
                if name not in assets:
                    encoded = io.BytesIO()
                    image.save(encoded, format='PNG', optimize=True)
                    payload = encoded.getvalue()
                    (output / name).write_bytes(payload)
                    assets[name] = {'sha256': digest(payload), 'bytes': len(payload), 'width': image.width, 'height': image.height}
                image_size = image.size
                visible = image.getchannel('A').getextrema()[1] > 0
        except Exception as error:
            failed.append({'id': source['id'], 'path': source['path'], 'error': str(error)})
            continue
        identifier = source['id']
        tag = identifier[:3].upper()
        record = countries.get('tags', {}).get(tag, {})
        ideology = next((suffix for suffix in suffixes if key.endswith('_' + suffix.lower())), None)
        base_id = identifier[:-(len(ideology) + 1)] if ideology else identifier
        # A country's opening ideology is metadata only for its base flag. It
        # must not be copied onto every cosmetic or alternate flag of that TAG.
        ideologies = [ideology_map[ideology]] if ideology else ([record['ideologyGroup']] if key == tag.lower() and record.get('ideologyGroup') else [])
        names = list(dict.fromkeys(filter(None, [label(identifier), label(identifier + '_DEF'), label(base_id), record.get('name') if key == tag.lower() else None])))
        entries[identifier] = {
            'id': identifier, 'tag': tag if tag in countries.get('tags', {}) else None,
            'cosmeticTag': base_id if base_id.lower() != tag.lower() else None,
            'ideologyId': ideology, 'ideologyGroups': ideologies,
            'iso': record.get('iso'), 'names': names, 'src': 'flags/' + name,
            'width': image_size[0], 'height': image_size[1],
            'visible': visible,
            'quality': source['tier'], 'source': {'path': source['path'], 'sha256': source['sha256']},
        }

    data = {
        'version': 1,
        'sourceRoot': 'TFR-xinzuo-rebuild/gfx/flags',
        'conversion': 'Pillow lossless RGBA PNG; content-addressed pixel deduplication; no upscaling or recoloring',
        'counts': {'sourceImages': len(all_sources), 'catalogFlags': len(entries), 'standardFlags': sum(entry['quality'] == 'standard' for entry in entries.values()), 'mediumOnlyFlags': sum(entry['quality'] == 'medium' for entry in entries.values()), 'smallOnlyFlags': sum(entry['quality'] == 'small' for entry in entries.values()), 'uniqueImages': len(assets), 'imageBytes': sum(asset['bytes'] for asset in assets.values()), 'failedImages': len(failed)},
        'flags': entries, 'assets': assets,
        'ideologyGroups': {key: {'name': label(key), 'subtypes': [subtype for subtype, parent in subtypes.items() if parent == key]} for key in groups},
        'countryTags': {tag: {'name': record.get('name'), 'iso': record.get('iso'), 'ideologyGroup': record.get('ideologyGroup')} for tag, record in countries.get('tags', {}).items()},
        'geographicTags': {iso: record.get('tag') for iso, record in countries.get('countries', {}).items() if record.get('tag')},
        'failedImages': failed,
        'sourceManifestSha256': digest(json.dumps(all_sources, sort_keys=True, separators=(',', ':')).encode()),
    }
    (ROOT / 'src/data/faction-flags.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps(data['counts']))
    if failed:
        raise SystemExit('Some source flags failed conversion; inspect failedImages before release.')


if __name__ == '__main__':
    main()
