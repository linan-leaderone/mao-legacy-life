import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// Run export-public-source.mjs first. The manifest is the complete allowlist:
// extra files in the exported checkout are never enumerated or included.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
if(!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version))throw Error('Invalid package version.');
const release=path.join(root,'release');
const manifestPath=path.join(release,`public-source-${version}-manifest.json`);
const sourcePath=path.join(release,`public-source-${version}`);
const archivePath=path.join(release,`MaoLegacyLife-Source-${version}.zip`);
const verificationPath=path.join(release,`MaoLegacyLife-Source-${version}-verification.json`);
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
if(manifest.version!==version||path.resolve(manifest.output)!==sourcePath||manifest.privateDefaultsExcluded!==true)throw Error('Source manifest does not describe the expected public export. Run export-public-source.mjs again.');

const candidates=[process.env.PYTHON,'python3','python',...(process.platform==='win32'?[path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe')]:[])].filter(Boolean);
const python=candidates.find(command=>{const result=spawnSync(command,['-c','import sys; sys.exit(0 if sys.version_info >= (3,8) else 1)'],{encoding:'utf8',windowsHide:true,timeout:10000});return !result.error&&result.status===0;});
if(!python)throw Error('Python 3.8+ is required. Install Python or set PYTHON to its executable path.');

const pack=String.raw`
import hashlib, json, os, pathlib, re, stat, sys, zipfile

manifest_path, source_path, archive_path, verification_path = map(pathlib.Path, sys.argv[1:5])
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
source_root = source_path.resolve(strict=True)
entries = manifest.get('assets')
if not isinstance(entries, list) or not entries:
    raise ValueError('Source manifest has no file entries.')
excluded = re.compile(r'(?:^|/)(?:node_modules|\.git|\.private|\.cache|\.gradle|build|dist|dist-ios|release)(?:/|$)|(?:^|/)\.env(?:\.|$)|(?:^|/)local\.properties$|mod-corpus\.json$|\.(?:p12|pfx|pem|key|keystore|mobileprovision|log)$', re.I)
names = []
seen = set()
for entry in entries:
    name = entry.get('path', '')
    parts = pathlib.PurePosixPath(name).parts
    if not isinstance(name, str) or not name or '\\' in name or ':' in name or name.startswith('/') or any(p in ('.', '..') for p in name.split('/')) or pathlib.PurePosixPath(name).as_posix() != name:
        raise ValueError('Unsafe path in public source manifest.')
    if excluded.search(name) or name in seen:
        raise ValueError('Excluded or duplicate manifest path: ' + name)
    if not isinstance(entry.get('bytes'), int) or entry['bytes'] < 0 or not re.fullmatch(r'[a-f0-9]{64}', entry.get('sha256', '')):
        raise ValueError('Invalid file metadata: ' + name)
    target = source_root.joinpath(*parts)
    cursor = source_root
    for part in parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise ValueError('Symlink in public source export: ' + name)
    if not target.is_file() or source_root not in target.resolve(strict=True).parents:
        raise ValueError('Missing or escaped export file: ' + name)
    names.append(name)
    seen.add(name)
if len(entries) != manifest.get('files') or sum(e['bytes'] for e in entries) != manifest.get('bytes'):
    raise ValueError('Manifest totals do not match its entries.')

temporary = archive_path.with_name(archive_path.name + '.tmp-' + str(os.getpid()))
try:
    with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as archive:
        for entry in entries:
            name = entry['path']
            data = source_root.joinpath(*pathlib.PurePosixPath(name).parts).read_bytes()
            if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
                raise ValueError('Export changed since manifest was created: ' + name)
            info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(temporary, 'r') as archive:
        if archive.namelist() != names or len(archive.infolist()) != len(seen):
            raise ValueError('ZIP entries differ from the exact manifest list.')
        for entry in entries:
            info = archive.getinfo(entry['path'])
            data = archive.read(info)
            if info.file_size != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
                raise ValueError('ZIP content verification failed: ' + entry['path'])
        if archive.testzip() is not None:
            raise ValueError('ZIP CRC verification failed.')
    archive_bytes = temporary.stat().st_size
    archive_hash = hashlib.sha256(temporary.read_bytes()).hexdigest()
    report = {
        'version': manifest['version'],
        'archive': str(archive_path),
        'manifest': str(manifest_path),
        'manifestSha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        'files': len(entries),
        'uncompressedBytes': sum(e['bytes'] for e in entries),
        'archiveBytes': archive_bytes,
        'sha256': archive_hash,
        'exactManifestEntries': True,
        'allSizesAndHashesMatch': True,
        'crcVerified': True,
        'privateDefaultsExcluded': True,
    }
    os.replace(temporary, archive_path)
    verification_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))
finally:
    if temporary.exists():
        temporary.unlink()
`;
const result=spawnSync(python,['-c',pack,manifestPath,sourcePath,archivePath,verificationPath],{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
if(result.error)throw result.error;
if(result.status!==0)throw Error(result.stderr.trim()||'Public source packaging failed.');
process.stdout.write(result.stdout);
