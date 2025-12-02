# Emotion Recognition Dashboard - Startup Script
# PowerShell script for Windows

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "🎭 Emotion Recognition Dashboard" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "🔍 Checking Python installation..." -ForegroundColor Blue
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found! Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Check if model file exists
Write-Host ""
Write-Host "🔍 Checking for ONNX model file..." -ForegroundColor Blue
if (Test-Path "fer_cnn_model.onnx") {
    Write-Host "✓ Model file found: fer_cnn_model.onnx" -ForegroundColor Green
} else {
    Write-Host "✗ Model file not found!" -ForegroundColor Red
    Write-Host "  Please ensure 'fer_cnn_model.onnx' is in the project directory" -ForegroundColor Yellow
    exit 1
}

# Check if virtual environment exists
Write-Host ""
Write-Host "🔍 Checking virtual environment..." -ForegroundColor Blue
if (Test-Path "venv") {
    Write-Host "✓ Virtual environment found" -ForegroundColor Green
} else {
    Write-Host "⚠ Virtual environment not found, creating one..." -ForegroundColor Yellow
    python -m venv venv
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
}

# Activate virtual environment
Write-Host ""
Write-Host "🔄 Activating virtual environment..." -ForegroundColor Blue
& ".\venv\Scripts\Activate.ps1"
Write-Host "✓ Virtual environment activated" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
pip install -r requirements.txt --quiet
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Run the application
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "🚀 Starting Flask Application" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Server will start at: http://localhost:5000" -ForegroundColor Cyan
Write-Host "📍 Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python app.py

