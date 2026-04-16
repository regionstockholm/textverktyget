@echo off
setlocal
title Textverktyg - Start Docker

call :resolve_compose
if errorlevel 1 goto :end

echo.
echo Starting Textverktyg containers...
%COMPOSE_CMD% up --build -d
if errorlevel 1 (
  echo.
  echo Start failed.
  goto :end
)

echo.
echo Containers are up.
echo App: http://localhost:3000

:end
echo.
pause
exit /b

:resolve_compose
docker compose version >nul 2>&1
if not errorlevel 1 (
  set "COMPOSE_CMD=docker compose"
  exit /b 0
)

docker-compose version >nul 2>&1
if not errorlevel 1 (
  set "COMPOSE_CMD=docker-compose"
  exit /b 0
)

echo Docker Compose was not found.
echo Please install Docker Desktop and try again.
exit /b 1
