"""Read-only deployment/API metadata diagnostics. Never generate narrative or play a game."""
import json, pathlib, time, urllib.request, urllib.error, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = 'https://mao-legacy-life-iphone.linanna.chatgpt.site'
report = {'version': '1.17.2', 'gameTestsRun': False, 'effectiveGenerationRequests': 0, 'observations': []}
site_token = ''
if '--read-token-stdin' in sys.argv:
    print('Ready for existing Site token on stdin (input hidden).', flush=True)
    if sys.platform == 'win32' and sys.stdin.isatty():
        import msvcrt
        while True:
            char = msvcrt.getwch()
            if char in ('\r', '\n'): break
            site_token += char
    else:
        site_token = sys.stdin.readline().strip()
    report['siteOwnerDiagnostic'] = True
def request(path, method='GET', body=None, headers=None):
    started = time.monotonic()
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
    request_headers = dict(headers or {})
    if site_token: request_headers['OAI-Sites-Authorization'] = 'Bearer ' + site_token
    req = urllib.request.Request(SITE + path, data=data, method=method, headers=request_headers)
    result = {'path': path, 'method': method}
    content = b''
    try:
        with urllib.request.urlopen(req, timeout=22) as response:
            result['status'] = response.status
            result['contentType'] = response.headers.get('Content-Type', '')
            content = response.read(512 * 1024)
    except urllib.error.HTTPError as error:
        result['status'] = error.code
    except Exception as error:
        result['errorType'] = type(error).__name__
    result['elapsedMs'] = round((time.monotonic() - started) * 1000)
    return result, content
health, content = request('/api/health')
try:
    value = json.loads(content)
    health['relay'] = value.get('relay') is True
    health['assets'] = value.get('assets') is True
    health['version'] = value.get('version')
except Exception:
    pass
report['observations'].append(health)
for path in ['/', '/maps/world-boundaries.json', '/portraits/pixel-tsurumaki-kokoro.webp']:
    report['observations'].append(request(path, 'HEAD')[0])
if health.get('relay') and health.get('status') == 200:
    settings = json.loads((ROOT / '.private/settings.json').read_text(encoding='utf-8-sig'))
    for provider in ['shiwuyan', 'gemini']:
        key = settings['providers'][provider]['apiKey']
        upstream_path, key_header = ('/v1/models', 'x-api-key') if provider == 'shiwuyan' else ('/v1beta/models', 'x-goog-api-key')
        envelope = {'url': 'https://aiapi.shiwuyan.cn' + upstream_path, 'method': 'GET', 'headers': {key_header: key}, 'timeoutMs': 15000}
        result, content = request('/api/relay', 'POST', envelope, {'Content-Type': 'application/json', 'Origin': SITE})
        result['provider'] = provider
        try:
            records = [json.loads(line) for line in content.decode().splitlines() if line.strip()]
            final = next(row['result'] for row in records if row.get('type') == 'result')
            result['upstreamStatus'] = final.get('status')
            result['upstreamErrorCode'] = final.get('errorCode')
            if final.get('status') == 200:
                model_data = json.loads(final['body'])
                result['modelCount'] = len(model_data.get('data', model_data.get('models', [])))
            result['heartbeatReceived'] = any(row.get('type') == 'progress' for row in records)
        except Exception:
            result['envelopeParsed'] = False
        report['observations'].append(result)
output = ROOT / 'release/site-connection-v1.17.2.json'
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
