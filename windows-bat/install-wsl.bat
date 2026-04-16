@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ######################################################
    echo ERROR: This script must be run as an Administrator.
    echo Please right-click the file and select "Run as administrator".
    echo ######################################################
    pause
    exit /b
)

echo Starting WSL installation...
echo ----------------------------------------------------

wsl --install

echo ----------------------------------------------------
echo Installation command complete. 
echo.
echo IMPORTANT: You MUST restart your computer to finish the setup.
echo.
pause
