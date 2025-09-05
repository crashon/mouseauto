from cx_Freeze import setup, Executable
import sys

# Dependencies are automatically detected, but it might need fine tuning.
build_options = {
    'packages': ['tkinter', 'pynput', 'threading', 'json', 'time', 'datetime', 'os'],
    'excludes': [],
    'include_files': []
}

base = 'Win32GUI' if sys.platform == 'win32' else None

executables = [
    Executable('main.py', base=base, target_name='MouseAutoApp.exe')
]

setup(
    name='MouseAutoApp',
    version='1.0',
    description='마우스 자동 클릭 애플리케이션',
    options={'build_exe': build_options},
    executables=executables
)
