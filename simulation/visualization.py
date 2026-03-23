import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import io
import base64
import json

def generate_2d_heatmap_base64(simulation_engine):
    """Generates a Matplotlib heatmap and returns it as a base64 string."""
    fig, ax = plt.subplots(figsize=(6, 5))
    
    cmap = plt.get_cmap('jet')
    cax = ax.imshow(simulation_engine.grid, cmap=cmap, origin='lower', extent=[0, simulation_engine.width, 0, simulation_engine.length], vmin=0, vmax=60)
    
    # Draw obstacles
    for y in range(simulation_engine.grid_l):
        for x in range(simulation_engine.grid_w):
            if simulation_engine.obstacles[y, x] == 1:
                rx = x * simulation_engine.resolution
                ry = y * simulation_engine.resolution
                rect = plt.Rectangle((rx, ry), simulation_engine.resolution, simulation_engine.resolution, color='black')
                ax.add_patch(rect)
                
    # Draw sources
    for (gx, gy, _, _) in simulation_engine.sources:
        sx = gx * simulation_engine.resolution + simulation_engine.resolution/2
        sy = gy * simulation_engine.resolution + simulation_engine.resolution/2
        ax.plot(sx, sy, 'w*', markersize=15)
        
    ax.set_title("2D Airflow Heatmap")
    ax.set_xlabel("Width (m)")
    ax.set_ylabel("Length (m)")
    fig.colorbar(cax, ax=ax, label='Airflow Intensity (%)')
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
    plt.close(fig)
    
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    return f"data:image/png;base64,{img_base64}"

def generate_3d_plotly_data(simulation_engine):
    """
    Generates data structure suitable for Plotly.js 3D representation.
    """
    x_coords = np.arange(0, simulation_engine.width, simulation_engine.resolution)
    y_coords = np.arange(0, simulation_engine.length, simulation_engine.resolution)
    
    grid_list = simulation_engine.grid.tolist()
    obstacles_list = simulation_engine.obstacles.tolist()
    
    return json.dumps({
        'x': x_coords.tolist(),
        'y': y_coords.tolist(),
        'z_grid': grid_list,
        'obstacles': obstacles_list,
        'resolution': simulation_engine.resolution,
        'width': simulation_engine.width,
        'length': simulation_engine.length
    })
