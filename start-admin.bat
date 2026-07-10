@echo off
set "PROJECT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT%start-admin.ps1"
