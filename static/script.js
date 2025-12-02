// ==================== Global State ====================

let currentInputMode = 'upload'; // 'upload' or 'webcam'
let webcamStream = null;
let capturedImageBlob = null;
let currentFile = null;
let currentChartMode = 'bar'; // 'bar' or 'pie'
let currentDistribution = null; // Store current emotion distribution

// Emotion colors for chart
const EMOTION_COLORS = {
    'Angry': { bg: '#DC3545', label: 'Angry' },
    'Disgust': { bg: '#FFA500', label: 'Disgust' },
    'Fear': { bg: '#A020F0', label: 'Fear' },
    'Happy': { bg: '#FFFF00', label: 'Happy' },
    'Sad': { bg: '#007BFF', label: 'Sad' },
    'Surprise': { bg: '#28A745', label: 'Surprise' },
    'Neutral': { bg: '#6C757D', label: 'Neutral' }
};

// ==================== DOM Elements ====================

// Tabs
const radioUpload = document.getElementById('radio-upload');
const radioWebcam = document.getElementById('radio-webcam');

// Areas
const uploadArea = document.getElementById('upload-area');
const webcamArea = document.getElementById('webcam-area');

// Upload elements
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');

// Webcam elements
const startWebcamBtn = document.getElementById('start-webcam-btn');
const stopWebcamBtn = document.getElementById('stop-webcam-btn');
const captureBtn = document.getElementById('capture-btn');
const webcamVideo = document.getElementById('webcam-video');
const webcamCanvas = document.getElementById('webcam-canvas');

// Preview elements
const previewContainer = document.getElementById('preview-container');
const defaultState = document.getElementById('default-state');
const imagePreview = document.getElementById('image-preview');

// Analyze button
const analyzeBtn = document.getElementById('analyze-btn');

// Overlays
const loadingOverlay = document.getElementById('loading-overlay');
const errorOverlay = document.getElementById('error-overlay');
const errorTitle = document.getElementById('error-title');
const errorMessage = document.getElementById('error-message');
const tryAgainBtn = document.getElementById('try-again-btn');

// Results
const dominantEmotion = document.getElementById('dominant-emotion');
const dominantConfidence = document.getElementById('dominant-confidence');
const emotionChart = document.getElementById('emotion-chart');
const emotionPieChart = document.getElementById('emotion-pie-chart');
const pieCanvas = document.getElementById('pie-canvas');
const pieLegend = document.getElementById('pie-legend');
const historyList = document.getElementById('history-list');

// Chart toggle buttons
const pieChartBtn = document.getElementById('pie-chart-btn');
const barChartBtn = document.getElementById('bar-chart-btn');

// Header buttons
const saveResultBtn = document.getElementById('save-result-btn');
const shareBtn = document.getElementById('share-btn');

// ==================== UI State Management ====================

function showLoadingState() {
    loadingOverlay.classList.remove('overlay-hidden');
}

function hideLoadingState() {
    loadingOverlay.classList.add('overlay-hidden');
}

function showErrorState(title = 'Error', message = 'An error occurred') {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    errorOverlay.classList.remove('overlay-hidden');
}

function hideErrorState() {
    errorOverlay.classList.add('overlay-hidden');
}

function showDefaultState() {
    defaultState.style.display = 'block';
    imagePreview.classList.add('overlay-hidden');
    webcamVideo.classList.add('overlay-hidden');
}

function hideDefaultState() {
    defaultState.style.display = 'none';
}

// ==================== Tab Switching ====================

radioUpload.addEventListener('change', () => {
    if (radioUpload.checked) {
        currentInputMode = 'upload';
        uploadArea.style.display = 'flex';
        webcamArea.style.display = 'none';
        stopWebcam();
        showDefaultState();
        hideErrorState();
    }
});

radioWebcam.addEventListener('change', () => {
    if (radioWebcam.checked) {
        currentInputMode = 'webcam';
        uploadArea.style.display = 'none';
        webcamArea.style.display = 'flex';
        currentFile = null;
        showDefaultState();
        hideErrorState();
    }
});

// ==================== Upload Logic ====================

browseBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#2b6cee';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#324467';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#324467';
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFileUpload(file);
    } else {
        showErrorState('Invalid File', 'Please drop a valid image file.');
    }
});

function handleFileUpload(file) {
    currentFile = file;
    capturedImageBlob = null;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove('overlay-hidden');
        webcamVideo.classList.add('overlay-hidden');
        hideDefaultState();
        hideErrorState();
    };
    reader.readAsDataURL(file);
}

// ==================== Webcam Logic ====================

startWebcamBtn.addEventListener('click', async () => {
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
        });
        
        webcamVideo.srcObject = webcamStream;
        webcamVideo.classList.remove('overlay-hidden');
        imagePreview.classList.add('overlay-hidden');
        hideDefaultState();
        hideErrorState();
        
        // Show/hide buttons
        startWebcamBtn.style.display = 'none';
        stopWebcamBtn.style.display = 'block';
        captureBtn.style.display = 'flex';
        
    } catch (error) {
        console.error('Error accessing webcam:', error);
        showErrorState('Webcam Error', 'Could not access your webcam. Please check permissions.');
    }
});

stopWebcamBtn.addEventListener('click', () => {
    stopWebcam();
});

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
        webcamVideo.srcObject = null;
    }
    
    webcamVideo.classList.add('overlay-hidden');
    startWebcamBtn.style.display = 'block';
    stopWebcamBtn.style.display = 'none';
    captureBtn.style.display = 'none';
    
    if (currentInputMode === 'webcam' && !capturedImageBlob) {
        showDefaultState();
    }
}

captureBtn.addEventListener('click', () => {
    // Capture frame from video
    const canvas = webcamCanvas;
    canvas.width = webcamVideo.videoWidth;
    canvas.height = webcamVideo.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(webcamVideo, 0, 0);
    
    // Convert to blob
    canvas.toBlob((blob) => {
        capturedImageBlob = blob;
        currentFile = null;
        
        // Show captured image
        const url = URL.createObjectURL(blob);
        imagePreview.src = url;
        imagePreview.classList.remove('overlay-hidden');
        webcamVideo.classList.add('overlay-hidden');
        
        // Stop webcam after capture
        stopWebcam();
        hideDefaultState();
        hideErrorState();
    }, 'image/jpeg', 0.95);
});

// ==================== Analysis Logic ====================

analyzeBtn.addEventListener('click', async () => {
    // Validate input
    if (currentInputMode === 'upload' && !currentFile) {
        showErrorState('No Image', 'Please upload an image first.');
        return;
    }
    
    if (currentInputMode === 'webcam' && !capturedImageBlob) {
        showErrorState('No Capture', 'Please capture a photo from webcam first.');
        return;
    }
    
    // Show loading state
    showLoadingState();
    hideErrorState();
    
    // Prepare form data
    const formData = new FormData();
    if (currentInputMode === 'upload') {
        formData.append('image', currentFile);
    } else {
        formData.append('image', capturedImageBlob, 'webcam-capture.jpg');
    }
    
    try {
        // Send to backend
        const response = await fetch('/api/predict', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        // Hide loading
        hideLoadingState();
        
        // Handle response
        if (data.status === 'error') {
            showErrorState('Analysis Failed', data.message);
        } else if (data.status === 'success') {
            // Update UI with results
            updateResults(data);
            
            // Fetch and update history
            await fetchHistory();
        }
        
    } catch (error) {
        hideLoadingState();
        console.error('Error during analysis:', error);
        showErrorState('Network Error', 'Failed to connect to the server. Please try again.');
    }
});

// ==================== Update Results ====================

function updateResults(data) {
    // Update dominant emotion
    dominantEmotion.textContent = data.dominant_emotion;
    dominantConfidence.textContent = `+${data.confidence}%`;
    
    // Store distribution for chart toggling
    currentDistribution = data.distribution;
    
    // Update chart based on current mode
    if (currentChartMode === 'bar') {
        updateBarChart(data.distribution);
    } else {
        updatePieChart(data.distribution);
    }
    
    // Hide error overlay if visible
    hideErrorState();
}

function updateBarChart(distribution) {
    // Clear existing chart
    emotionChart.innerHTML = '';
    
    // Get ALL emotions sorted by probability
    const sortedEmotions = Object.entries(distribution)
        .sort((a, b) => b[1] - a[1]);
    
    // Create bars
    sortedEmotions.forEach(([emotion, probability]) => {
        const color = EMOTION_COLORS[emotion] || { bg: '#888888', label: emotion };
        const percentage = Math.round(probability * 100);
        
        const barContainer = document.createElement('div');
        barContainer.className = 'flex flex-col items-center gap-2 w-full h-full justify-end';
        
        barContainer.innerHTML = `
            <div class="bg-${color.bg}/20 w-full rounded-t-sm flex-grow" style="max-height: ${percentage}%;">
                <div class="h-full w-full rounded-t-sm" style="background-color: ${color.bg};"></div>
            </div>
            <p class="text-[#92a4c9] text-[11px] font-medium leading-normal">${color.label}</p>
        `;
        
        emotionChart.appendChild(barContainer);
    });
}

function updatePieChart(distribution) {
    // Get canvas context
    const ctx = pieCanvas.getContext('2d');
    const centerX = pieCanvas.width / 2;
    const centerY = pieCanvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    
    // Clear canvas
    ctx.clearRect(0, 0, pieCanvas.width, pieCanvas.height);
    
    // Get ALL emotions sorted by probability
    const sortedEmotions = Object.entries(distribution)
        .sort((a, b) => b[1] - a[1]);
    
    // Calculate total for normalization
    const total = sortedEmotions.reduce((sum, [, prob]) => sum + prob, 0);
    
    // Clear legend
    pieLegend.innerHTML = '';
    
    // Draw pie slices
    let startAngle = -Math.PI / 2; // Start from top
    
    sortedEmotions.forEach(([emotion, probability]) => {
        const sliceAngle = (probability / total) * 2 * Math.PI;
        const color = EMOTION_COLORS[emotion] || { bg: '#888888', label: emotion };
        
        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = color.bg;
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = '#101622';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw label if slice is big enough
        if (probability > 0.05) {
            const labelAngle = startAngle + sliceAngle / 2;
            const labelX = centerX + (radius * 0.7) * Math.cos(labelAngle);
            const labelY = centerY + (radius * 0.7) * Math.sin(labelAngle);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 11px "Space Grotesk", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const percentage = Math.round(probability * 100);
            ctx.fillText(`${percentage}%`, labelX, labelY);
        }
        
        // Add to legend
        const legendItem = document.createElement('div');
        legendItem.className = 'flex items-center gap-1';
        legendItem.innerHTML = `
            <div class="w-3 h-3 rounded-sm" style="background-color: ${color.bg};"></div>
            <span class="text-[#92a4c9] text-[10px]">${color.label}</span>
        `;
        pieLegend.appendChild(legendItem);
        
        startAngle += sliceAngle;
    });
    
    // Draw center circle for donut effect
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#101622';
    ctx.fill();
}

// ==================== History ====================

async function fetchHistory() {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();
        
        if (data.status === 'success') {
            updateHistoryList(data.history);
        }
    } catch (error) {
        console.error('Error fetching history:', error);
    }
}

function updateHistoryList(history) {
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        historyList.innerHTML = '<li class="text-center text-[#A0A0A0] text-sm py-4">No analysis history yet</li>';
        return;
    }
    
    // Show only last 5
    const recentHistory = history.slice(0, 5);
    
    recentHistory.forEach((result, index) => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-3';
        
        // Determine confidence color
        let confidenceColor = '#28A745'; // Green
        if (result.confidence < 50) confidenceColor = '#DC3545'; // Red
        else if (result.confidence < 70) confidenceColor = '#FFA500'; // Orange
        
        // Get emotion color
        const emotionColor = EMOTION_COLORS[result.dominant_emotion]?.bg || '#888888';
        
        li.innerHTML = `
            <div class="size-10 rounded flex items-center justify-center text-2xl" 
                 style="background-color: ${emotionColor}33;">
                <span>${getEmotionEmoji(result.dominant_emotion)}</span>
            </div>
            <div class="flex-grow">
                <p class="font-medium text-sm text-white">Result ${index + 1}: ${result.dominant_emotion}</p>
                <p class="text-xs text-[#A0A0A0]">${result.time_ago}</p>
            </div>
            <div class="text-sm font-bold" style="color: ${confidenceColor};">${result.confidence}%</div>
        `;
        
        historyList.appendChild(li);
    });
}

function getEmotionEmoji(emotion) {
    const emojis = {
        'Happy': '😊',
        'Sad': '😢',
        'Angry': '😠',
        'Surprise': '😲',
        'Fear': '😨',
        'Disgust': '🤢',
        'Neutral': '😐'
    };
    return emojis[emotion] || '🙂';
}

// ==================== Error Handling ====================

tryAgainBtn.addEventListener('click', () => {
    hideErrorState();
    if (currentInputMode === 'upload') {
        fileInput.value = '';
        currentFile = null;
        showDefaultState();
    } else {
        capturedImageBlob = null;
        showDefaultState();
    }
});

// ==================== Chart Toggle ====================

pieChartBtn.addEventListener('click', () => {
    if (currentChartMode === 'pie') return; // Already in pie mode
    
    currentChartMode = 'pie';
    
    // Update button styles
    pieChartBtn.classList.remove('bg-[#232f48]');
    pieChartBtn.classList.add('bg-primary');
    barChartBtn.classList.remove('bg-primary');
    barChartBtn.classList.add('bg-[#232f48]');
    
    // Toggle chart visibility
    emotionChart.style.display = 'none';
    emotionPieChart.style.display = 'flex';
    
    // Redraw pie chart if data exists
    if (currentDistribution) {
        updatePieChart(currentDistribution);
    }
});

barChartBtn.addEventListener('click', () => {
    if (currentChartMode === 'bar') return; // Already in bar mode
    
    currentChartMode = 'bar';
    
    // Update button styles
    barChartBtn.classList.remove('bg-[#232f48]');
    barChartBtn.classList.add('bg-primary');
    pieChartBtn.classList.remove('bg-primary');
    pieChartBtn.classList.add('bg-[#232f48]');
    
    // Toggle chart visibility
    emotionPieChart.style.display = 'none';
    emotionChart.style.display = 'grid';
    
    // Redraw bar chart if data exists
    if (currentDistribution) {
        updateBarChart(currentDistribution);
    }
});

// ==================== Header Actions ====================

saveResultBtn.addEventListener('click', () => {
    // Placeholder for save functionality
    alert('Save functionality - Export results as PDF or save to database');
});

shareBtn.addEventListener('click', () => {
    // Placeholder for share functionality
    if (navigator.share) {
        navigator.share({
            title: 'Emotion Analysis Result',
            text: `My emotion analysis: ${dominantEmotion.textContent} (${dominantConfidence.textContent})`
        }).catch(err => console.log('Share failed:', err));
    } else {
        alert('Share functionality not supported on this browser');
    }
});

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Emotion Recognition Dashboard loaded');
    
    // Fetch initial history
    fetchHistory();
    
    // Set default state
    hideLoadingState();
    hideErrorState();
});

