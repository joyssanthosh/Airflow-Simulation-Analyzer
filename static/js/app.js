document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Handle Simulation Submission
    const simulateForm = document.getElementById('simulateForm');
    if (simulateForm) {
        simulateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = simulateForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = 'Simulating...';
            submitBtn.disabled = true;
            
            const formData = new FormData(simulateForm);
            const data = {
                room_type: formData.get('room_type'),
                width: parseFloat(formData.get('width')),
                length: parseFloat(formData.get('length'))
            };
            
            try {
                const response = await fetch('/run_simulation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    // Save to localStorage for other pages to use
                    localStorage.setItem('latestSimulation', JSON.stringify(result));
                    // Redirect to dashboard
                    window.location.href = '/dashboard';
                } else {
                    alert('Simulation failed.');
                }
            } catch (err) {
                console.error(err);
                alert('An error occurred.');
            } finally {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // 2. Load Dashboard Data
    const simDataStr = localStorage.getItem('latestSimulation');
    if (simDataStr) {
        const simData = JSON.parse(simDataStr);
        
        // Dashboard Overview
        const deadAirValue = document.getElementById('deadAirValue');
        const ventScoreValue = document.getElementById('ventScoreValue');
        const recText = document.getElementById('recommendationText');
        
        if (deadAirValue) deadAirValue.innerText = `${simData.dead_air}%`;
        if (ventScoreValue) ventScoreValue.innerText = `${simData.score}/100`;
        if (recText) recText.innerText = simData.recommendation;

        const dashDeadAir = document.getElementById('dashDeadAir');
        const dashVentScore = document.getElementById('dashVentScore');
        const dashRec = document.getElementById('dashRecommendation');
        
        if (dashDeadAir) dashDeadAir.innerText = `${simData.dead_air}%`;
        if (dashVentScore) dashVentScore.innerText = `${simData.score}/100`;
        if (dashRec) dashRec.innerText = simData.recommendation;
        
        // Heatmap
        const heatmapContainer = document.getElementById('heatmapContainer');
        if (heatmapContainer) {
            heatmapContainer.innerHTML = `<img src="${simData.heatmap}" style="max-width: 100%; border-radius: 8px;" alt="Heatmap">`;
        }
        
        // 3D Room
        const plotly3d = document.getElementById('plotly3d');
        if (plotly3d) {
            plotly3d.innerHTML = ''; // clear text
            render3DRoom(simData.plotly_data, 'plotly3d');
        }
        
        // Export logic
        const btnDownloadPdf = document.getElementById('btnDownloadPdf');
        if (btnDownloadPdf && location.pathname === '/export') {
            // Render visuals into the snapshot cards
            document.getElementById('exportHeatmapContainer').innerHTML = `<img src="${simData.heatmap}" style="max-height: 100%; max-width: 100%; object-fit: contain; border-radius: 8px;" alt="Heatmap">`;
            document.getElementById('export3dContainer').innerHTML = ''; // clear
            render3DRoom(simData.plotly_data, 'export3dContainer');

            // Handle PDF generation via POST with embedded snapshots
            btnDownloadPdf.addEventListener('click', async () => {
                const originalText = btnDownloadPdf.innerText;
                btnDownloadPdf.innerText = "Generating PDF...";
                btnDownloadPdf.disabled = true;

                try {
                    const export3dDiv = document.getElementById('export3dContainer');
                    const plotImagePng = await Plotly.toImage(export3dDiv, {format: 'png', width: 800, height: 600});
                    
                    const convertToJpeg = async (base64Src) => {
                        return new Promise((resolve) => {
                            const img = new Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                canvas.width = img.width; canvas.height = img.height;
                                const ctx = canvas.getContext('2d');
                                ctx.fillStyle = '#FFFFFF';
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                ctx.drawImage(img, 0, 0);
                                resolve(canvas.toDataURL('image/jpeg', 0.9));
                            };
                            img.src = base64Src;
                        });
                    };

                    const plotImage = await convertToJpeg(plotImagePng);
                    const heatmapImage = await convertToJpeg(simData.heatmap);
                    
                    document.getElementById('heatmapInput').value = heatmapImage;
                    document.getElementById('room3dInput').value = plotImage;
                    document.getElementById('metricsInput').value = JSON.stringify({
                        width: simData.plotly_data.width,
                        length: simData.plotly_data.length,
                        dead_air: simData.dead_air,
                        score: simData.score,
                        rec: simData.recommendation,
                        room_type: simData.room_type || 'Simulation'
                    });
                    
                    document.getElementById('pdfExportForm').submit();
                } catch(e) {
                    console.error("PDF Export failed", e);
                    alert("Failed to capture graphs for export.");
                } finally {
                    btnDownloadPdf.innerText = originalText;
                    btnDownloadPdf.disabled = false;
                }
            });
        }
        // Advanced Export Handlers
        const btnDownloadCsv = document.getElementById('btnDownloadCsv');
        if (btnDownloadCsv && location.pathname === '/export') {
            btnDownloadCsv.addEventListener('click', () => {
                const roomType = simData.room_type || 'Custom';
                const width = simData.plotly_data ? simData.plotly_data.width : 'N/A';
                const length = simData.plotly_data ? simData.plotly_data.length : 'N/A';
                
                const csvContent = "data:text/csv;charset=utf-8," 
                    + "Room Type,Width (m),Length (m),Dead Air (%),Ventilation Score,Recommendation\n"
                    + `"${roomType}",${width},${length},${simData.dead_air},${simData.score},"${simData.recommendation}"`;
                
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'simulation_data.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        const btnDownloadHeatmapPng = document.getElementById('btnDownloadHeatmapPng');
        if (btnDownloadHeatmapPng && location.pathname === '/export') {
            btnDownloadHeatmapPng.addEventListener('click', () => {
                if (simData.heatmap) {
                    const link = document.createElement('a');
                    link.href = simData.heatmap;
                    link.download = 'heatmap.png';
                    link.click();
                }
            });
        }

        const btnFullAnalytics = document.getElementById('btnFullAnalytics');
        if (btnFullAnalytics && location.pathname === '/export') {
            btnFullAnalytics.addEventListener('click', () => {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: 'Analytics Summary',
                        html: `
                            <div style="text-align: left; line-height: 1.6; padding: 10px;">
                                <p><strong>Room Type:</strong> ${simData.room_type || 'Custom'}</p>
                                <p><strong>Dimensions:</strong> ${simData.plotly_data.width}x${simData.plotly_data.length} m</p>
                                <p><strong>Dead Air Zone:</strong> ${simData.dead_air}%</p>
                                <p><strong>Ventilation Score:</strong> ${simData.score}/100</p>
                                <p><strong>Recommendation:</strong> ${simData.recommendation}</p>
                            </div>
                        `,
                        icon: 'info',
                        confirmButtonText: 'Close',
                        background: 'rgba(30, 40, 50, 0.95)',
                        color: '#E0E0E0'
                    });
                } else {
                    alert(`Analytics Summary:\nRoom Type: ${simData.room_type || 'Custom'}\nDimensions: ${simData.plotly_data.width}x${simData.plotly_data.length} m\nDead Air Zone: ${simData.dead_air}%\nVentilation Score: ${simData.score}/100\nRecommendation: ${simData.recommendation}`);
                }
            });
        }
    }
    
});

let isAnimating = true;

function render3DRoom(data, elementId) {
    const x = data.x;
    const y = data.y;
    const z_grid = data.z_grid;
    const obstacles = data.obstacles || [];
    
    let coneX = [], coneY = [], coneZ = [], u = [], v = [], w = [];
    
    for (let iy = 0; iy < y.length; iy++) {
        for (let ix = 0; ix < x.length; ix++) {
            let intensity = z_grid[iy][ix];
            if (intensity > 5) {
                coneX.push(x[ix]);
                coneY.push(y[iy]);
                coneZ.push(0.5); // Airflow plane slice
                u.push(intensity / 100);
                v.push((Math.random() - 0.5) * (intensity/100)); // Varied lateral drift
                w.push(0);
            }
        }
    }

    var traceCones = {
      type: 'cone',
      x: coneX, y: coneY, z: coneZ,
      u: u, v: v, w: w,
      sizemode: 'scaled',
      sizeref: 0.5,
      colorscale: 'Blues',
      showscale: false, // Hide scale bar for cleaner look
      name: 'Airflow'
    };
    
    // Transparent enclosing walls (Back, Left) & Floor
    var roomMesh = {
        type: 'mesh3d',
        x: [0, data.width, data.width, 0, 0, data.width, data.width, 0],
        y: [0, 0, data.length, data.length, 0, 0, data.length, data.length],
        z: [0, 0, 0, 0, 2.5, 2.5, 2.5, 2.5],
        i: [0, 3, 0], // Floor (0,1,2,3), Back wall (3,2,6,7), Left Wall (0,3,7,4)
        j: [1, 2, 4],
        k: [2, 7, 3],
        opacity: 0.15,
        color: '#A1C4FD',
        hoverinfo: 'skip'
    };

    // Construct 3D Furniture blocks
    let obsX = [], obsY = [], obsZ = [];
    let obsI = [], obsJ = [], obsK = [];
    let vOffset = 0;
    
    for (let iy = 0; iy < obstacles.length; iy++) {
        for (let ix = 0; ix < obstacles[iy].length; ix++) {
            if (obstacles[iy][ix] === 1) {
                let ox = x[ix], oy = y[iy], ow = data.resolution, oh = 1.2; // Box dims
                let vx = [ox, ox+ow, ox+ow, ox, ox, ox+ow, ox+ow, ox];
                let vy = [oy, oy, oy+ow, oy+ow, oy, oy, oy+ow, oy+ow];
                let vz = [0, 0, 0, 0, oh, oh, oh, oh];
                
                obsX.push(...vx);
                obsY.push(...vy);
                obsZ.push(...vz);
                
                // Cube triangles
                obsI.push(...[0,0,4,4,0,0,1,1,2,2,3,3].map(v => v+vOffset));
                obsJ.push(...[1,2,5,6,1,5,2,6,3,7,0,4].map(v => v+vOffset));
                obsK.push(...[2,3,6,7,5,4,6,5,7,6,4,7].map(v => v+vOffset));
                vOffset += 8;
            }
        }
    }

    var traces = [traceCones, roomMesh];
    if (obsI.length > 0) {
        traces.push({
            type: 'mesh3d',
            x: obsX, y: obsY, z: obsZ,
            i: obsI, j: obsJ, k: obsK,
            color: 'rgba(200, 220, 255, 0.65)',
            flatshading: true,
            lighting: { ambient: 0.6, diffuse: 0.8, specular: 0.1, roughness: 0.5 },
            lightposition: { x: 5000, y: 5000, z: 5000 },
            hoverinfo: 'skip',
            name: 'Furniture'
        });
    }

    var layout = {
      scene: {
        aspectmode: 'manual',
        aspectratio: { x: 1, y: data.length / data.width, z: 3.5 / data.width },
        camera: { eye: {x: -1.5, y: -1.5, z: 0.8} }, // Better perspective view
        xaxis: {title: '', showgrid: false, zeroline: false, showticklabels: false, showbackground: false},
        yaxis: {title: '', showgrid: false, zeroline: false, showticklabels: false, showbackground: false},
        zaxis: {title: '', showgrid: false, zeroline: false, showticklabels: false, showbackground: false}
      },
      margin: {t: 0, b: 0, l: 0, r: 0},
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
    };

    Plotly.newPlot(elementId, traces, layout, {responsive: true});
}

let animationReq;
let currentAngle = Math.PI / 4; // starting angle

window.toggleAnimation = function() {
    isAnimating = !isAnimating;
    if(isAnimating) {
        function rotate() {
            currentAngle += 0.005;
            let radius = 2.0; // distance from center
            let plotlyContainer = document.getElementById('plotly3d');
            if(plotlyContainer && plotlyContainer.data) {
                Plotly.relayout('plotly3d', {
                    'scene.camera': {
                        eye: {x: radius * Math.cos(currentAngle), y: radius * Math.sin(currentAngle), z: 0.8}
                    }
                }).catch(e => console.log(e)); // catch errors if div is not ready
            }
            if(isAnimating) animationReq = requestAnimationFrame(rotate);
        }
        rotate();
    } else {
        cancelAnimationFrame(animationReq);
    }
};

// Auto-start animation if 3d_room loads
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('plotly3d')) {
        setTimeout(() => { if(isAnimating) toggleAnimation(); toggleAnimation(); }, 1500);
    }
});
