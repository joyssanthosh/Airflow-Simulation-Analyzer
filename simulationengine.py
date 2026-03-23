import numpy as np # type: ignore

class AirflowSimulationEngine:
    def __init__(self, width, height, resolution=0.5):
        # resolution=0.5 means 1 unit = 0.5 meters (2 grid cells per meter)
        self.width = width
        self.height = height
        self.resolution = resolution
        self.grid_w = int(width / resolution)
        self.grid_h = int(height / resolution)
        
        # Grid to hold air velocity magnitude (0 to 100)
        self.velocity_grid = np.zeros((self.grid_h, self.grid_w))
        # Grid to hold obstacle masks (1 = blocked, 0 = free)
        self.obstacle_grid = np.zeros((self.grid_h, self.grid_w))
        
        self.vents = []
    
    def add_obstacle(self, x, y, w, h):
        """Adds an obstacle block to the grid based on real-world meters"""
        gx = int(x / self.resolution)
        gy = int(y / self.resolution)
        gw = max(1, int(w / self.resolution))
        gh = max(1, int(h / self.resolution))
        
        # Prevent out of bounds
        gy_end = min(self.grid_h, gy + gh)
        gx_end = min(self.grid_w, gx + gw)
        self.obstacle_grid[gy:gy_end, gx:gx_end] = 1

    def add_vent(self, x, y, direction, power=100):
        """direction: 'N', 'S', 'E', 'W'"""
        gx = int(x / self.resolution)
        gy = int(y / self.resolution)
        
        if 0 <= gx < self.grid_w and 0 <= gy < self.grid_h:
            self.vents.append({
                'gx': gx,
                'gy': gy,
                'dir': direction,
                'power': power
            })
            self.velocity_grid[gy, gx] = power

    def run_simulation(self, iterations=50):
        """
        Rule-based heuristic propagation.
        Air flows in the vent direction and spreads out slightly.
        Loses power over distance. Stopped by obstacles.
        """
        # Create a padded grid for easier convolution-like spreading
        for _ in range(iterations):
            new_vel = np.copy(self.velocity_grid)
            
            for y in range(self.grid_h):
                for x in range(self.grid_w):
                    if self.obstacle_grid[y, x] == 1:
                        new_vel[y, x] = 0
                        continue
                        
                    current_v = self.velocity_grid[y, x]
                    if current_v > 1:
                        # Spread to adjacent non-blocked cells with some decay
                        neighbors = [(y-1, x), (y+1, x), (y, x-1), (y, x+1)]
                        valid_neighbors = []
                        for ny, nx in neighbors:
                            if 0 <= ny < self.grid_h and 0 <= nx < self.grid_w:
                                if self.obstacle_grid[ny, nx] == 0:
                                    valid_neighbors.append((ny, nx))
                                    
                        # Simple rule: diffuse outward
                        if valid_neighbors:
                            spread_v = current_v * 0.4 # pass 40% of velocity to neighbors
                            for ny, nx in valid_neighbors:
                                # Additive velocity but capped at 100
                                nv = new_vel[ny, nx] + (spread_v / len(valid_neighbors))
                                new_vel[ny, nx] = 100.0 if nv > 100.0 else nv
                            # Decay current cell
                            cv = current_v * 0.8
                            new_vel[y, x] = 0.0 if cv < 0.0 else cv
                            
            # Enforce vent power (continuous supply)
            for v in self.vents:
                gy, gx = v['gy'], v['gx']
                new_vel[gy, gx] = v['power']
                # Implement directional bias
                if v['dir'] == 'N' and gy > 0 and self.obstacle_grid[gy-1, gx] == 0:
                    nv = new_vel[gy-1, gx] + v['power']*0.9
                    new_vel[gy-1, gx] = 100.0 if nv > 100.0 else nv
                elif v['dir'] == 'S' and gy < self.grid_h-1 and self.obstacle_grid[gy+1, gx] == 0:
                    nv = new_vel[gy+1, gx] + v['power']*0.9
                    new_vel[gy+1, gx] = 100.0 if nv > 100.0 else nv
                elif v['dir'] == 'E' and gx < self.grid_w-1 and self.obstacle_grid[gy, gx+1] == 0:
                    nv = new_vel[gy, gx+1] + v['power']*0.9
                    new_vel[gy, gx+1] = 100.0 if nv > 100.0 else nv
                elif v['dir'] == 'W' and gx > 0 and self.obstacle_grid[gy, gx-1] == 0:
                    nv = new_vel[gy, gx-1] + v['power']*0.9
                    new_vel[gy, gx-1] = 100.0 if nv > 100.0 else nv
                    
            self.velocity_grid = new_vel

        return self.get_results()

    def get_results(self):
        # Calculate dead air percentage
        # Dead air defined as velocity < 10 (arbitrary threshold)
        free_space_cells = np.sum(self.obstacle_grid == 0)
        
        if free_space_cells == 0:
            return {
                'dead_air_percentage': 100.0,
                'ventilation_score': 0.0,
                'heatmap': [],
                'recommendations': ["Room is completely blocked."]
            }

        dead_air_cells = np.sum((self.velocity_grid < 15) & (self.obstacle_grid == 0))
        dead_air_percentage = float((dead_air_cells / free_space_cells) * 100)
        
        # Ventilation score (inverse of dead air, plus bonus for general flow)
        avg_flow = float(np.mean(self.velocity_grid[self.obstacle_grid == 0]))
        vs = 100.0 - dead_air_percentage + (avg_flow * 0.2)
        vs = 0.0 if vs < 0.0 else vs
        ventilation_score = 100.0 if vs > 100.0 else vs

        recommendations = []
        if dead_air_percentage > 30:
            recommendations.append("High dead air ratio detected. Consider adding a vent or moving large furniture.")
        if np.max(self.velocity_grid) < 20:
            recommendations.append("Overall airflow is very low. Increase vent power or add more inflow sources.")
        if len(recommendations) == 0:
            recommendations.append("Airflow is optimal for this layout.")
            
        return {
            'dead_air_percentage': float(f"{dead_air_percentage:.1f}"),
            'ventilation_score': float(f"{ventilation_score:.1f}"),
            'heatmap': self.velocity_grid.tolist(),
            'recommendations': recommendations
        }
