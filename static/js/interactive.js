document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('interactiveGrid');
    const updateBtn = document.getElementById('updateSimBtn');
    let currentTool = 'vent';
    let currentToolType = 'source';
    let isMouseDown = false;

    // Load sim data
    const simDataStr = localStorage.getItem('latestSimulation');
    if (!simDataStr) {
        gridContainer.innerHTML = '<p>No simulation found. Please create a room from the Simulate page first.</p>';
        return;
    }

    // Since the API didn't return width/length in the success object initially (wait, I should check it),
    // let's grab it or use defaults. Actually, the original user code had run_simulation returning dead_air, score etc.
    // We should parse the width/length from localStorage if we saved it in app.js.
    // The existing app.js saves `result` which doesn't have width/length.
    // I am going to retrieve dimensions from `localStorage.getItem('simInputs')` or just use the plotly_data's width/length.
    const simData = JSON.parse(simDataStr);
    const pd = simData.plotly_data || {};
    const width = pd.width || 5.0;
    const length = pd.length || 5.0;
    const resolution = pd.resolution || 0.5;

    const cols = Math.floor(width / resolution);
    const rows = Math.floor(length / resolution);

    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridContainer.style.aspectRatio = `${width} / ${length}`;

    // Initialize Grid Cells
    const cells = [];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            cell.dataset.x = x * resolution;
            cell.dataset.y = y * resolution;
            cell.dataset.col = x;
            cell.dataset.row = y;
            cell.dataset.tool = 'empty';
            cell.style.border = '1px solid rgba(255, 255, 255, 0.4)';
            cell.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            cell.style.cursor = 'pointer';
            
            // Mouse Events for painting
            cell.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent default text selection during drag
                isMouseDown = true;
                applyTool(cell);
            });
            cell.addEventListener('mouseover', (e) => {
                if (isMouseDown) applyTool(cell);
            });
            cell.addEventListener('mouseup', () => isMouseDown = false);
            
            gridContainer.appendChild(cell);
            cells.push(cell);
        }
    }
    document.addEventListener('mouseup', () => isMouseDown = false);
    
    // Add Desktop Drag & Drop logic
    gridContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    });
    
    gridContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const tool = e.dataTransfer.getData('tool');
        const type = e.dataTransfer.getData('type');
        if(!tool) return;
        
        let targetCell = e.target.closest('div[data-col]');
        if(!targetCell) return;
        
        const scales = {
            'bed': [4, 4], 'sofa': [5, 2], 'table': [3, 2],
            'wardrobe': [2, 4], 'shower': [2, 2], 'sink': [2, 1],
            'cupboards': [3, 1], 'countertop': [4, 2],
            'vent': [1, 1], 'window': [2, 1], 'door': [2, 1],
            'eraser': [1, 1]
        };
        const size = scales[tool] || [1, 1];
        
        let cx = parseInt(targetCell.dataset.col);
        let cy = parseInt(targetCell.dataset.row);
        if(cx + size[0] > cols) cx = cols - size[0];
        if(cy + size[1] > rows) cy = rows - size[1];
        
        // Large furniture block image
        if (tool !== 'eraser' && size[0] * size[1] > 1 && toolVisuals[tool]?.img) {
            const piece = document.createElement('div');
            piece.className = 'dropped-furniture';
            piece.dataset.col = cx;
            piece.dataset.row = cy;
            piece.dataset.width = size[0];
            piece.dataset.height = size[1];
            piece.style.position = 'absolute';
            piece.style.zIndex = '5';
            piece.style.width = `calc(100% * ${size[0]} / ${cols})`;
            piece.style.height = `calc(100% * ${size[1]} / ${rows})`;
            piece.style.left = `calc(100% * ${cx} / ${cols})`;
            piece.style.top = `calc(100% * ${cy} / ${rows})`;
            piece.style.backgroundImage = toolVisuals[tool].img;
            piece.style.backgroundSize = 'contain';
            piece.style.backgroundRepeat = 'no-repeat';
            piece.style.backgroundPosition = 'center';
            piece.style.pointerEvents = 'none'; // allow click through to cells
            
            gridContainer.style.position = 'relative';
            gridContainer.appendChild(piece);
        }
        
        for(let dy=0; dy<size[1]; dy++) {
            for(let dx=0; dx<size[0]; dx++) {
                const c = cells.find(cl => parseInt(cl.dataset.col) === cx+dx && parseInt(cl.dataset.row) === cy+dy);
                if(c) {
                    currentTool = tool; currentToolType = type;
                    // Mute the individual small cell image if it's a large piece
                    applyTool(c, size[0] * size[1] > 1);
                }
            }
        }
    });

    // Visual mapping for tools using SVG base64 strings
    const createSvg = (svgContent) => `url('data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}')`;
    
    const svgVent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="10" fill="#00CCFF" opacity="0.8"/><line x1="20" y1="30" x2="80" y2="30" stroke="white" stroke-width="5"/><line x1="20" y1="50" x2="80" y2="50" stroke="white" stroke-width="5"/><line x1="20" y1="70" x2="80" y2="70" stroke="white" stroke-width="5"/></svg>`;
    const svgWindow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="5" y="40" width="90" height="20" fill="#88CCFF" opacity="0.8"/><rect x="5" y="40" width="90" height="20" fill="transparent" stroke="white" stroke-width="4"/></svg>`;
    const svgDoor = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="20" height="80" fill="#FFFFFF" opacity="0.5"/><path d="M10,90 A80,80 0 0,1 90,10" fill="transparent" stroke="#FFF" stroke-width="3" stroke-dasharray="5,5"/></svg>`;
    
    // Furniture SVGs (Premium Top-Down Look)
    const svgBed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="5" fill="#5A7D9A"/><rect x="15" y="15" width="70" height="30" rx="4" fill="#E2E8F0"/><rect x="15" y="45" width="70" height="40" rx="4" fill="#9FB3C8"/><rect x="20" y="20" width="25" height="20" rx="3" fill="#FFFFFF"/><rect x="55" y="20" width="25" height="20" rx="3" fill="#FFFFFF"/></svg>`;
    const svgSofa = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="20" width="80" height="60" rx="10" fill="#4A5568"/><rect x="25" y="30" width="50" height="40" rx="5" fill="#718096"/><rect x="15" y="60" width="20" height="20" rx="3" fill="#A0AEC0"/><rect x="40" y="60" width="20" height="20" rx="3" fill="#A0AEC0"/><rect x="65" y="60" width="20" height="20" rx="3" fill="#A0AEC0"/></svg>`;
    const svgTable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="25" width="80" height="50" rx="5" fill="#8B5A2B"/><circle cx="50" cy="50" r="10" fill="#D2B48C"/></svg>`;
    const svgChair = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#E2E8F0"/><rect x="35" y="20" width="30" height="15" rx="5" fill="#718096"/></svg>`;
    const svgWardrobe = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="2" fill="#5C4033"/><rect x="15" y="15" width="32" height="70" rx="1" fill="#8B5A2B"/><rect x="53" y="15" width="32" height="70" rx="1" fill="#8B5A2B"/><circle cx="40" cy="50" r="3" fill="#FFF"/><circle cx="60" cy="50" r="3" fill="#FFF"/></svg>`;
    const svgCountertop = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="5" y="10" width="90" height="80" fill="#CBD5E0"/><rect x="10" y="15" width="80" height="20" fill="#EDF2F7"/></svg>`;
    const svgCupboards = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="40" rx="2" fill="#4A5568"/><line x1="50" y1="5" x2="50" y2="45" stroke="#2D3748" stroke-width="4"/><circle cx="40" cy="25" r="2" fill="#FFF"/><circle cx="60" cy="25" r="2" fill="#FFF"/></svg>`;
    const svgShower = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="5" fill="#EBF8FF"/><circle cx="50" cy="50" r="15" fill="#90CDF4"/><circle cx="50" cy="50" r="2" fill="#FFF"/></svg>`;
    const svgSink = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" rx="8" fill="#EDF2F7"/><circle cx="50" cy="50" r="15" fill="#CBD5E0"/><circle cx="50" cy="50" r="4" fill="#4A5568"/></svg>`;
    const svgEraser = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><line x1="20" y1="20" x2="80" y2="80" stroke="#FF5555" stroke-width="10"/><line x1="80" y1="20" x2="20" y2="80" stroke="#FF5555" stroke-width="10"/></svg>`;
    
    const toolVisuals = {
        'vent': { color: 'rgba(0, 204, 255, 0.2)', img: createSvg(svgVent) },
        'window': { color: 'rgba(136, 204, 255, 0.2)', img: createSvg(svgWindow) },
        'door': { color: 'rgba(255, 255, 255, 0.1)', img: createSvg(svgDoor) },
        'bed': { color: 'rgba(90, 125, 154, 0.2)', img: createSvg(svgBed) },
        'table': { color: 'rgba(139, 90, 43, 0.2)', img: createSvg(svgTable) },
        'sofa': { color: 'rgba(74, 85, 104, 0.2)', img: createSvg(svgSofa) },
        'chair': { color: 'rgba(226, 232, 240, 0.2)', img: createSvg(svgChair) },
        'wardrobe': { color: 'rgba(92, 64, 51, 0.2)', img: createSvg(svgWardrobe) },
        'countertop': { color: 'rgba(203, 213, 224, 0.2)', img: createSvg(svgCountertop) },
        'cupboards': { color: 'rgba(74, 85, 104, 0.2)', img: createSvg(svgCupboards) },
        'shower': { color: 'rgba(235, 248, 255, 0.2)', img: createSvg(svgShower) },
        'sink': { color: 'rgba(237, 242, 247, 0.2)', img: createSvg(svgSink) },
        'eraser': { color: 'rgba(255, 255, 255, 0.1)', img: createSvg(svgEraser) },
        'empty': { color: 'rgba(255, 255, 255, 0.1)', img: null }
    };

    function applyTool(cell, suppressImage = false) {
        if (currentTool === 'eraser') {
            const cx = parseInt(cell.dataset.col);
            const cy = parseInt(cell.dataset.row);
            document.querySelectorAll('.dropped-furniture').forEach(piece => {
                let px = parseInt(piece.dataset.col);
                let py = parseInt(piece.dataset.row);
                let pw = parseInt(piece.dataset.width);
                let ph = parseInt(piece.dataset.height);
                if (cx >= px && cx < px + pw && cy >= py && cy < py + ph) {
                    piece.remove();
                }
            });
        }
    
        cell.dataset.tool = currentTool;
        cell.dataset.type = currentToolType;
        const visual = toolVisuals[currentTool] || toolVisuals['empty'];
        cell.style.backgroundColor = visual.color;
        
        if (visual.img && !suppressImage) {
            cell.style.backgroundImage = visual.img;
            cell.style.backgroundSize = "contain";
            cell.style.backgroundRepeat = "no-repeat";
            cell.style.backgroundPosition = "center";
            cell.innerHTML = "";
        } else {
            cell.style.backgroundImage = "none";
            cell.innerHTML = "";
        }
    }

    // Tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.draggable = true;
        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('tool', btn.dataset.tool);
            e.dataTransfer.setData('type', btn.dataset.type);
        });
    
        // Initialize tool button styles
        const tool = btn.dataset.tool;
        if (tool && toolVisuals[tool]) {
            // Adjust border string replacements for the newly defined opacities (0.2, 0.1)
            let solidColor = toolVisuals[tool].color.replace('0.2', '1.0').replace('0.1', '1.0');
            btn.style.border = `2px solid ${solidColor}`;
            
            // Add a small preview inside the button
            if (toolVisuals[tool].img && !btn.querySelector('.preview-icon')) {
                const preview = document.createElement('span');
                preview.className = 'preview-icon';
                preview.style.display = 'inline-block';
                preview.style.verticalAlign = 'middle';
                preview.style.width = '20px';
                preview.style.height = '20px';
                preview.style.marginRight = '8px';
                preview.style.backgroundImage = toolVisuals[tool].img;
                preview.style.backgroundSize = 'contain';
                preview.style.backgroundRepeat = 'no-repeat';
                preview.style.backgroundPosition = 'center';
                btn.prepend(preview);
            }
        }

        btn.addEventListener('click', (e) => {
            if(btn.id === 'updateSimBtn') return;
            document.querySelectorAll('.tool-btn').forEach(b => {
                b.classList.remove('active');
                b.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            });
            btn.classList.add('active');
            btn.style.backgroundColor = toolVisuals[btn.dataset.tool].color;
            currentTool = btn.dataset.tool;
            currentToolType = btn.dataset.type;
        });
    });

    // Highlight the default active tool
    const activeBtn = document.querySelector('.tool-btn.active');
    if (activeBtn) {
        activeBtn.style.backgroundColor = toolVisuals[activeBtn.dataset.tool].color;
    }

    // Handle Update
    updateBtn.addEventListener('click', async () => {
        updateBtn.innerText = 'Updating...';
        updateBtn.disabled = true;

        const sources = [];
        const obstacles = [];

        cells.forEach(c => {
            const tool = c.dataset.tool;
            const type = c.dataset.type;
            const x = parseFloat(c.dataset.x);
            const y = parseFloat(c.dataset.y);

            if (type === 'source') {
                sources.push({ x: x, y: y, strength: tool === 'vent' ? 100 : 50 });
            } else if (type === 'obstacle') {
                obstacles.push({ x1: x, x2: x + resolution, y1: y, y2: y + resolution });
            }
            // empty and doors do nothing to block flow
        });

        const payload = {
            width: width,
            length: length,
            room_type: 'Custom Builder',
            sources: sources,
            obstacles: obstacles
        };

        try {
            const res = await fetch('/run_simulation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            
            if (result.status === 'success') {
                document.getElementById('dashDeadAir').innerText = `${result.dead_air}%`;
                document.getElementById('dashVentScore').innerText = `${result.score}/100`;
                document.getElementById('dashRecommendation').innerText = result.recommendation;
                
                // Update localStorage to sync with app.js
                localStorage.setItem('latestSimulation', JSON.stringify(result));
                
                // If app.js functions are available globally, fire them or reload
                // Easiest is to reload to let app.js do its rendering for 3D and heatmap
                window.location.reload();
            }
        } catch (e) {
            console.error(e);
            alert("Error updating simulation.");
        } finally {
            updateBtn.innerText = 'Update Simulation';
            updateBtn.disabled = false;
        }
    });
});
