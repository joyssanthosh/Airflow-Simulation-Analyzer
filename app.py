from flask import Flask, render_template, redirect, url_for, request, flash, jsonify
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from config import Config
from models import db, User, Simulation
from simulation.engine import AirflowSimulation
from simulation.visualization import generate_2d_heatmap_base64, generate_3d_plotly_data
import os
import json
from fpdf import FPDF

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        username = request.form.get('username')
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'danger')
            return redirect(url_for('register'))
        
        hashed_pwd = bcrypt.generate_password_hash(password).decode('utf-8')
        user = User(username=username, name=name, email=email, password=hashed_pwd)
        db.session.add(user)
        db.session.commit()
        flash('Registration successful! You can now log in.', 'success')
        return redirect(url_for('login'))
        
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            if user.role == 'admin':
                return redirect(url_for('admin_dashboard'))
            return redirect(url_for('intro'))
        else:
            flash('Login Unsuccessful. Please check username and password', 'danger')
    return render_template('login.html')

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('landing'))

@app.route('/intro')
@login_required
def intro():
    return render_template('intro.html')

@app.route('/simulate')
@login_required
def simulate():
    return render_template('simulate.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/heatmap')
@login_required
def heatmap():
    return render_template('heatmap.html')

@app.route('/3d_room')
@login_required
def room_3d():
    return render_template('3d_room.html')

@app.route('/history')
@login_required
def history():
    simulations = Simulation.query.filter_by(user_id=current_user.id).order_by(Simulation.timestamp.desc()).all()
    return render_template('history.html', simulations=simulations)

@app.route('/export')
@login_required
def export():
    return render_template('export.html')

@app.route('/run_simulation', methods=['POST'])
@login_required
def run_simulation():
    data = request.json
    width = float(data.get('width', 5.0))
    length = float(data.get('length', 5.0))
    room_type = data.get('room_type', 'Living Room')
    
    sources = data.get('sources', [{'x': 0.5, 'y': 0.5, 'strength': 100}])
    obstacles = data.get('obstacles', [])
    
    sim = AirflowSimulation(width, length, resolution=0.5)
    for s in sources:
        sim.add_source(s['x'], s['y'], strength=s.get('strength', 100))
    for o in obstacles:
        sim.add_obstacle(o['x1'], o['x2'], o['y1'], o['y2'])
    
    sim.run(iterations=800)
    dead_air, score, rec = sim.analyze()
    
    heatmap_b64 = generate_2d_heatmap_base64(sim)
    plotly_data = generate_3d_plotly_data(sim)
    
    new_sim = Simulation(
        user_id=current_user.id,
        room_type=room_type,
        width=width,
        height=length,
        dead_air_percentage=dead_air,
        ventilation_score=score,
        recommendation=rec
    )
    db.session.add(new_sim)
    db.session.commit()
    
    return jsonify({
        'status': 'success',
        'dead_air': dead_air,
        'score': score,
        'recommendation': rec,
        'heatmap': heatmap_b64,
        'plotly_data': json.loads(plotly_data)
    })

@app.route('/export_pdf_data', methods=['POST'])
@login_required
def export_pdf_data():
    heatmap_b64 = request.form.get('heatmap_b64')
    room3d_b64 = request.form.get('room3d_b64')
    
    sim = Simulation.query.filter_by(user_id=current_user.id).order_by(Simulation.timestamp.desc()).first()
    if not sim:
        flash("No simulations run yet.", "danger")
        return redirect(url_for('export'))
        
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=15)
    pdf.cell(200, 10, txt="Airflow Simulation Report", ln=1, align='C')
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt=f"Room Type: {sim.room_type}", ln=1)
    pdf.cell(200, 10, txt=f"Dimensions: {sim.width} x {sim.height} m", ln=1)
    pdf.cell(200, 10, txt=f"Dead Air Percentage: {sim.dead_air_percentage}%", ln=1)
    pdf.cell(200, 10, txt=f"Ventilation Score: {sim.ventilation_score}/100", ln=1)
    pdf.multi_cell(0, 10, txt=f"Recommendation: {sim.recommendation}")
    
    import base64
    import tempfile
    
    try:
        if heatmap_b64 and 'base64,' in heatmap_b64:
            heatmap_data = base64.b64decode(heatmap_b64.split(',')[1])
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as hf:
                hf.write(heatmap_data)
                hf_path = hf.name
            pdf.ln(5)
            pdf.cell(200, 10, txt="2D Heatmap Snapshot:", ln=1)
            pdf.image(hf_path, w=140)
            os.remove(hf_path)
            
        if room3d_b64 and 'base64,' in room3d_b64:
            room_data = base64.b64decode(room3d_b64.split(',')[1])
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as rf:
                rf.write(room_data)
                rf_path = rf.name
            pdf.ln(5)
            pdf.cell(200, 10, txt="3D Room Snapshot:", ln=1)
            pdf.image(rf_path, w=140)
            os.remove(rf_path)
    except Exception as e:
        print("Error embedding images to PDF:", e)
    
    pdf_file_path = os.path.join(app.root_path, "static", "report.pdf")
    pdf.output(pdf_file_path)
    return redirect(url_for('static', filename='report.pdf'))

@app.route('/admin')
@login_required
def admin_dashboard():
    if current_user.role != 'admin':
        flash('Access restricted to administrators.', 'danger')
        return redirect(url_for('dashboard'))
        
    total_users = User.query.count()
    total_sims = Simulation.query.count()
    
    # Avoid div by zero
    avg_dead_air = db.session.query(db.func.avg(Simulation.dead_air_percentage)).scalar() or 0.0
    avg_score = db.session.query(db.func.avg(Simulation.ventilation_score)).scalar() or 0.0
    
    # Most simulated room type
    most_sim_room_type = db.session.query(
        Simulation.room_type, 
        db.func.count(Simulation.id)
    ).group_by(Simulation.room_type).order_by(db.func.count(Simulation.id).desc()).first()
    popular_room = most_sim_room_type[0] if most_sim_room_type else "N/A"

    # Time-based performance trends
    all_sims = Simulation.query.order_by(Simulation.timestamp.asc()).all()
    daily_counts = {}
    for s in all_sims:
        day = s.timestamp.strftime('%Y-%m-%d') if s.timestamp else "Unknown"
        daily_counts[day] = daily_counts.get(day, 0) + 1
        
    sorted_days = sorted(daily_counts.keys())
    trend_dates = sorted_days[-14:] if len(sorted_days) > 14 else sorted_days
    trend_counts = [daily_counts[d] for d in trend_dates]

    return render_template('admin.html', 
                           total_users=total_users, 
                           total_sims=total_sims,
                           avg_dead_air=round(avg_dead_air, 1),
                           avg_score=round(avg_score, 1),
                           popular_room=popular_room,
                           trend_dates=trend_dates,
                           trend_counts=trend_counts)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Create a default admin user if none exists
        if not User.query.filter_by(username='admin').first():
            hashed_pwd = bcrypt.generate_password_hash('admin123').decode('utf-8')
            admin = User(username='admin', name='Admin User', email='admin@example.com', password=hashed_pwd, role='admin')
            db.session.add(admin)
            db.session.commit()
    app.run(debug=True, port=5000)
