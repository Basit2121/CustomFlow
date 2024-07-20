@echo off
pip install pyautogui pillow opencv-python pynput eel pywin32
cls
python main.py

if %errorlevel% neq 0 (
    echo An error occurred. Press any key to exit.
    pause > nul
)

