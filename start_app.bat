@echo off
REM Emotion Recognition Dashboard - Startup Script (Batch)
REM For systems where PowerShell scripts are restricted

echo ======================================
echo 🎭 Emotion Recognition Dashboard
echo ======================================
echo.

echo 🔍 Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ✗ Python not found! Please install Python 3.8+
    pause
    exit /b 1
)
echo ✓ Python found

echo.
echo 🔍 Checking for ONNX model file...
if not exist "fer_cnn_model.onnx" (
    echo ✗ Model file not found!
    echo   Please ensure 'fer_cnn_model.onnx' is in the project directory
    pause
    exit /b 1
)
echo ✓ Model file found

echo.
echo 🔍 Checking virtual environment...
if not exist "venv" (
    echo ⚠ Virtual environment not found, creating one...
    python -m venv venv
    echo ✓ Virtual environment created
) else (
    echo ✓ Virtual environment found
)

echo.
echo 🔄 Activating virtual environment...
call venv\Scripts\activate.bat
echo ✓ Virtual environment activated

echo.
echo 📦 Installing dependencies...
pip install -r requirements.txt --quiet
echo ✓ Dependencies installed

echo.
echo ======================================
echo 🚀 Starting Flask Application
echo ======================================
echo.
echo 📍 Server will start at: http://localhost:5000
echo 📍 Press Ctrl+C to stop the server
echo.

python app.py

