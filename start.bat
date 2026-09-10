@echo off
title Kuromi Coins

:restart
call npx nodemon --exitcrash main.js

echo.
echo Le bot s'est arrete. Redemarrage dans 3 secondes...
timeout /t 3 /nobreak >nul
goto restart
