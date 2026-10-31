<# LEO Unitmix - BO CAI CAU AI (Leo AI dung tai khoan Claude dang nhap tren may, khong can khoa API).

   Nguoi dung KHONG chay tep nay truc tiep: nut "Tai bo cai cau AI" trong Cai dat Leo AI tai Cai_Cau_AI_Unitmix.bat; tep .bat
   tai cau_claude.py + tep nay tu chinh dia chi app ve %LOCALAPPDATA%\LeoUnitmix\cau roi chay tep nay voi -Goc <dia chi app>.
   Tep nay chi dung chu khong dau (PowerShell 5.1 doc .ps1 khong BOM theo bang ma ANSI).

   Lam lan luot, chay lai lan 2 em (khong cai trung):
     1. Claude Code CLI: co thi bo qua; chua co -> bo cai chinh thuc cua Anthropic (irm https://claude.ai/install.ps1 | iex),
        hong thi npm neu may co Node. (Claude Code tren Windows can Git for Windows -> thieu thi hoi cai bang winget.)
     2. Dang nhap: `claude auth status` - chua thi chay `claude auth login` de NGUOI DUNG tu dang nhap trong trinh duyet.
        Bo cai khong bao gio hoi / go / luu mat khau hay khoa.
     3. Python cho cau: dung Python >= 3.8 co san; khong co thi tai Python NHUNG chinh thuc cua python.org (~11 MB, khong cai
        vao he thong, chi giai nen vao %LOCALAPPDATA%\LeoUnitmix\python).
     4. Ghi cau_claude.json (dia chi app = nguon duoc phep + tram dien thoai), tu chay ngam khi dang nhap Windows (pythonw,
        khong cua so; -TuChay N de tat). Nhat ky: LeoUnitmix\cau.log.
     5. Bat cau, do http://127.0.0.1:3032/suc-khoe, in "Da san sang".

   Tham so: -Goc <https://dia-chi-app> (bat buoc de ghep dien thoai) - -TuChay Y|N - -KhongHoi (khong hoi, khong cho Enter,
   khong tu dang nhap) - -KhongBatCau (khong bat cau o buoc 5).
#>
param([string]$Goc = "", [string]$TuChay = "", [switch]$KhongHoi, [switch]$KhongBatCau)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { $Host.UI.RawUI.WindowTitle = 'Cai Cau AI - LEO Unitmix' } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$GOC_DL = Join-Path $env:LOCALAPPDATA 'LeoUnitmix'
$CAU    = Join-Path $GOC_DL 'cau'
$PYNH   = Join-Path $GOC_DL 'python'
$CONG   = 3032
$TEN_LOI_TAT = 'Cau AI Leo Unitmix'
$Goc = $Goc.Trim().TrimEnd('/')

function Buoc($n, $t) { Write-Host ""; Write-Host "[$n/5] $t" -ForegroundColor Cyan }
function Ok($t)   { Write-Host "   OK   $t" -ForegroundColor Green }
function Canh($t) { Write-Host "   !!   $t" -ForegroundColor Yellow }
function Loi($t)  { Write-Host "   LOI  $t" -ForegroundColor Red }
function Cho()    { if (-not $KhongHoi) { [void](Read-Host "Bam Enter de dong cua so") } }
function HoiYN($cau, $macDinh) {
  if ($KhongHoi) { return $macDinh }
  $r = Read-Host "$cau (Y = co / N = khong)"
  if (-not $r) { return $macDinh }
  return ($r -match '^\s*[yYcC]')
}

function LamMoiPath {
  # bo cai Claude / npm / winget ghi PATH vao registry - tien trinh dang chay khong thay, phai nap lai
  $ds = @([Environment]::GetEnvironmentVariable('Path', 'Machine'), [Environment]::GetEnvironmentVariable('Path', 'User'),
          (Join-Path $env:USERPROFILE '.local\bin'), (Join-Path $env:APPDATA 'npm'), $env:Path)
  $env:Path = (($ds | Where-Object { $_ }) -join ';')
}
function TimClaude {
  LamMoiPath
  $c = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.Source }
  foreach ($p in @((Join-Path $env:USERPROFILE '.local\bin\claude.exe'), (Join-Path $env:APPDATA 'npm\claude.cmd'))) {
    if (Test-Path $p) { return $p }
  }
  return $null
}
function PhienBanClaude($cl) {
  try { return ((& $cl --version 2>$null) | Out-String).Trim() } catch { return '' }
}
function TrangThaiDangNhap($cl) {
  # `claude auth status --json` -> {loggedIn, authMethod, email, subscriptionType...} - KHONG ton luot AI
  try {
    $ra = ((& $cl auth status --json 2>$null) | Out-String)
    $i = $ra.IndexOf('{')
    if ($i -lt 0) { return $null }
    return ($ra.Substring($i) | ConvertFrom-Json)
  } catch { return $null }
}
function TimPython {
  $nh = Join-Path $PYNH 'python.exe'
  if (Test-Path $nh) { return $nh }
  foreach ($thu in @(@('py', '-3'), @('python'), @('python3'))) {
    $lenh = Get-Command $thu[0] -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $lenh) { continue }
    $dau = @(); if ($thu.Count -gt 1) { $dau = $thu[1..($thu.Count - 1)] }
    try {
      # python.exe "gia" cua Microsoft Store (WindowsApps) khong in gi -> bi loai
      $ra = ((& $lenh.Source @dau -c "import sys;print(sys.executable);print(int(sys.version_info>=(3,8)))" 2>$null) | Out-String).Trim() -split "`r?`n"
      if ($ra.Count -ge 2 -and $ra[1].Trim() -eq '1' -and (Test-Path $ra[0].Trim())) { return $ra[0].Trim() }
    } catch {}
  }
  return $null
}
function SucKhoe {
  try { return Invoke-RestMethod -Uri "http://127.0.0.1:$CONG/suc-khoe" -TimeoutSec 4 -UseBasicParsing } catch { return $null }
}
function LoiTat($duong, $dich, $kieu, $doi = '') {
  $sh = New-Object -ComObject WScript.Shell
  $l = $sh.CreateShortcut($duong)
  $l.TargetPath = $dich
  $l.Arguments = $doi
  $l.WorkingDirectory = $CAU
  $l.WindowStyle = $kieu                                     # 1 = thuong - 7 = thu nho
  $l.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
  $l.Description = "Cau Claude cho Leo AI cua LEO Unitmix (127.0.0.1:$CONG)"
  $l.Save()
}

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host " LEO Unitmix - Cai Cau AI (Leo AI dung tai khoan Claude tren may)" -ForegroundColor Cyan
Write-Host " Thu muc cai: $CAU" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host " Can Claude Code da CAI va DANG NHAP (tai khoan Claude Pro/Max)."
Write-Host " Bo cai khong hoi, khong go, khong luu mat khau hay khoa nao - ban tu dang nhap trong trinh duyet."

# ---------------------------------------------------------------- 1 - Claude Code CLI
Buoc 1 'Kiem Claude Code (claude --version)'
$cl = TimClaude
if ($cl) {
  Ok ("Da co Claude Code " + (PhienBanClaude $cl) + " - bo qua buoc cai")
} else {
  Canh 'May CHUA co Claude Code - cai bang bo cai chinh thuc cua Anthropic: irm https://claude.ai/install.ps1 | iex'
  & powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://claude.ai/install.ps1 | iex"
  $cl = TimClaude
  if (-not $cl -and (Get-Command npm -ErrorAction SilentlyContinue)) {
    Canh 'Bo cai chinh thuc chua xong - thu cai bang npm: npm install -g @anthropic-ai/claude-code'
    & npm install -g '@anthropic-ai/claude-code'
    $cl = TimClaude
  }
  if (-not $cl) {
    Loi 'Chua cai duoc Claude Code. Cai tay theo https://docs.claude.com/en/docs/claude-code/setup roi chay lai bo cai nay.'
    Cho; exit 1
  }
  Ok ("Da cai Claude Code " + (PhienBanClaude $cl) + " - $cl")
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Canh 'May chua co Git for Windows - Claude Code tren Windows can Git Bash de chay.'
  if ((Get-Command winget -ErrorAction SilentlyContinue) -and (HoiYN 'Cai Git for Windows bang winget ngay bay gio?' $false)) {
    & winget install --id Git.Git -e --source winget
    LamMoiPath
  }
  if (Get-Command git -ErrorAction SilentlyContinue) { Ok 'Da co Git for Windows' }
  else { Canh 'Chua co Git - neu AI bao loi "requires git-bash", cai Git tai https://git-scm.com/downloads/win roi chay lai.' }
}

# ---------------------------------------------------------------- 2 - Dang nhap
Buoc 2 'Kiem dang nhap Claude Code (claude auth status)'
$tt = TrangThaiDangNhap $cl
if ($tt -and $tt.loggedIn) {
  $ai = @($tt.email, $tt.emailAddress, $tt.organizationName) | Where-Object { $_ } | Select-Object -First 1
  Ok ("Da dang nhap" + $(if ($ai) { " - $ai" } else { '' }) + $(if ($tt.subscriptionType) { " ($($tt.subscriptionType))" } else { '' }) + " - bo qua buoc dang nhap")
} elseif ($KhongHoi) {
  Canh 'Claude Code CHUA DANG NHAP - chay "claude auth login" (hoac bam Dang nhap Claude trong Cai dat Leo AI).'
} else {
  Canh 'Claude Code CHUA DANG NHAP. Buoc nay mo trang dang nhap Claude trong trinh duyet -'
  Canh 'BAN tu dang nhap bang tai khoan Claude Pro/Max, xong quay lai cua so nay.'
  [void](Read-Host 'Bam Enter de bat dau dang nhap')
  & $cl auth login
  $tt = TrangThaiDangNhap $cl
  if ($tt -and $tt.loggedIn) { Ok 'Da dang nhap Claude Code' }
  else { Canh 'Chua dang nhap duoc - van cai tiep. Lam sau: trong app bam Dang nhap Claude (hoac chay claude auth login).' }
}

# ---------------------------------------------------------------- 3 - Python cho cau
Buoc 3 'Kiem Python cho cau (cau = cau_claude.py, chi dung thu vien chuan)'
$py = TimPython
if ($py) {
  Ok "Dung Python co san: $py"
} else {
  $kt = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
  $url = "https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-$kt.zip"
  Canh "May chua co Python - tai Python nhung chinh thuc (~11 MB, khong cai vao he thong): $url"
  $zip = Join-Path $env:TEMP 'leo_python_nhung.zip'
  try {
    New-Item -ItemType Directory -Force -Path $PYNH | Out-Null
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $PYNH -Force
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
  } catch { Loi ("Tai Python hong: " + $_.Exception.Message) }
  $py = Join-Path $PYNH 'python.exe'
  if (-not (Test-Path $py)) { Loi 'Khong co Python de chay cau - cai Python 3 (python.org) roi chay lai bo cai.'; Cho; exit 1 }
  Ok "Da co Python nhung: $py"
}

# ---------------------------------------------------------------- 4 - Cau + cau hinh + tu chay
Buoc 4 "Cau o $CAU + tu chay ngam"
$cauPy = Join-Path $CAU 'cau_claude.py'
if (-not (Test-Path $cauPy)) { Loi "Khong thay $cauPy - chay lai Cai_Cau_AI_Unitmix.bat tai tu app."; Cho; exit 1 }
# cau cu cua chinh bo cai dang chay -> tat truoc de bat ban moi (chay lai lan 2 em)
$cu = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine -like "*LeoUnitmix\cau\cau_claude.py*" })
foreach ($p in $cu) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }
if ($cu.Count) { Start-Sleep -Milliseconds 800; Ok "Da tat cau cu ($($cu.Count)) de cap nhat" }
# cau_claude.json: dia chi app = nguon duoc goi cau + tram chuyen cho dien thoai
$cfg = @{ nguon = @(); tram = '' }
if ($Goc) { $cfg.nguon = @($Goc); $cfg.tram = $Goc }
[IO.File]::WriteAllText((Join-Path $CAU 'cau_claude.json'), ($cfg | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
Ok $(if ($Goc) { "Da ghi cau_claude.json: app $Goc (dien thoai ghep qua tram)" } else { 'Da ghi cau_claude.json (khong co dia chi app: chi dung tren may nay)' })
$chay = Join-Path $CAU 'chay_cau.cmd'
$noi = "@echo off`r`nchcp 65001 >nul`r`ntitle Cau AI Leo Unitmix (127.0.0.1:$CONG) - giu cua so nay de xem loi`r`n" +
       "set `"PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;%PATH%`"`r`n" +
       "`"$py`" `"%~dp0cau_claude.py`" %*`r`npause`r`n"
[IO.File]::WriteAllText($chay, $noi, (New-Object System.Text.UTF8Encoding($false)))
Ok 'Da tao chay_cau.cmd (mo cau co cua so de xem loi)'
# chay NGAM: pythonw.exe (cung thu muc python.exe - co ca o Python nhung) -> khong cua so, khong thanh tac vu
$pyw = Join-Path (Split-Path $py) 'pythonw.exe'
if (-not (Test-Path $pyw)) { $pyw = $py }
$doiCau = "`"$cauPy`""
$sm = Join-Path ([Environment]::GetFolderPath('Programs')) "$TEN_LOI_TAT.lnk"
LoiTat $sm $pyw 7 $doiCau
Ok "Loi tat Start Menu: $TEN_LOI_TAT (bat lai cau ngam)"
$kd = Join-Path ([Environment]::GetFolderPath('Startup')) "$TEN_LOI_TAT.lnk"
if (-not ($TuChay -match '^[nNkK]')) { LoiTat $kd $pyw 7 $doiCau; Ok 'Cau AI tu chay ngam moi khi dang nhap Windows (khong cua so)' }
else { if (Test-Path $kd) { Remove-Item $kd -Force }; Ok 'Khong tu bat khi dang nhap - mo bang Start Menu' }

# ---------------------------------------------------------------- 5 - Bat cau
Buoc 5 "Bat cau (http://127.0.0.1:$CONG)"
$sk = SucKhoe
if ($sk -and -not $KhongBatCau) {
  Canh 'Cau dang chay san - khong bat them.'
} elseif ($KhongBatCau) {
  Canh 'Bo qua bat cau (-KhongBatCau). Mo bang Start Menu.'
} else {
  Start-Process -FilePath $pyw -ArgumentList $doiCau -WorkingDirectory $CAU -WindowStyle Hidden
  for ($i = 0; $i -lt 20 -and -not $sk; $i++) { Start-Sleep -Seconds 1; $sk = SucKhoe }
  if ($sk) { Ok "Cau da bat, chay ngam (khong cua so) - tu bat lai moi lan dang nhap Windows" }
  else { Loi "Cau chua tra loi sau 20 giay - mo $chay de xem loi (nhat ky: $GOC_DL\cau.log)." }
}
if ($sk -and $sk.dang_nhap -eq $false) {
  Canh 'Cau chay nhung Claude Code CHUA DANG NHAP - bam Dang nhap Claude trong Cai dat Leo AI (hoac chay claude auth login).'
}

Write-Host ""
if ($sk) {
  Write-Host "==============================================================" -ForegroundColor Green
  Write-Host " Da san sang - quay lai app, Cai dat Leo AI, bam Kiem lai" -ForegroundColor Green
  Write-Host " (trinh duyet hoi quyen 'mang cuc bo' thi bam Cho phep)" -ForegroundColor Green
  Write-Host " Dien thoai: trong Cai dat Leo AI bam 'Chep link ghep dien thoai', mo link tren dien thoai MOT lan." -ForegroundColor Green
  Write-Host "==============================================================" -ForegroundColor Green
  if (-not $KhongHoi) { Write-Host " Cua so tu dong sau 8 giay."; Start-Sleep -Seconds 8 }
  exit 0
} else {
  Write-Host " Cai xong. Mo Start Menu - $TEN_LOI_TAT, roi quay lai app bam Kiem lai." -ForegroundColor Yellow
}
Cho
exit 0
