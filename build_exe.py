#!/usr/bin/env python3
"""
마우스 자동 클릭 애플리케이션 exe 빌드 스크립트
"""
import subprocess
import sys
import os

def install_pyinstaller():
    """PyInstaller 설치"""
    print("Installing PyInstaller...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("✓ PyInstaller installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install PyInstaller: {e}")
        return False
    return True

def build_exe():
    """exe 파일 빌드"""
    print("Building executable...")
    
    # PyInstaller 명령어 옵션
    cmd = [
        sys.executable, "-m", "PyInstaller",  # 현재 Python으로 PyInstaller 실행
        "--onefile",           # 단일 실행 파일
        "--windowed",          # 콘솔 창 숨김
        "--name", "MouseAutoApp",  # 실행 파일 이름 (영어)
        "--clean",             # 이전 빌드 파일 정리
        "--noconfirm",         # 덮어쓰기 확인 안함
        "main.py"
    ]
    
    try:
        subprocess.check_call(cmd)
        print("✓ Build completed successfully!")
        print("✓ Executable file: dist/MouseAutoApp.exe")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Build failed: {e}")
        return False

def main():
    """메인 함수"""
    print("=" * 50)
    print("마우스 자동 클릭 애플리케이션 EXE 빌드")
    print("=" * 50)
    
    # PyInstaller 설치
    if not install_pyinstaller():
        return
    
    # exe 빌드
    if build_exe():
        print("\n" + "=" * 50)
        print("빌드 완료!")
        print("실행 파일 위치: dist/MouseAutoApp.exe")
        print("이 파일을 다른 컴퓨터에 복사해서 사용할 수 있습니다.")
        print("=" * 50)
    else:
        print("\n빌드 실패!")

if __name__ == "__main__":
    main()
