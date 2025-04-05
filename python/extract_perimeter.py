#!/usr/bin/env python3
"""
extract_perimeter.py

This script reads a CSV file containing tile bounds and generates a GeoJSON polygon
representing the outer perimeter of all tiles combined.

The input CSV has the format:
row,col,lat_center,lon_center,url,lat_min,lat_max,lon_min,lon_max

The output is a GeoJSON file containing a single polygon feature that represents
the outer boundary of the entire dataset.
"""

import csv
import json
import os
import sys
from typing import Dict, List, Tuple, Any, Set

def read_tile_bounds(csv_file: str) -> List[Dict[str, Any]]:
    """
    Read the tile bounds from the CSV file.
    Returns a list of tile information.
    """
    tiles = []
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tile = {
                'row': int(row['row']),
                'col': int(row['col']),
                'lat_center': float(row['lat_center']),
                'lon_center': float(row['lon_center']),
                'lat_min': float(row['lat_min']),
                'lat_max': float(row['lat_max']),
                'lon_min': float(row['lon_min']),
                'lon_max': float(row['lon_max'])
            }
            tiles.append(tile)
    return tiles

def find_min_max_extents(tiles: List[Dict[str, Any]]) -> Tuple[int, int, int, int]:
    """Find minimum and maximum row/column indices"""
    rows = [tile['row'] for tile in tiles]
    cols = [tile['col'] for tile in tiles]
    return min(rows), max(rows), min(cols), max(cols)

def find_perimeter_tiles(tiles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Identify tiles that are on the perimeter of the grid.
    A tile is on the perimeter if it's on an edge of the grid.
    """
    # Create a set of (row, col) tuples for quick lookup
    tile_positions = {(tile['row'], tile['col']) for tile in tiles}
    
    # Find min/max extents
    min_row, max_row, min_col, max_col = find_min_max_extents(tiles)
    
    # Find perimeter tiles
    perimeter_tiles = []
    
    for tile in tiles:
        row, col = tile['row'], tile['col']
        
        # Check if tile is on the perimeter
        is_perimeter = False
        
        # Check if any of the 4 adjacent positions is empty
        if (row - 1, col) not in tile_positions:  # Top edge
            is_perimeter = True
        elif (row + 1, col) not in tile_positions:  # Bottom edge
            is_perimeter = True
        elif (row, col - 1) not in tile_positions:  # Left edge
            is_perimeter = True
        elif (row, col + 1) not in tile_positions:  # Right edge
            is_perimeter = True
        
        if is_perimeter:
            perimeter_tiles.append(tile)
    
    return perimeter_tiles

def extract_perimeter_from_tiles(perimeter_tiles: List[Dict[str, Any]]) -> List[Tuple[float, float]]:
    """
    Extract the coordinates for the perimeter polygon by walking around the 
    outer edges of the perimeter tiles.
    """
    # Create a grid of tiles for easy access
    grid = {}
    for tile in perimeter_tiles:
        grid[(tile['row'], tile['col'])] = tile
    
    # Find min/max row/col to determine extents
    min_row = min(tile['row'] for tile in perimeter_tiles)
    max_row = max(tile['row'] for tile in perimeter_tiles)
    min_col = min(tile['col'] for tile in perimeter_tiles)
    max_col = max(tile['col'] for tile in perimeter_tiles)
    
    # Collect all perimeter points
    # We'll build an array of coordinates tracing around the perimeter
    perimeter_points: List[Tuple[float, float]] = []
    
    # Start with top edge (min_row), going left to right
    for col in range(min_col, max_col + 1):
        if (min_row, col) in grid:
            # Add top-left and top-right corners
            tile = grid[(min_row, col)]
            # Add top-left corner
            perimeter_points.append((tile['lon_min'], tile['lat_max']))
            # Add top-right corner if this is the rightmost tile or there's no tile to the right
            if col == max_col or (min_row, col + 1) not in grid:
                perimeter_points.append((tile['lon_max'], tile['lat_max']))
    
    # Continue with right edge (max_col), going top to bottom
    for row in range(min_row, max_row + 1):
        if (row, max_col) in grid:
            # Add top-right and bottom-right corners
            tile = grid[(row, max_col)]
            # Only add top-right if there's no tile above (otherwise it was added in the top edge)
            if row == min_row or (row - 1, max_col) not in grid:
                perimeter_points.append((tile['lon_max'], tile['lat_max']))
            # Add bottom-right corner
            perimeter_points.append((tile['lon_max'], tile['lat_min']))
    
    # Continue with bottom edge (max_row), going right to left
    for col in range(max_col, min_col - 1, -1):
        if (max_row, col) in grid:
            # Add bottom-right and bottom-left corners
            tile = grid[(max_row, col)]
            # Only add bottom-right if there's no tile to the right (otherwise it was added in the right edge)
            if col == max_col or (max_row, col + 1) not in grid:
                perimeter_points.append((tile['lon_max'], tile['lat_min']))
            # Add bottom-left corner
            perimeter_points.append((tile['lon_min'], tile['lat_min']))
    
    # Complete with left edge (min_col), going bottom to top
    for row in range(max_row, min_row - 1, -1):
        if (row, min_col) in grid:
            # Add bottom-left and top-left corners
            tile = grid[(row, min_col)]
            # Only add bottom-left if there's no tile below (otherwise it was added in the bottom edge)
            if row == max_row or (row + 1, min_col) not in grid:
                perimeter_points.append((tile['lon_min'], tile['lat_min']))
            # Add top-left corner
            perimeter_points.append((tile['lon_min'], tile['lat_max']))
    
    # Remove consecutive duplicate points
    distinct_points: List[Tuple[float, float]] = []
    for point in perimeter_points:
        if not distinct_points or point != distinct_points[-1]:
            distinct_points.append(point)
    
    # Close the polygon if needed
    if distinct_points and distinct_points[0] != distinct_points[-1]:
        distinct_points.append(distinct_points[0])
        
    # Fix the staggered edges by adding intermediate vertices at 90-degree outer angles
    fixed_points = add_intermediate_vertices(distinct_points)
    
    return fixed_points

def add_intermediate_vertices(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """
    Add intermediate vertices at 90-degree outer angles to ensure the perimeter 
    follows horizontal and vertical grid edges.
    
    This addresses the issue of diagonal lines in the perimeter when tiles are staggered.
    """
    if len(points) < 3:  # Need at least 3 points to check for angles
        return points
    
    fixed_points: List[Tuple[float, float]] = [points[0]]  # Start with the first point
    
    for i in range(1, len(points) - 1):
        # Current point and its neighbors
        prev_point = points[i-1]
        current_point = points[i]
        next_point = points[i+1]
        
        # Calculate vectors for the edges
        v1 = (current_point[0] - prev_point[0], current_point[1] - prev_point[1])
        v2 = (next_point[0] - current_point[0], next_point[1] - current_point[1])
        
        # Calculate the cross product to determine if we have a 90-degree or 270-degree angle
        # For 2D, the cross product is: v1.x * v2.y - v1.y * v2.x
        cross_product = v1[0] * v2[1] - v1[1] * v2[0]
        
        # Also consider the dot product to check if vectors are perpendicular
        dot_product = v1[0] * v2[0] + v1[1] * v2[1]
        
        # Add the current point
        fixed_points.append(current_point)
        
        # Check if we need to add an intermediate vertex
        # We need to add a vertex if we have a diagonal segment (both components change)
        if (abs(v1[0]) > 1e-9 and abs(v1[1]) > 1e-9) or (abs(v2[0]) > 1e-9 and abs(v2[1]) > 1e-9):
            # If vectors are not perpendicular (diagonal movement), add intermediate vertex
            if abs(dot_product) > 1e-9:
                # Create intermediate vertex by taking x from one point and y from another
                # The direction depends on the sign of the cross product
                if cross_product < 0:
                    # Add a point with the longitude of the current point and latitude of the next point
                    intermediate = (current_point[0], next_point[1])
                else:
                    # Add a point with the longitude of the next point and latitude of the current point
                    intermediate = (next_point[0], current_point[1])
                    
                fixed_points.append(intermediate)
    
    # Add the last point
    fixed_points.append(points[-1])
    
    return fixed_points

def create_geojson(polygon: List[Tuple[float, float]], output_file: str) -> None:
    """
    Create a GeoJSON file containing the polygon.
    """
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Dataset Perimeter",
                    "description": "Outer boundary of the dataset region"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [polygon]  # GeoJSON uses [lon, lat] order
                }
            }
        ]
    }
    
    with open(output_file, 'w') as f:
        json.dump(geojson, f, indent=2)

def main() -> None:
    """Main function to run the script."""
    
    # Determine file paths
    if len(sys.argv) > 2:
        input_csv = sys.argv[1]
        output_geojson = sys.argv[2]
    else:
        # Default paths
        script_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.join(os.path.dirname(script_dir), 'data')
        input_csv = os.path.join(data_dir, 'tile_bounds_coords_adj.csv')
        output_geojson = os.path.join(data_dir, 'dataset_perimeter.geojson')
    
    print(f"Reading tile bounds from {input_csv}...")
    tiles = read_tile_bounds(input_csv)
    print(f"Found {len(tiles)} tiles.")
    
    print("Identifying perimeter tiles...")
    perimeter_tiles = find_perimeter_tiles(tiles)
    print(f"Found {len(perimeter_tiles)} perimeter tiles.")
    
    print("Extracting perimeter coordinates...")
    perimeter = extract_perimeter_from_tiles(perimeter_tiles)
    print(f"Generated perimeter with {len(perimeter)} points.")
    
    if not perimeter:
        print("ERROR: Failed to create perimeter!")
        return
    
    print(f"Saving GeoJSON to {output_geojson}...")
    create_geojson(perimeter, output_geojson)
    print("Done!")

if __name__ == "__main__":
    main() 