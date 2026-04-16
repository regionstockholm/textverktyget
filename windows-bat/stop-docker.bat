@echo off
setlocal
title Textverktyg - Stop Docker

call :resolve_compose
if errorlevel 1 goto :end

echo.
echo Stopping Textverktyg containers...
%COMPOSE_CMD% down
if errorlevel 1 (
  echo.
  echo Stop failed.
  goto :end
)

echo.
echo Containers are stopped.

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
