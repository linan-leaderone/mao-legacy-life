import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {version} = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const runtime = path.join(root, 'desktop/node_modules/electron/dist');
const output = path.join(root, `release/MaoLegacyLife-${version}-Windows-x64`);
await fs.access(path.join(root, 'dist/index.html'));
await fs.access(path.join(runtime, 'electron.exe'));
await fs.mkdir(path.join(root, 'release'), { recursive: true });
// Always constrain cleanup to our own reproducible output directory.
if (path.dirname(output) !== path.join(root, 'release')) throw new Error('Unexpected output path');
await fs.rm(output, { recursive: true, force: true });
await fs.cp(runtime, output, { recursive: true });
await fs.rename(path.join(output, 'electron.exe'), path.join(output, 'MaoLegacyLife.exe'));
const appRoot = path.join(output, 'resources/app');
await fs.mkdir(appRoot, { recursive: true });
for (const name of ['main.cjs', 'preload.cjs', 'api-request.cjs']) await fs.copyFile(path.join(root, 'desktop', name), path.join(appRoot, name));
await fs.writeFile(path.join(appRoot, 'package.json'), JSON.stringify({ name: 'mao-legacy-life', productName: '毛的遗产·人生重开', version, main: 'main.cjs' }));
await fs.cp(path.join(root, 'dist'), path.join(appRoot, 'web'), { recursive: true });
await fs.writeFile(path.join(output, '使用说明.txt'), '毛的遗产·人生重开\r\n解压整个文件夹后，双击 MaoLegacyLife.exe。\r\n首页可选择 ShiWuYan、DeepSeek、Gemini 或自定义 API，再继续人生、新建或读取档案；选择“不联网”也可直接开始。\r\n各服务的连接可在首页分别填写、替换或清除密钥。各服务的密钥与模型独立保存，清空后重启仍保持空值。\r\n自定义 API 支持 OpenAI 兼容、Gemini 原生和 Anthropic Messages 协议，模型可手动填写。\r\n请保留所有同目录文件。应用未进行商业代码签名。\r\n', 'utf8');
const zip = path.join(root, 'release/MaoLegacyLife-Windows-x64.zip');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Compress-Archive -LiteralPath ${quote(output)} -DestinationPath ${quote(zip)} -Force`], { stdio: 'inherit', windowsHide: true });
console.log(zip);
