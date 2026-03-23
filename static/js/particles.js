const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

let time = 0;

// Particles
class Particle {
    constructor() {
        this.reset();
        // random start x so they are distributed initially
        this.x = Math.random() * canvas.width;
    }
    reset() {
        this.x = -10 - Math.random() * 50; // start off-screen left
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 0.5;
        this.speedX = Math.random() * 2 + 0.8;
        this.waveSpeed = Math.random() * 0.015 + 0.005;
        this.waveOffset = Math.random() * Math.PI * 2;
        this.amplitude = Math.random() * 60 + 20;
        this.opacity = Math.random() * 0.5 + 0.2;
    }
    update() {
        this.x += this.speedX;
        // The particle follows a sine wave pattern over its base y
        this.currentY = this.y + Math.sin(this.x * this.waveSpeed + this.waveOffset + time) * this.amplitude;
        if (this.x > canvas.width + 10) {
            this.reset();
        }
    }
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.currentY, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow
        if (this.size > 1.5) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = 'white';
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}

let particles = [];
let numParticles = (canvas.width * canvas.height) / 8000;
for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle());
}

function drawWave(yOffset, amplitude, frequency, phase, color, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(0, Math.sin(phase) * amplitude + yOffset);
    for (let x = 0; x <= canvas.width; x += 30) {
        let y = Math.sin(x * frequency + phase) * amplitude + yOffset;
        ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

function drawFilledWave(yOffset, amplitude, frequency, phase, color) {
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(0, Math.sin(phase) * amplitude + yOffset);
    for (let x = 0; x <= canvas.width; x += 50) {
        let y = Math.sin(x * frequency + phase) * amplitude + yOffset;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.fill();
}

function animate() {
    // Fill background with soft gradient
    let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#89CFF0'); // Light blue
    grad.addColorStop(0.5, '#C2E9FB');
    grad.addColorStop(1, '#dfe9f3'); // Lighter blue/white
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw sweeping wind waves
    time += 0.005;
    
    // Background blurry full waves (clouds/wind layers)
    ctx.filter = 'blur(15px)';
    drawFilledWave(canvas.height * 0.4, 200, 0.0015, time * 0.8, 'rgba(255, 255, 255, 0.4)');
    drawFilledWave(canvas.height * 0.6, 150, 0.002, time * 1.2 + 2, 'rgba(255, 255, 255, 0.3)');
    drawFilledWave(canvas.height * 0.8, 100, 0.003, time * 1.5 + 4, 'rgba(255, 255, 255, 0.5)');
    
    ctx.filter = 'blur(4px)';
    // Thin glowing curves representing flow vectors
    drawWave(canvas.height * 0.3, 100, 0.002, time * 2, 'rgba(255, 255, 255, 0.6)', 3);
    drawWave(canvas.height * 0.5, 140, 0.0015, time * -1, 'rgba(255, 255, 255, 0.4)', 5);
    drawWave(canvas.height * 0.7, 80, 0.0025, time * 1.2 + 1, 'rgba(255, 255, 255, 0.5)', 2);
    drawWave(canvas.height * 0.4, 50, 0.003, time * -2.5 + 3, 'rgba(255, 255, 255, 0.4)', 2);
    
    ctx.filter = 'none';

    // Draw Particles trailing the wind
    for (let p of particles) {
        p.update();
        p.draw();
    }
    
    requestAnimationFrame(animate);
}

animate();
