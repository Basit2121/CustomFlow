import eel
from pynput import mouse
import json
import pyautogui
import time
import shutil
import getpass
import os
import win32con
import win32gui
import ctypes
import atexit
import logging

# Set up logging to track events and actions
logging.basicConfig(filename='automation_log.txt', level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

# Define cursor dimensions
cursor_width = 25
cursor_height = 25

# Load the default system cursor
default_cursor = win32gui.LoadImage(0, 32512, win32con.IMAGE_CURSOR, 0, 0, win32con.LR_SHARED)
# Create a copy of the default cursor to restore later
saved_system_cursor = ctypes.windll.user32.CopyImage(default_cursor, win32con.IMAGE_CURSOR, 
                                                     cursor_width, cursor_height, win32con.LR_COPYFROMRESOURCE)

def change_cursor():
    #Change the system cursor to a custom one.
    new_cursor = win32gui.LoadImage(0, "web/cross_rl.cur", win32con.IMAGE_CURSOR, 
                                    cursor_width, cursor_height, win32con.LR_LOADFROMFILE)
    ctypes.windll.user32.SetSystemCursor(new_cursor, 32512)
    logging.info("Cursor changed to custom cursor")

def restore_cursor():
    #Restore the system cursor to the default.
    ctypes.windll.user32.SetSystemCursor(saved_system_cursor, 32512)
    ctypes.windll.user32.DestroyCursor(saved_system_cursor)
    logging.info("Cursor restored to default")

# Register the restore_cursor function to be called when the program exits
atexit.register(restore_cursor)

# Initialize the Eel library with the 'web' directory
eel.init('web')

def count_png_files():
    #Count the number of PNG files in the current directory.
    count = 0
    directory = os.getcwd()
    for filename in os.listdir(directory):
        if filename.lower().endswith('.png'):
            count += 1
    return count

@eel.expose
def take_screenshot_at_cursor(x, y, size=30):
    #Take a screenshot around the cursor position.
    top_left_x = x - size // 2
    top_left_y = y - size // 2
    file_name = f"obj{count_png_files()+1}.png"
    screenshot = pyautogui.screenshot(region=(top_left_x, top_left_y, size, size))
    screenshot.save(file_name)
    logging.info(f"Screenshot taken and saved as {file_name}")
    return file_name

listener = None
@eel.expose
def start_listener():
    #Start listening for mouse clicks and take screenshots.
    change_cursor()
    
    def on_click(x, y, button, pressed):
        if pressed and button == mouse.Button.left:
            file_name = take_screenshot_at_cursor(x, y)
            listener.stop()
            file_name = file_name.replace(".png", "")
            eel.show_detected_filename(file_name)
            logging.info(f"Object detected and saved as {file_name}")
    
    global listener
    listener = mouse.Listener(on_click=on_click)
    listener.start()
    logging.info("Mouse listener started")

    # Ensure cursor is restored when listener stops
    listener.join()
    restore_cursor()

@eel.expose
def move_file_from_downloads():
    #Move the steps.json file from Downloads to the current directory.
    username = getpass.getuser()
    downloads_folder = f'C:/Users/{username}/Downloads' 
    current_directory = os.getcwd()  
    file_to_move = os.path.join(downloads_folder, 'steps.json')
    if os.path.exists(file_to_move):
        try:
            shutil.move(file_to_move, current_directory)
            logging.info(f"Moved steps.json from Downloads to {current_directory}")
        except Exception as e:
            logging.error(f"Error moving steps.json: {str(e)}")
            try:
                os.remove("steps.json")
                logging.info("Removed existing steps.json in current directory")
            except:
                logging.error("Failed to remove existing steps.json")
            shutil.move(file_to_move, current_directory)
            logging.info(f"Moved steps.json from Downloads to {current_directory} after removing existing file")
    else:
        logging.warning("steps.json not found in Downloads folder")

def perform_action(action):
    #Perform a single action based on its type.
    if action['type'] == 'delay':
        time.sleep(float(action['value']))
        logging.info(f"Delay action: {action['value']} seconds")
    elif action['type'] == 'hotkeys':
        hotkey = tuple(action['value'].split('+'))
        pyautogui.hotkey(*hotkey)
        logging.info(f"Hotkey action: {action['value']}")
    elif action['type'] == 'keystrokes':
        pyautogui.typewrite(action['value'])
        logging.info(f"Keystroke action: {action['value']}")
    elif action['type'] in ['leftClick', 'rightClick']:
        pos = action['value']
        click_func = pyautogui.leftClick if action['type'] == 'leftClick' else pyautogui.rightClick
        if pos['x'] and pos['y'] != "":
            click_func(int(pos['x']), int(pos['y']))
            logging.info(f"{action['type']} action at coordinates: ({pos['x']}, {pos['y']})")
        if pos['object'] != "":
            while True:
                try:
                    target = pyautogui.locateOnScreen(f"{pos['object']}.png", grayscale=False, confidence=0.8)
                    target = pyautogui.center(target)
                    click_func(target)
                    logging.info(f"{action['type']} action on object: {pos['object']}")
                    break
                except:
                    logging.warning(f"Failed to locate object: {pos['object']}")
    elif action['type'] == 'detectObject':
        logging.info(f"Detect object action: {action['value']}")

@eel.expose
def run_actions():
    #Run all actions defined in the steps.json file.
    with open('steps.json') as f:
        actions = json.load(f)
    
    logging.info("Starting to run actions")
    for action in actions:
        perform_action(action)
    logging.info("Finished running actions")

@eel.expose
def startClickTracking():
    #Start tracking mouse clicks and report their locations.
    change_cursor()
    
    def on_click(x, y, button, pressed):
        if pressed and button == mouse.Button.left:
            eel.showClickLocation(x, y)
            logging.info(f"Click detected at: ({x}, {y})")
            return False
    
    with mouse.Listener(on_click=on_click) as listener:
        listener.join()
    
    restore_cursor()

# Start the Eel application
eel.start('index.html', size=(1600, 900))
logging.info("Application started")