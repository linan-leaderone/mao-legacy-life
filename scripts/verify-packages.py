"""Compare both distributables with the current web build without printing credentials."""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
root = Path(__file__).resolve().parent.parent
version = json.loads((root / "package.json").read_text(encoding="utf-8-sig"))["version"]
dist = root / "dist"
assets = {p.relative_to(dist).as_posix(): p.read_bytes() for p in dist.rglob("*") if p.is_file()}
assert sum(len(data) for name, data in assets.items() if name.startswith("maps/")) < 75_000_000, "Unexpected global map payload"
def is_flag_asset(name):
    return name.startswith("flags/") or re.fullmatch(r"assets/flag-data-[A-Za-z0-9_-]+\.js", name) is not None
flag_bytes = sum(len(data) for name, data in assets.items() if is_flag_asset(name))
assert flag_bytes < 5_000_000, "Flag artwork and its manifest exceed the independent 5 MB budget"
private_settings = root / ".private/settings.json"
settings = json.loads(private_settings.read_text(encoding="utf-8-sig")) if private_settings.exists() else {}
included_providers = []
for provider in ["deepseek", "gemini", "shiwuyan"]:
    key = settings.get("providers", {}).get(provider, {}).get("apiKey", "").encode()
    if key:
        assert any(key in data for name, data in assets.items() if name.endswith(".js")), f"Default credential missing: {provider}"
        included_providers.append(provider)
assert not any("mod-corpus" in name or ".private" in name for name in assets)
core_bytes = sum(len(data) for name, data in assets.items() if not name.startswith(("portraits/", "characters/", "maps/")) and not is_flag_asset(name))
assert core_bytes < 40_000_000, "Unexpected core payload (includes the global geographic name index); audit corpus must not be shipped"
assert sum(map(len, assets.values())) < 120_000_000, "Portrait and global web payload exceeds the offline bundle budget"
results = []
for filename, prefix in [
    ("MaoLegacyLife-Android.apk", "assets/web/"),
    ("MaoLegacyLife-Windows-x64.zip", f"MaoLegacyLife-{version}-Windows-x64/resources/app/web/"),
]:
    file = root / "release" / filename
    with zipfile.ZipFile(file) as archive:
        names = {n.replace("\\", "/"): n for n in archive.namelist()}
        assert not any(".private/" in n or n.endswith(".p12") or "mod-corpus.json" in n for n in names)
        bundled = {n[len(prefix):] for n in names if n.startswith(prefix) and not n.endswith("/")}
        assert bundled == set(assets), f"Asset list differs in {filename}"
        for name, data in assets.items():
            assert archive.read(names[prefix + name]) == data, f"Asset content differs: {filename}: {name}"
        if filename.endswith(".zip"):
            package = json.loads(archive.read(names[f"MaoLegacyLife-{version}-Windows-x64/resources/app/package.json"]))
            assert package["version"] == version
            for source in ["main.cjs", "preload.cjs", "api-request.cjs"]:
                assert archive.read(names[f"MaoLegacyLife-{version}-Windows-x64/resources/app/{source}"]) == (root / "desktop" / source).read_bytes(), f"Native source mismatch: {source}"
    with file.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    results.append({"file": filename, "bytes": file.stat().st_size, "sha256": digest, "matchingWebAssets": len(assets)})
(root / "release/SHA256SUMS.txt").write_text("".join(f'{item["sha256"]}  {item["file"]}\n' for item in results), encoding="utf-8")
report = {"version": version, "defaultProvidersIncluded": included_providers, "auditCorpusExcluded": True, "webAssetBytes": sum(map(len, assets.values())), "coreBytes": core_bytes, "flagBytes": flag_bytes, "packages": results}
(root / "release/build-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
