# Run once in PowerShell as Administrator, from the project folder.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$node = (Get-Command node).Source
if (-not (Test-Path "$root\config.json")) { & $node "$root\setup-password.js" }
New-Item -ItemType Directory -Force "$root\logs" | Out-Null

# Firewall: private Wi-Fi, local subnet only
Remove-NetFirewallRule -DisplayName 'RemoteShutdown' -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName 'RemoteShutdown' -Direction Inbound -Protocol TCP -LocalPort 3000 `
  -Action Allow -Profile Private -RemoteAddress LocalSubnet | Out-Null

# Task: start at your login, hidden window, restart if it crashes, runs as you (not admin)
$me = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$node`" `"$root\server.js`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $me
$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName RemoteShutdown -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName RemoteShutdown
Write-Host 'Done. Find your IP with: ipconfig'