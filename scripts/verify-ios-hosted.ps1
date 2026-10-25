$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$verificationInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$rootPath = Split-Path -Parent $PSScriptRoot
$stage = 'configuration'
try {
    $siteUri = [Uri]$verificationInput.url
    if ($siteUri.Scheme -ne 'https' -or -not $siteUri.Host.EndsWith('.chatgpt.site')) { throw 'Unexpected origin' }
    $report = Get-Content -Raw -LiteralPath (Join-Path $rootPath 'release/ios-web-verification.json') | ConvertFrom-Json
    $checks = @()
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseCookies = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(25)
    $authenticated = -not [string]::IsNullOrWhiteSpace($verificationInput.token)
    if ($authenticated) { $client.DefaultRequestHeaders.Add('OAI-Sites-Authorization',"Bearer $($verificationInput.token)") }
    foreach ($assetPath in @('index.html','sw.js')+@($report.assets.path | Where-Object { $_ -ne 'index.html' })) {
        $stage = "request $assetPath"
        $requestPath = if ($assetPath -eq 'index.html') { './' } else { $assetPath }
        $response = $client.GetAsync([Uri]::new($siteUri, $requestPath)).GetAwaiter().GetResult()
        $stage = "$assetPath HTTP $([int]$response.StatusCode)"
        if ([int]$response.StatusCode -ne 200) {
            if ($response.Headers.Location) {
                $redirectUri = [Uri]::new($siteUri,$response.Headers.Location)
                $stage += ' redirect '+$redirectUri.GetLeftPart([UriPartial]::Path)
            }
            throw 'Unexpected response status'
        }
        $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        $sha = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
        $contentType = [string]$response.Content.Headers.ContentType
        if ($assetPath -eq 'index.html') {
            if (-not [System.Text.Encoding]::UTF8.GetString($bytes).Contains('name="mao-life-release" content="'+$report.version+'"')) { throw 'Release marker missing' }
        } else {
            $expected = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $rootPath "dist-ios/$assetPath")).Hash.ToLowerInvariant()
            if ($sha -ne $expected) { throw 'Asset differs' }
        }
        if ($assetPath -eq 'sw.js' -and $contentType -notmatch 'javascript') { throw 'Unexpected worker type' }
        $checks += [ordered]@{path=$assetPath;status=[int]$response.StatusCode;contentType=$contentType;bytes=$bytes.Length;sha256=$sha}
    }
    $result = [ordered]@{url=$siteUri.GetLeftPart([UriPartial]::Authority);verifiedAt=[DateTime]::UtcNow.ToString('o');version=$report.version;authenticated=$authenticated;cookiesEnabled=$false;physicalIOSDeviceTested=$false}
    $checksKey = if ($authenticated) { 'authenticatedHTTPChecks' } else { 'anonymousHTTPChecks' }
    $result[$checksKey] = $checks
    $reportFile = if ($authenticated) { 'release/ios-hosted-verification.json' } else { 'release/ios-public-verification.json' }
    $json = $result | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText((Join-Path $rootPath $reportFile),$json,[System.Text.UTF8Encoding]::new($false))
    Write-Output ([ordered]@{url=$result.url;version=$result.version;authenticated=$authenticated;cookiesEnabled=$false;verifiedResourceCount=$checks.Count;allHTTP200=$true;nonHTMLBytesMatch=$true;physicalIOSDeviceTested=$false} | ConvertTo-Json -Compress)
} catch {
    $safeMessage = [string]$_.Exception.Message
    if ($verificationInput.token) { $safeMessage = $safeMessage.Replace([string]$verificationInput.token,'[redacted]') }
    Write-Output (@{failedAt=$stage;exceptionType=$_.Exception.GetType().Name;message=$safeMessage} | ConvertTo-Json -Compress)
    exit 1
} finally {
    if ($client) { $client.Dispose() }
}
