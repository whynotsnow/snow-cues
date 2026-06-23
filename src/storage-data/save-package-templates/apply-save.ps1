$ErrorActionPreference = "Stop"
$PackageDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PathFile = Join-Path $PackageDir "storageData-path.txt"
$ManifestFile = Join-Path $PackageDir "manifest.json"

if (!(Test-Path $PathFile)) { throw "缺少 storageData-path.txt。" }
if (!(Test-Path $ManifestFile)) { throw "缺少 manifest.json。" }

$TargetDir = Get-Content $PathFile | Where-Object { $_.Trim() -and !$_.Trim().StartsWith("#") } | Select-Object -First 1
if (!$TargetDir) { throw "请先编辑 storageData-path.txt，填写 storageData 文件夹路径。" }
if (!(Test-Path -Path $TargetDir -PathType Container)) { throw "目标 storageData 文件夹不存在：$TargetDir" }

$Manifest = Get-Content $ManifestFile -Raw | ConvertFrom-Json
$CandidatePath = Join-Path $PackageDir $Manifest.candidateFileName
$RevisionSource = Join-Path (Join-Path $PackageDir "revisions") $Manifest.revisionFileName
$RevisionsDir = Join-Path $TargetDir "revisions"
$ConflictsDir = Join-Path $TargetDir "conflicts"
$CurrentPath = Join-Path $TargetDir "current.json"

if (!(Test-Path $CandidatePath)) { throw "缺少候选 current 文件：$($Manifest.candidateFileName)" }
if (!(Test-Path $RevisionSource)) { throw "缺少 revision 文件：$($Manifest.revisionFileName)" }

New-Item -ItemType Directory -Force -Path $RevisionsDir | Out-Null
New-Item -ItemType Directory -Force -Path $ConflictsDir | Out-Null

if ([int]$Manifest.openedRevision -eq 0) {
  if (Test-Path $CurrentPath) {
    Copy-Item $CandidatePath (Join-Path $ConflictsDir $Manifest.conflictFileName) -Force
    throw "目标已存在 current.json，已写入 conflicts/$($Manifest.conflictFileName)，未覆盖。"
  }
} else {
  if (!(Test-Path $CurrentPath)) { throw "目标缺少 current.json，无法校验基线。" }
  $Current = Get-Content $CurrentPath -Raw | ConvertFrom-Json
  if ([int]$Current.revision -ne [int]$Manifest.openedRevision -or [string]$Current.contentHash -ne [string]$Manifest.openedHash) {
    Copy-Item $CandidatePath (Join-Path $ConflictsDir $Manifest.conflictFileName) -Force
    throw "目标 current.json 已变化，已写入 conflicts/$($Manifest.conflictFileName)，未覆盖。"
  }
}

Copy-Item $RevisionSource (Join-Path $RevisionsDir $Manifest.revisionFileName) -Force
Copy-Item $CandidatePath $CurrentPath -Force

Get-ChildItem $RevisionsDir -File -Filter "storage-data-rev-*.json" |
  Where-Object { $_.Name -match '^storage-data-rev-\d{6}\.json$' } |
  Sort-Object Name -Descending |
  Select-Object -Skip ([int]$Manifest.revisionRetention) |
  Remove-Item -Force

Write-Host "Snow Cues 保存包已应用。"
