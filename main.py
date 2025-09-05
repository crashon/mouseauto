import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import time
import threading
from datetime import datetime
from pynput import mouse, keyboard
from pynput.mouse import Button, Listener as MouseListener
from pynput.keyboard import Key, Listener as KeyboardListener
import os

class MouseAutoApp:
    def __init__(self, root):
        self.root = root
        self.root.title("마우스 자동 클릭 애플리케이션")
        self.root.geometry("600x550")
        self.root.resizable(False, False)
        
        # 상태 변수들
        self.is_recording = False
        self.is_playing = False
        self.recorded_actions = []
        self.current_recording = []
        self.mouse_listener = None
        self.keyboard_listener = None
        self.play_thread = None
        self.auto_thread = None
        self.interval_minutes = 1
        self.auto_mode = False
        self.execution_count = 0
        self.remaining_seconds = 0
        self.timer_thread = None
        
        self.setup_ui()
        self.setup_hotkeys()
        
    def setup_ui(self):
        # 메인 프레임
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 제목
        title_label = ttk.Label(main_frame, text="마우스 자동 클릭 애플리케이션", 
                               font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        # 녹화 섹션
        record_frame = ttk.LabelFrame(main_frame, text="녹화 제어", padding="10")
        record_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        self.record_btn = ttk.Button(record_frame, text="녹화 시작 (F1)", 
                                    command=self.toggle_recording, width=15)
        self.record_btn.grid(row=0, column=0, padx=(0, 10))
        
        self.clear_btn = ttk.Button(record_frame, text="녹화 초기화", 
                                   command=self.clear_recording, width=15)
        self.clear_btn.grid(row=0, column=1, padx=(0, 10))
        
        self.record_status = ttk.Label(record_frame, text="대기 중", foreground="blue")
        self.record_status.grid(row=0, column=2)
        
        # 녹화된 동작 표시
        actions_frame = ttk.LabelFrame(main_frame, text="녹화된 동작", padding="10")
        actions_frame.grid(row=2, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 스크롤바가 있는 텍스트 위젯
        text_frame = ttk.Frame(actions_frame)
        text_frame.grid(row=0, column=0, sticky=(tk.W, tk.E))
        
        self.actions_text = tk.Text(text_frame, height=8, width=70, state=tk.DISABLED)
        scrollbar = ttk.Scrollbar(text_frame, orient=tk.VERTICAL, command=self.actions_text.yview)
        self.actions_text.configure(yscrollcommand=scrollbar.set)
        
        self.actions_text.grid(row=0, column=0, sticky=(tk.W, tk.E))
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # 재생 섹션
        play_frame = ttk.LabelFrame(main_frame, text="재생 제어", padding="10")
        play_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        self.play_btn = ttk.Button(play_frame, text="재생 시작 (F2)", 
                                  command=self.toggle_playback, width=15)
        self.play_btn.grid(row=0, column=0, padx=(0, 10))
        
        self.auto_btn = ttk.Button(play_frame, text="자동 실행 시작", 
                                  command=self.toggle_auto_mode, width=15)
        self.auto_btn.grid(row=0, column=1, padx=(0, 10))
        
        self.play_status = ttk.Label(play_frame, text="대기 중", foreground="blue")
        self.play_status.grid(row=0, column=2)
        
        # 실행 횟수 및 남은 시간 표시
        self.execution_count_label = ttk.Label(play_frame, text="실행 횟수: 0회", foreground="gray")
        self.execution_count_label.grid(row=1, column=0, columnspan=3, pady=(5, 0))
        
        self.remaining_time_label = ttk.Label(play_frame, text="", foreground="gray")
        self.remaining_time_label.grid(row=2, column=0, columnspan=3, pady=(2, 0))
        
        # 설정 섹션
        settings_frame = ttk.LabelFrame(main_frame, text="설정", padding="10")
        settings_frame.grid(row=4, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(settings_frame, text="실행 간격 (분):").grid(row=0, column=0, padx=(0, 5))
        
        self.interval_var = tk.StringVar(value="1")
        interval_spinbox = ttk.Spinbox(settings_frame, from_=1, to=60, width=10, 
                                      textvariable=self.interval_var,
                                      command=self.update_interval)
        interval_spinbox.grid(row=0, column=1, padx=(0, 20))
        
        # 값 변경 시에도 업데이트되도록 바인딩 추가
        self.interval_var.trace('w', lambda *args: self.update_interval())
        
        # 파일 저장/로드
        file_frame = ttk.Frame(main_frame)
        file_frame.grid(row=5, column=0, columnspan=3, pady=(10, 0))
        
        ttk.Button(file_frame, text="저장", command=self.save_recording, width=12).grid(row=0, column=0, padx=(0, 10))
        ttk.Button(file_frame, text="불러오기", command=self.load_recording, width=12).grid(row=0, column=1, padx=(0, 10))
        ttk.Button(file_frame, text="종료", command=self.on_closing, width=12).grid(row=0, column=2)
        
        # 상태 표시
        self.status_label = ttk.Label(main_frame, text="F1: 녹화 시작/종료, F2: 재생 시작/종료, ESC: 모든 작업 중지", 
                                     foreground="gray")
        self.status_label.grid(row=6, column=0, columnspan=3, pady=(10, 0))
        
    def setup_hotkeys(self):
        """전역 핫키 설정"""
        def on_press(key):
            try:
                if key == Key.f1:
                    self.toggle_recording()
                elif key == Key.f2:
                    self.toggle_playback()
                elif key == Key.esc:
                    self.stop_all()
            except AttributeError:
                pass
        
        self.keyboard_listener = KeyboardListener(on_press=on_press)
        self.keyboard_listener.start()
    
    def toggle_recording(self):
        """녹화 시작/종료"""
        if not self.is_recording:
            self.start_recording()
        else:
            self.stop_recording()
    
    def start_recording(self):
        """녹화 시작"""
        if self.is_playing:
            messagebox.showwarning("경고", "재생 중에는 녹화할 수 없습니다.")
            return
            
        self.is_recording = True
        self.current_recording = []
        self.record_start_time = time.time()
        
        self.record_btn.config(text="녹화 중지 (F1)")
        self.record_status.config(text="녹화 중...", foreground="red")
        
        def on_click(x, y, button, pressed):
            if self.is_recording and pressed:
                action = {
                    'type': 'click',
                    'x': x,
                    'y': y,
                    'button': button.name,
                    'time': time.time() - self.record_start_time
                }
                self.current_recording.append(action)
                self.update_actions_display()
        
        def on_scroll(x, y, dx, dy):
            if self.is_recording:
                action = {
                    'type': 'scroll',
                    'x': x,
                    'y': y,
                    'dx': dx,
                    'dy': dy,
                    'time': time.time() - self.record_start_time
                }
                self.current_recording.append(action)
                self.update_actions_display()
        
        self.mouse_listener = MouseListener(on_click=on_click, on_scroll=on_scroll)
        self.mouse_listener.start()
        
    def stop_recording(self):
        """녹화 중지"""
        self.is_recording = False
        
        if self.mouse_listener:
            self.mouse_listener.stop()
            self.mouse_listener = None
        
        if self.current_recording:
            # 녹화 종료 시점의 마지막 클릭 제거 (녹화 중지 버튼 클릭)
            # 마지막 클릭이 녹화 종료 후 0.5초 이내에 발생했다면 제거
            if (self.current_recording and 
                len(self.current_recording) > 1 and
                time.time() - self.record_start_time - self.current_recording[-1]['time'] < 0.5):
                self.current_recording.pop()
            
            self.recorded_actions = self.current_recording.copy()
            messagebox.showinfo("완료", f"{len(self.recorded_actions)}개의 동작이 녹화되었습니다.")
        
        self.record_btn.config(text="녹화 시작 (F1)")
        self.record_status.config(text="대기 중", foreground="blue")
        
    def clear_recording(self):
        """녹화 초기화"""
        if self.is_recording:
            self.stop_recording()
        
        self.recorded_actions = []
        self.current_recording = []
        self.update_actions_display()
        messagebox.showinfo("완료", "녹화가 초기화되었습니다.")
        
    def update_actions_display(self):
        """녹화된 동작 표시 업데이트"""
        self.actions_text.config(state=tk.NORMAL)
        self.actions_text.delete(1.0, tk.END)
        
        actions = self.current_recording if self.is_recording else self.recorded_actions
        
        for i, action in enumerate(actions):
            if action['type'] == 'click':
                text = f"{i+1}. 클릭: ({action['x']}, {action['y']}) - {action['button']} 버튼 (시간: {action['time']:.2f}초)\n"
                self.actions_text.insert(tk.END, text)
            elif action['type'] == 'scroll':
                direction = "위로" if action['dy'] > 0 else "아래로"
                text = f"{i+1}. 스크롤: ({action['x']}, {action['y']}) - {direction} {abs(action['dy'])} (시간: {action['time']:.2f}초)\n"
                self.actions_text.insert(tk.END, text)
        
        self.actions_text.config(state=tk.DISABLED)
        self.actions_text.see(tk.END)
        
    def toggle_playback(self):
        """재생 시작/종료"""
        if not self.is_playing:
            self.start_playback()
        else:
            self.stop_playback()
            
    def start_playback(self):
        """재생 시작"""
        if not self.recorded_actions:
            messagebox.showwarning("경고", "녹화된 동작이 없습니다.")
            return
            
        if self.is_recording:
            messagebox.showwarning("경고", "녹화 중에는 재생할 수 없습니다.")
            return
        
        self.is_playing = True
        self.play_btn.config(text="재생 중지 (F2)")
        self.play_status.config(text="재생 중...", foreground="red")
        
        self.play_thread = threading.Thread(target=self.playback_worker)
        self.play_thread.daemon = True
        self.play_thread.start()
        
    def stop_playback(self):
        """재생 중지"""
        self.is_playing = False
        self.play_btn.config(text="재생 시작 (F2)")
        self.play_status.config(text="대기 중", foreground="blue")
        
    def playback_worker(self):
        """재생 작업자 스레드"""
        try:
            mouse_controller = mouse.Controller()
            previous_time = 0
            
            for action in self.recorded_actions:
                if not self.is_playing:
                    break
                    
                # 이전 동작과의 시간 간격 계산 (상대적 시간)
                time_diff = action['time'] - previous_time
                if time_diff > 0:
                    time.sleep(min(time_diff, 5.0))  # 최대 5초 제한
                
                if action['type'] == 'click':
                    # 마우스 이동 및 클릭
                    mouse_controller.position = (action['x'], action['y'])
                    time.sleep(0.1)  # 안정성을 위한 짧은 대기
                    
                    button = Button.left if action['button'] == 'left' else Button.right
                    mouse_controller.click(button)
                    
                elif action['type'] == 'scroll':
                    # 마우스 위치 이동 후 스크롤
                    mouse_controller.position = (action['x'], action['y'])
                    time.sleep(0.1)  # 안정성을 위한 짧은 대기
                    
                    mouse_controller.scroll(action['dx'], action['dy'])
                
                previous_time = action['time']
                    
        except Exception as e:
            messagebox.showerror("오류", f"재생 중 오류가 발생했습니다: {str(e)}")
        finally:
            if self.is_playing:
                self.root.after(0, self.stop_playback)
                
    def toggle_auto_mode(self):
        """자동 실행 모드 토글"""
        if not self.auto_mode:
            self.start_auto_mode()
        else:
            self.stop_auto_mode()
            
    def start_auto_mode(self):
        """자동 실행 모드 시작"""
        if not self.recorded_actions:
            messagebox.showwarning("경고", "녹화된 동작이 없습니다.")
            return
        
        # 현재 설정된 간격 값을 읽어옴
        self.update_interval()
            
        self.auto_mode = True
        self.execution_count = 0
        self.auto_btn.config(text="자동 실행 중지")
        self.play_status.config(text=f"자동 실행 중 ({self.interval_minutes}분 간격)", foreground="green")
        self.execution_count_label.config(text="실행 횟수: 0회")
        self.remaining_time_label.config(text="")
        
        self.auto_thread = threading.Thread(target=self.auto_worker)
        self.auto_thread.daemon = True
        self.auto_thread.start()
        
    def stop_auto_mode(self):
        """자동 실행 모드 중지"""
        self.auto_mode = False
        self.auto_btn.config(text="자동 실행 시작")
        self.play_status.config(text="대기 중", foreground="blue")
        self.execution_count_label.config(text=f"실행 횟수: {self.execution_count}회 (중지됨)")
        self.remaining_time_label.config(text="")
        
    def auto_worker(self):
        """자동 실행 작업자 스레드"""
        while self.auto_mode:
            try:
                # 한 번 실행
                self.execute_actions()
                self.execution_count += 1
                
                # UI 업데이트
                self.root.after(0, lambda: self.execution_count_label.config(
                    text=f"실행 횟수: {self.execution_count}회"))
                
                # 다음 실행까지 대기 (남은 시간 표시)
                self.remaining_seconds = self.interval_minutes * 60
                for _ in range(self.interval_minutes * 60):
                    if not self.auto_mode:
                        break
                    
                    # 남은 시간 UI 업데이트
                    minutes = self.remaining_seconds // 60
                    seconds = self.remaining_seconds % 60
                    time_text = f"다음 실행까지: {minutes:02d}:{seconds:02d}"
                    self.root.after(0, lambda t=time_text: self.remaining_time_label.config(text=t))
                    
                    time.sleep(1)
                    self.remaining_seconds -= 1
                
                # 대기 완료 후 남은 시간 표시 초기화
                if self.auto_mode:
                    self.root.after(0, lambda: self.remaining_time_label.config(text="실행 중..."))
                    
            except Exception as e:
                messagebox.showerror("오류", f"자동 실행 중 오류가 발생했습니다: {str(e)}")
                break
                
    def execute_actions(self):
        """동작 실행"""
        mouse_controller = mouse.Controller()
        previous_time = 0
        
        for action in self.recorded_actions:
            if not self.auto_mode:
                break
                
            # 이전 동작과의 시간 간격 계산 (상대적 시간)
            time_diff = action['time'] - previous_time
            if time_diff > 0:
                time.sleep(min(time_diff, 5.0))  # 최대 5초 제한
            
            if action['type'] == 'click':
                mouse_controller.position = (action['x'], action['y'])
                time.sleep(0.1)  # 안정성을 위한 짧은 대기
                
                button = Button.left if action['button'] == 'left' else Button.right
                mouse_controller.click(button)
                
            elif action['type'] == 'scroll':
                mouse_controller.position = (action['x'], action['y'])
                time.sleep(0.1)  # 안정성을 위한 짧은 대기
                
                mouse_controller.scroll(action['dx'], action['dy'])
            
            previous_time = action['time']
                
    def update_interval(self):
        """실행 간격 업데이트"""
        try:
            self.interval_minutes = int(self.interval_var.get())
        except ValueError:
            self.interval_minutes = 1
            self.interval_var.set("1")
            
    def stop_all(self):
        """모든 작업 중지"""
        if self.is_recording:
            self.stop_recording()
        if self.is_playing:
            self.stop_playback()
        if self.auto_mode:
            self.stop_auto_mode()
            
    def save_recording(self):
        """녹화 저장"""
        if not self.recorded_actions:
            messagebox.showwarning("경고", "저장할 녹화가 없습니다.")
            return
            
        filename = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        
        if filename:
            try:
                data = {
                    'actions': self.recorded_actions,
                    'created': datetime.now().isoformat(),
                    'count': len(self.recorded_actions)
                }
                
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                    
                messagebox.showinfo("완료", f"녹화가 저장되었습니다: {filename}")
            except Exception as e:
                messagebox.showerror("오류", f"저장 중 오류가 발생했습니다: {str(e)}")
                
    def load_recording(self):
        """녹화 불러오기"""
        filename = filedialog.askopenfilename(
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        
        if filename:
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                self.recorded_actions = data.get('actions', [])
                self.update_actions_display()
                
                messagebox.showinfo("완료", f"{len(self.recorded_actions)}개의 동작을 불러왔습니다.")
            except Exception as e:
                messagebox.showerror("오류", f"불러오기 중 오류가 발생했습니다: {str(e)}")
                
    def on_closing(self):
        """애플리케이션 종료"""
        self.stop_all()
        
        if self.keyboard_listener:
            self.keyboard_listener.stop()
            
        self.root.quit()
        self.root.destroy()

def main():
    root = tk.Tk()
    app = MouseAutoApp(root)
    
    # 종료 이벤트 처리
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    
    try:
        root.mainloop()
    except KeyboardInterrupt:
        app.on_closing()

if __name__ == "__main__":
    main()
