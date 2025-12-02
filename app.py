import os
import io
import json
import numpy as np
import cv2
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
import onnxruntime as ort
from PIL import Image

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize database
db = SQLAlchemy(app)

# Load ONNX model
try:
    ort_session = ort.InferenceSession("fer_cnn_model.onnx")
    print("✓ ONNX model loaded successfully")
except Exception as e:
    print(f"✗ Error loading ONNX model: {e}")
    ort_session = None

# Emotion labels (adjust based on your model)
EMOTION_LABELS = ['Angry', 'Disgust', 'Fear', 'Happy', 'Sad', 'Surprise', 'Neutral']

# Face detection cascade
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# ==================== Database Models ====================

class User(db.Model):
    """User model for authentication and profile"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    avatar_url = db.Column(db.String(500), default='https://lh3.googleusercontent.com/aida-public/AB6AXuAZ2gMeqRvKvisChCLX3ocfEm7IAXC69o5jsahd-McvFzne2qtOV415NOaDlxm6YA-jXY9qCchcRQ_0TPYVoYKaQDUHhq9D9ccBWswHIHBmdDBlMPeiSbAtpBzdsJHF8XkG3vKYwKx6_904xB_zr0RkFJWTO0-a6yyzqAEBGRTCZgayMv4WXpUJLatfgEs28hwjNSKVJgiQJKYQ-pP7KN4Vb0iMSQy2yQGcJSAzCcjhhSqFv0AnmHic5ra1sai3bH-2pHzU3h10aPM')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship with analysis results
    analysis_results = db.relationship('AnalysisResult', backref='user', lazy=True)

    def __repr__(self):
        return f'<User {self.username}>'


class AnalysisResult(db.Model):
    """Model for storing emotion analysis results"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    dominant_emotion = db.Column(db.String(50), nullable=False)
    confidence = db.Column(db.Float, nullable=False)  # Percentage (0-100)
    full_results_json = db.Column(db.Text, nullable=False)  # JSON string of all emotions
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    image_thumbnail = db.Column(db.String(500))  # Optional: URL or base64
    
    def __repr__(self):
        return f'<AnalysisResult {self.dominant_emotion} - {self.confidence}%>'
    
    def to_dict(self):
        """Convert to dictionary for JSON response"""
        return {
            'id': self.id,
            'dominant_emotion': self.dominant_emotion,
            'confidence': round(self.confidence, 2),
            'full_results': json.loads(self.full_results_json),
            'timestamp': self.timestamp.isoformat(),
            'time_ago': self.get_time_ago()
        }
    
    def get_time_ago(self):
        """Get human-readable time difference"""
        diff = datetime.utcnow() - self.timestamp
        seconds = diff.total_seconds()
        
        if seconds < 60:
            return "Just now"
        elif seconds < 3600:
            minutes = int(seconds / 60)
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        elif seconds < 86400:
            hours = int(seconds / 3600)
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        else:
            days = int(seconds / 86400)
            return f"{days} day{'s' if days != 1 else ''} ago"


# ==================== Helper Functions ====================

def preprocess_image(image_data):
    """
    Preprocess image for emotion recognition:
    1. Detect face
    2. Crop and resize
    3. Convert to grayscale
    4. Normalize
    """
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return None, "Invalid image format"
    
    # Convert to grayscale for face detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    if len(faces) == 0:
        return None, "No face detected"
    
    # Use the first (largest) face detected
    x, y, w, h = faces[0]
    face_roi = gray[y:y+h, x:x+w]
    
    # Resize to model input size (typically 48x48 for FER models)
    face_resized = cv2.resize(face_roi, (48, 48))
    
    # Normalize pixel values to [0, 1]
    face_normalized = face_resized / 255.0
    
    # Reshape for model input: (batch_size, channels, height, width)
    face_input = face_normalized.reshape(1, 1, 48, 48).astype(np.float32)
    
    return face_input, None


def predict_emotion(preprocessed_input):
    """
    Run inference using ONNX model
    Returns: dictionary with emotion probabilities
    """
    if ort_session is None:
        return None, "Model not loaded"
    
    try:
        # Get input name from the model
        input_name = ort_session.get_inputs()[0].name
        
        # Run inference
        outputs = ort_session.run(None, {input_name: preprocessed_input})
        
        # Get probabilities (apply softmax if needed)
        logits = outputs[0][0]
        exp_logits = np.exp(logits - np.max(logits))  # Numerical stability
        probabilities = exp_logits / exp_logits.sum()
        
        # Create emotion distribution dictionary
        emotion_dist = {}
        for i, emotion in enumerate(EMOTION_LABELS):
            emotion_dist[emotion] = float(probabilities[i])
        
        # Get dominant emotion
        dominant_idx = np.argmax(probabilities)
        dominant_emotion = EMOTION_LABELS[dominant_idx]
        confidence = float(probabilities[dominant_idx] * 100)
        
        return {
            'dominant_emotion': dominant_emotion,
            'confidence': confidence,
            'distribution': emotion_dist
        }, None
        
    except Exception as e:
        return None, f"Prediction error: {str(e)}"


def get_current_user():
    """Get current user from session or return default user"""
    if 'user_id' not in session:
        # Auto-login as default user for demo purposes
        user = User.query.filter_by(username='demo').first()
        if not user:
            # Create default user if doesn't exist
            user = User(username='demo', email='demo@example.com')
            db.session.add(user)
            db.session.commit()
        session['user_id'] = user.id
    
    return User.query.get(session['user_id'])


# ==================== Routes ====================

@app.route('/')
def index():
    """Main dashboard page"""
    user = get_current_user()
    return render_template('index.html', user=user)


@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Main prediction endpoint
    Accepts: multipart/form-data with 'image' file
    Returns: JSON with emotion analysis results
    """
    try:
        # Check if image file is present
        if 'image' not in request.files:
            return jsonify({
                'status': 'error',
                'message': 'No image file provided'
            }), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({
                'status': 'error',
                'message': 'No image selected'
            }), 400
        
        # Read image data
        image_data = file.read()
        
        # Preprocess image
        preprocessed, error = preprocess_image(image_data)
        if error:
            return jsonify({
                'status': 'error',
                'message': error
            }), 200  # Return 200 so frontend can show custom error UI
        
        # Predict emotion
        result, error = predict_emotion(preprocessed)
        if error:
            return jsonify({
                'status': 'error',
                'message': error
            }), 500
        
        # Save to database
        user = get_current_user()
        analysis = AnalysisResult(
            user_id=user.id,
            dominant_emotion=result['dominant_emotion'],
            confidence=result['confidence'],
            full_results_json=json.dumps(result['distribution'])
        )
        db.session.add(analysis)
        db.session.commit()
        
        # Return success response
        return jsonify({
            'status': 'success',
            'dominant_emotion': result['dominant_emotion'],
            'confidence': round(result['confidence'], 2),
            'distribution': result['distribution']
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    """
    Get analysis history for current user
    Returns: JSON list of recent analysis results
    """
    try:
        user = get_current_user()
        
        # Get last 10 results, ordered by most recent
        results = AnalysisResult.query.filter_by(user_id=user.id)\
            .order_by(AnalysisResult.timestamp.desc())\
            .limit(10)\
            .all()
        
        # Convert to dict
        history = [result.to_dict() for result in results]
        
        return jsonify({
            'status': 'success',
            'history': history
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error fetching history: {str(e)}'
        }), 500


@app.route('/api/auth', methods=['POST'])
def auth():
    """
    Simple authentication endpoint (for demo purposes)
    In production, implement proper authentication
    """
    data = request.get_json()
    action = data.get('action')
    
    if action == 'login':
        username = data.get('username', 'demo')
        user = User.query.filter_by(username=username).first()
        
        if not user:
            user = User(username=username, email=f'{username}@example.com')
            db.session.add(user)
            db.session.commit()
        
        session['user_id'] = user.id
        return jsonify({
            'status': 'success',
            'message': 'Logged in successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'avatar_url': user.avatar_url
            }
        })
    
    elif action == 'logout':
        session.pop('user_id', None)
        return jsonify({
            'status': 'success',
            'message': 'Logged out successfully'
        })
    
    return jsonify({
        'status': 'error',
        'message': 'Invalid action'
    }), 400


@app.route('/api/user', methods=['GET'])
def get_user():
    """Get current user info"""
    user = get_current_user()
    return jsonify({
        'status': 'success',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'avatar_url': user.avatar_url
        }
    })


# ==================== Initialize Database ====================

def init_db():
    """Initialize database and create tables"""
    with app.app_context():
        db.create_all()
        print("✓ Database initialized successfully")
        
        # Create demo user if doesn't exist
        if not User.query.filter_by(username='demo').first():
            demo_user = User(username='demo', email='demo@example.com')
            db.session.add(demo_user)
            db.session.commit()
            print("✓ Demo user created")


# ==================== Main ====================

if __name__ == '__main__':
    # Initialize database
    init_db()
    
    # Run Flask app
    print("\n" + "="*50)
    print("🚀 Emotion Recognition Dashboard")
    print("="*50)
    print("📍 Server running at: http://localhost:5000")
    print("="*50 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)

