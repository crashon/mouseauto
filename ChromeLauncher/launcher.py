import os
import json
import time
import subprocess
import sys
import argparse

def get_chrome_paths():
    """Returns (chrome_exe, user_data_dir)"""
    local_app_data = os.environ.get('LOCALAPPDATA')
    if not local_app_data:
        return None, None
        
    common_exe_paths = [
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        os.path.join(local_app_data, r"Google\Chrome\Application\chrome.exe")
    ]
    
    chrome_exe = None
    for path in common_exe_paths:
        if os.path.exists(path):
            chrome_exe = path
            break
            
    user_data_dir = os.path.join(local_app_data, r"Google\Chrome\User Data")
    
    return chrome_exe, user_data_dir

def list_profiles():
    chrome_exe, user_data_dir = get_chrome_paths()
    local_state_path = os.path.join(user_data_dir, 'Local State')
    
    if not os.path.exists(local_state_path):
        print(f"Error: Local State not found at {local_state_path}")
        return []

    try:
        with open(local_state_path, 'r', encoding='utf-8') as f:
            local_state = json.load(f)
    except Exception as e:
        print(f"Error reading Local State: {e}")
        return []
        
    profile_info = local_state.get('profile', {}).get('info_cache', {})
    profiles_order = local_state.get('profile', {}).get('profiles_order', [])
    
    # If profiles_order exists, use it to maintain order, otherwise use keys
    profile_dirs = profiles_order if profiles_order else list(profile_info.keys())
    
    result = []
    for dir_name in profile_dirs:
        info = profile_info.get(dir_name, {})
        result.append({
            'directory': dir_name,
            'name': info.get('name', dir_name),
            'user_name': info.get('user_name', 'N/A')
        })
    return result

def launch_profiles(interval=30):
    chrome_exe, user_data_dir = get_chrome_paths()
    if not chrome_exe:
        print("Error: Could not find chrome.exe in common locations.")
        return

    profiles = list_profiles()
    if not profiles:
        print("No profiles found.")
        return

    print(f"Starting to launch {len(profiles)} profiles every {interval} seconds...\n")
    
    for i, profile in enumerate(profiles):
        dir_name = profile['directory']
        display_name = profile['name']
        
        print(f"[{i+1}/{len(profiles)}] Launching profile: {display_name} ({dir_name})")
        
        try:
            # Command: chrome.exe --profile-directory="Profile Name"
            subprocess.Popen([chrome_exe, f'--profile-directory={dir_name}'])
        except Exception as e:
            print(f"Failed to launch {dir_name}: {e}")
            
        if i < len(profiles) - 1:
            print(f"Waiting {interval} seconds for next profile...")
            time.sleep(interval)

    print("\nAll profiles have been launched.")

if __name__ == "__main__":
    # Ensure UTF-8 output even on Windows consoles
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    elif os.name == 'nt':
        # Fallback for older python versions if needed
        import codecs
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

    parser = argparse.ArgumentParser(description="Chrome Profile Launcher")
    parser.add_argument("--check", action="store_true", help="Only list the found profiles without launching")
    parser.add_argument("--interval", type=int, default=30, help="Interval in seconds between launches (default: 30)")
    
    args = parser.parse_args()
    
    if args.check:
        profiles = list_profiles()
        print(f"Found {len(profiles)} profiles:")
        print("-" * 50)
        for p in profiles:
            print(f"- {p['name']} (Directory: {p['directory']}, User: {p['user_name']})")
        print("-" * 50)
    else:
        launch_profiles(args.interval)
