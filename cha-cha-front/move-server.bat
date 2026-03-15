@echo off
echo 正在移动 server 目录到上级目录...
echo.

if exist "..\server" (
    echo 目标目录已存在，请先删除 d:\code\mini-program\server 或重命名
    pause
    exit /b 1
)

move "server" "..\server"

if %errorlevel% equ 0 (
    echo.
    echo 移动成功！
    echo.
    echo 新目录结构:
    echo   d:\code\mini-program\
    echo   ├── cha-cha\      ^(小程序^)
    echo   └── server\       ^(后端服务^)
    echo.
    echo 请更新小程序 app.js 中的 baseUrl 为: http://localhost:3000
) else (
    echo 移动失败，请手动移动 server 目录
)

pause
