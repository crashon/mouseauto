@echo off
echo Installing PyInstaller...
python -m pip install pyinstaller

echo Building executable...
pyinstaller --onefile --windowed --name "MouseAutoApp" --icon=icon.ico main.py

echo Build complete!
echo Executable file is located in: dist\MouseAutoApp.exe
pause
