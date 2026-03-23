import numpy as np

class AirflowSimulation:
    def __init__(self, width, length, resolution=0.5):
        self.width = width
        self.length = length
        self.resolution = resolution
        
        self.grid_w = int(width / resolution)
        self.grid_l = int(length / resolution)
        
        # Grid to hold airflow velocities/pressures
        self.grid = np.zeros((self.grid_l, self.grid_w))
        
        # Grid to mark obstacles (1 = obstacle, 0 = free)
        self.obstacles = np.zeros((self.grid_l, self.grid_w))
        
        # Sources of airflow: Vents/Windows [(x, y, strength, direction)]
        self.sources = []

    def add_obstacle(self, x_start, x_end, y_start, y_end):
        """Add an obstacle block."""
        x1 = max(0, int(x_start / self.resolution))
        x2 = min(self.grid_w, int(x_end / self.resolution))
        y1 = max(0, int(y_start / self.resolution))
        y2 = min(self.grid_l, int(y_end / self.resolution))
        self.obstacles[y1:y2, x1:x2] = 1

    def add_source(self, x, y, strength=100.0, direction='all'):
        """Add an airflow source (vent/window)."""
        gx = max(0, min(self.grid_w - 1, int(x / self.resolution)))
        gy = max(0, min(self.grid_l - 1, int(y / self.resolution)))
        self.sources.append((gx, gy, strength, direction))

    def run(self, iterations=300, diffusion_rate=0.25, decay=0.998):
        """
        Vectorized diffusion simulation using Numpy.
        Iteratively propagates airflow from sources.
        """
        free_mask = self.obstacles == 0
        
        for _ in range(iterations):
            # Pad grid to handle boundaries
            padded = np.pad(self.grid, 1, mode='constant', constant_values=0)
            
            # Sum of neighbors using shifted arrays
            neighbors_sum = (
                padded[2:, 1:-1] + # down
                padded[:-2, 1:-1] + # up
                padded[1:-1, 2:] + # right
                padded[1:-1, :-2]  # left
            )
            
            # Simple diffusion
            diffused = self.grid * (1 - diffusion_rate) + (neighbors_sum / 4.0) * diffusion_rate
            
            # Apply to free space with minimal decay
            self.grid[free_mask] = diffused[free_mask] * decay
            self.grid[self.obstacles == 1] = 0

            # Apply sources
            for (gx, gy, strength, dir) in self.sources:
                self.grid[gy, gx] = strength

        # Normalize grid
        max_val = np.max(self.grid)
        if max_val > 0:
            self.grid = (self.grid / max_val) * 100

    def analyze(self):
        """Calculate dead air percentage and ventilation score."""
        free_cells = np.sum(self.obstacles == 0)
        if free_cells == 0:
            return 100.0, 0.0, "Invalid room configuration."
            
        dead_air_threshold = 15.0
        dead_air_cells = np.sum((self.grid < dead_air_threshold) & (self.obstacles == 0))
        
        dead_air_percentage = (dead_air_cells / free_cells) * 100
        ventilation_score = max(0.0, 100.0 - dead_air_percentage)
        
        recommendation = "Good airflow circulation."
        if dead_air_percentage > 40:
            recommendation = "Critical: High dead air volume. Consider adding an exhaust vent opposite to the inlet or repositioning large furniture blocking flow."
        elif dead_air_percentage > 20:
            recommendation = "Moderate dead air. Try moving obstacles away from direct airflow paths to improve circulation."
            
        return round(dead_air_percentage, 1), round(ventilation_score, 1), recommendation
