@echo off
REM G1 gate: robustness + golden regression (ASCII only - per workspace rule)
cd /d %~dp0
echo [G1] running robustness + golden tests...
node test_robustness.js
if errorlevel 1 (
  echo G1 FAILED - deploy blocked
  exit /b 1
)
echo G1 PASS
