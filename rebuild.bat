@echo off
setlocal

echo Stopping backend...
docker-compose stop backend
if errorlevel 1 goto error

echo Stopping frontend...
docker-compose stop frontend
if errorlevel 1 goto error

echo Building backend...
docker-compose build backend
if errorlevel 1 goto error

echo Building frontend...
docker-compose build frontend
if errorlevel 1 goto error

echo Starting backend...
docker-compose up -d backend
if errorlevel 1 goto error

echo Starting frontend...
docker-compose up -d frontend
if errorlevel 1 goto error

echo Opening frontend at http://localhost:8500 ...
start "" http://localhost:8500
goto end

:error
echo.
echo [ERROR] Build or start failed. See output above.
exit /b 1

:end
endlocal
