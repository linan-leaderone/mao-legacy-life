param([string]$JavaHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$cacheRoot = Join-Path $projectRoot '.cache'
$sdkRoot = Join-Path $cacheRoot 'android-sdk'
$buildRoot = Join-Path $cacheRoot 'android-build'
$privateRoot = Join-Path $projectRoot '.private'
$releaseRoot = Join-Path $projectRoot 'release'
if (-not $JavaHome) {
    $candidate = Get-ChildItem -LiteralPath 'C:\Program Files\Java' -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin\javac.exe') } | Select-Object -Last 1
    if ($candidate) { $JavaHome = $candidate.FullName }
}
if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin\javac.exe'))) { throw 'Set JAVA_HOME to a JDK 17 or newer.' }
$java = Join-Path $JavaHome 'bin\java.exe'
$javac = Join-Path $JavaHome 'bin\javac.exe'
$jar = Join-Path $JavaHome 'bin\jar.exe'
$keytool = Join-Path $JavaHome 'bin\keytool.exe'
function Run-Native([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Build command failed ($LASTEXITCODE): $Program" }
}
New-Item -ItemType Directory -Force $cacheRoot,$sdkRoot,$privateRoot,$releaseRoot | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist\index.html'))) { throw 'Run the web build first: pnpm build' }
$packages = @(
    @{ File='android-platform.zip'; Url='https://dl.google.com/android/repository/platform-35_r02.zip'; Sha1='0bb560a90a7a2cbd0dd8348224d518b638fe7949'; Check='android-35\android.jar' },
    @{ File='android-build-tools.zip'; Url='https://dl.google.com/android/repository/build-tools_r35_windows.zip'; Sha1='af059bb67cf7786f45ee0db85e2d24985df1b4b6'; Check='android-15\aapt2.exe' }
)
foreach ($package in $packages) {
    if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot $package.Check))) {
        $archive = Join-Path $cacheRoot $package.File
        if (-not (Test-Path -LiteralPath $archive)) { Invoke-WebRequest -Uri $package.Url -OutFile $archive }
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA1).Hash -ne $package.Sha1) { throw "SDK archive checksum mismatch: $archive" }
        Expand-Archive -LiteralPath $archive -DestinationPath $sdkRoot -Force
    }
}
$toolsRoot = Join-Path $sdkRoot 'android-15'
$platform = Join-Path $sdkRoot 'android-35\android.jar'
# Verify the absolute target before removing only our generated staging folder.
if ([IO.Path]::GetDirectoryName($buildRoot) -ne $cacheRoot) { throw 'Invalid staging directory' }
if (Test-Path -LiteralPath $buildRoot) { Remove-Item -LiteralPath $buildRoot -Recurse -Force }
New-Item -ItemType Directory -Force $buildRoot,(Join-Path $buildRoot 'classes'),(Join-Path $buildRoot 'dex'),(Join-Path $buildRoot 'assets') | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'dist') -Destination (Join-Path $buildRoot 'assets\web') -Recurse
$compiled = Join-Path $buildRoot 'resources.zip'
$unsigned = Join-Path $buildRoot 'unsigned.apk'
$aligned = Join-Path $buildRoot 'aligned.apk'
$outputApk = Join-Path $releaseRoot 'MaoLegacyLife-Android.apk'
Run-Native (Join-Path $toolsRoot 'aapt2.exe') @('compile','--dir',(Join-Path $projectRoot 'android\res'),'-o',$compiled)
Run-Native (Join-Path $toolsRoot 'aapt2.exe') @('link','-o',$unsigned,'-I',$platform,'--manifest',(Join-Path $projectRoot 'android\AndroidManifest.xml'),'-R',$compiled,'--auto-add-overlay')
$sources = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'android\src') -Filter '*.java' -Recurse | ForEach-Object { $_.FullName })
Run-Native $javac (@('-encoding','UTF-8','-source','8','-target','8','-Xlint:-options','-classpath',$platform,'-d',(Join-Path $buildRoot 'classes')) + $sources)
$classes = @(Get-ChildItem -LiteralPath (Join-Path $buildRoot 'classes') -Filter '*.class' -Recurse | ForEach-Object { $_.FullName })
Run-Native $java (@('-cp',(Join-Path $toolsRoot 'lib\d8.jar'),'com.android.tools.r8.D8','--lib',$platform,'--min-api','26','--output',(Join-Path $buildRoot 'dex')) + $classes)
# jar normalizes nested asset paths to ZIP forward slashes on Windows. AAPT2 -A
# preserves backslashes for nested files in this SDK and breaks AssetManager.
Run-Native $jar @('uf',$unsigned,'-C',$buildRoot,'assets','-C',(Join-Path $buildRoot 'dex'),'classes.dex')
Run-Native (Join-Path $toolsRoot 'zipalign.exe') @('-f','-p','4',$unsigned,$aligned)
$keystore = Join-Path $privateRoot 'android-signing.p12'
$passwordFile = Join-Path $privateRoot 'android-signing-password.txt'
if (-not (Test-Path -LiteralPath $passwordFile)) {
    $random = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
    [IO.File]::WriteAllText($passwordFile, [Convert]::ToBase64String($random))
}
$previousPassword = $env:MAO_ANDROID_SIGN_PASS
try {
    $env:MAO_ANDROID_SIGN_PASS = [IO.File]::ReadAllText($passwordFile).Trim()
    if (-not (Test-Path -LiteralPath $keystore)) {
        Run-Native $keytool @('-genkeypair','-keystore',$keystore,'-storetype','PKCS12','-storepass:env','MAO_ANDROID_SIGN_PASS','-keypass:env','MAO_ANDROID_SIGN_PASS','-alias','mao-legacy','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Mao Legacy Life Local Build, O=Independent Game, C=CN')
    }
    Run-Native $java @('-jar',(Join-Path $toolsRoot 'lib\apksigner.jar'),'sign','--v4-signing-enabled','false','--ks',$keystore,'--ks-key-alias','mao-legacy','--ks-pass','env:MAO_ANDROID_SIGN_PASS','--out',$outputApk,$aligned)
} finally { $env:MAO_ANDROID_SIGN_PASS = $previousPassword }
Run-Native $java @('-jar',(Join-Path $toolsRoot 'lib\apksigner.jar'),'verify','--verbose','--print-certs',$outputApk)
Run-Native (Join-Path $toolsRoot 'zipalign.exe') @('-c','4',$outputApk)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apkArchive = [IO.Compression.ZipFile]::OpenRead($outputApk)
try {
    if ($apkArchive.Entries | Where-Object { $_.FullName.Contains('\') }) { throw 'APK contains invalid asset separators' }
    $webRoot = Join-Path $projectRoot 'dist'
    foreach ($webFile in Get-ChildItem -LiteralPath $webRoot -Recurse -File) {
        $entryName = 'assets/web/' + $webFile.FullName.Substring($webRoot.Length + 1).Replace('\','/')
        $entry = $apkArchive.GetEntry($entryName)
        if (-not $entry -or $entry.Length -ne $webFile.Length) { throw "APK asset missing or truncated: $entryName" }
        $entryStream = $entry.Open()
        try {
            $digest = [Security.Cryptography.SHA256]::Create().ComputeHash($entryStream)
            $hash = [BitConverter]::ToString($digest).Replace('-','')
            if ($hash -ne (Get-FileHash -LiteralPath $webFile.FullName -Algorithm SHA256).Hash) { throw "APK asset differs from dist: $entryName" }
        } finally { $entryStream.Dispose() }
    }
} finally { $apkArchive.Dispose() }
Run-Native (Join-Path $toolsRoot 'aapt2.exe') @('dump','badging',$outputApk)
Write-Host "APK ready: $outputApk"
