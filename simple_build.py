import os
import subprocess
import sys

# 현재 디렉토리로 이동
os.chdir(r'e:\github\crashon\mouseauto')

# PyInstaller 명령어 실행
cmd = [
    r'C:\Users\cyansoul\AppData\Local\Programs\Python\Python310\Scripts\pyinstaller.exe',
    '--onefile',
    '--windowed', 
    '--name', 'MouseAutoApp',
    '--distpath', './dist',
    '--workpath', './build',
    'main.py'
]

print("Building executable...")
print(f"Command: {' '.join(cmd)}")

try:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    print(f"Return code: {result.returncode}")
    print(f"Stdout: {result.stdout}")
    print(f"Stderr: {result.stderr}")
    
    if result.returncode == 0:
        print("✓ Build successful!")
        if os.path.exists('./dist/MouseAutoApp.exe'):
            print("✓ EXE file created: ./dist/MouseAutoApp.exe")
        else:
            print("✗ EXE file not found")
    else:
        print("✗ Build failed")
        
except subprocess.TimeoutExpired:
    print("✗ Build timed out")
except Exception as e:
    print(f"✗ Error: {e}")
