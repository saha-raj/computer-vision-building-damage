/**
 * building-selector-map.js
 * Initializes and manages the building selection tool demo map
 */

// Initialize the map when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initBuildingSelectorMap();
});

// Global variables to manage drawing state
let drawingMode = false;
let craterMode = false;
let drawing = false;
let polyline = null;
let points = [];
let buildingsLayer = null;
let cratersLayer = null;
let selectedBuildings = new Set();
let craters = [];

/**
 * Initialize the building selector demo map
 */
function initBuildingSelectorMap() {
    // Check if the map container exists
    const mapContainer = document.getElementById('building-selector-map');
    if (!mapContainer) return;

    // Load tile bounds data to get the tile at row 9, col 6
    loadTileBoundsData('data/tile_bounds_coords_adj.csv')
        .then(tiles => {
            // Find the specific tile we want to focus on
            const targetTile = tiles.find(tile => tile.row === 9 && tile.col === 6);
            
            if (!targetTile) {
                showErrorMessage('Could not find the specified tile (row 9, col 6)');
                return;
            }
            
            console.log('Found target tile:', targetTile);
            
            // Create a Leaflet map centered on the tile
            const map = L.map('building-selector-map', {
                zoomControl: false,      // Disable zoom control
                scrollWheelZoom: true,   // Enable scroll wheel zoom for better interaction
                doubleClickZoom: false,  // Disable double click zoom
                boxZoom: false,          // Disable box zoom
                keyboard: false,         // Disable keyboard navigation
                dragging: true,          // Enable map dragging for better interaction
                attributionControl: true, // Keep attribution
                zoomSnap: 0.05           // Allow fractional zoom levels like in the training tool
            });
            
            // Create custom panes with specific z-index ordering
            map.createPane('satellitePane');
            map.createPane('buildingsPane');
            map.createPane('drawingPane');
            map.createPane('cratersPane');
            
            map.getPane('satellitePane').style.zIndex = 350;
            map.getPane('buildingsPane').style.zIndex = 450; // Buildings above satellite
            map.getPane('drawingPane').style.zIndex = 600;   // Drawing above buildings
            map.getPane('cratersPane').style.zIndex = 550;   // Craters between buildings and drawing
            
            // Calculate the center of the tile
            const center = [targetTile.lat_center, targetTile.lon_center];
            
            // Add the same basemap as in the damage-map.js
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(map);
            
            // Set an appropriate zoom level for the tile
            // The value 17 is chosen to show good detail while keeping the entire tile visible
            map.setView(center, 17);
            
            // Create image URL for the tile
            const imageUrl = `images/tiles/cropped_row_${targetTile.row}_col_${targetTile.col}.webp`;
            
            // Define the image bounds using the correct lat/lon values from CSV
            const imageBounds = [
                [targetTile.lat_min, targetTile.lon_min], // Southwest corner
                [targetTile.lat_max, targetTile.lon_max]  // Northeast corner
            ];
            
            // Create and add the image overlay to the map
            const imageOverlay = L.imageOverlay(imageUrl, imageBounds, {
                opacity: 1.0,
                interactive: false,
                pane: 'satellitePane' // Use the satellite pane
            }).addTo(map);
            
            console.log(`Added satellite image overlay for tile at row ${targetTile.row}, col ${targetTile.col}`);
            
            // Use fitBounds with padding to create visible margin around the image
            // Similar to how the training tool does it, but with slightly more padding
            map.fitBounds(imageBounds, {
                padding: [40, 40], // Use larger padding to create more visible margin
                maxZoom: 19        // Cap the max zoom to prevent excessive zooming
            });
            
            // Log the actual zoom level after fitBounds (should now be a fractional number)
            console.log(`Set map view with padding around the satellite tile. Zoom level: ${map.getZoom()}`);
            
            // Add building polygons from GeoJSON
            fetch('data/buildings_row_9_col_6.geojson')
                .then(response => response.json())
                .then(buildingsData => {
                    // Create a GeoJSON layer for buildings
                    buildingsLayer = L.geoJSON(buildingsData, {
                        style: {
                            color: '#a5ffd6',        // Greenish outline
                            weight: 1,               // Thin border
                            opacity: 0.7,            // Slightly transparent outline
                            fillColor: 'transparent', // No fill by default
                            fillOpacity: 0,           // Fully transparent fill
                            pane: 'buildingsPane'     // Use the buildings pane
                        },
                        pane: 'buildingsPane', // Ensure buildings are in the higher z-index pane
                        onEachFeature: function(feature, layer) {
                            // Store the feature ID for reference
                            layer.featureId = feature.id || feature.properties.id || Math.random().toString(36).substr(2, 9);
                            
                            // Add click event to toggle building selection
                            layer.on('click', function(e) {
                                // Only handle click if we're not actively drawing
                                if (!drawing) {
                                    toggleBuildingSelection(this);
                                    
                                    // Prevent the click from propagating to the map
                                    L.DomEvent.stopPropagation(e);
                                }
                            });
                            
                            // Make the mouse cursor change to pointer when hovering over buildings
                            layer.on('mouseover', function() {
                                this.setStyle({ weight: 2 }); // Make border slightly thicker on hover
                                this._path.style.cursor = 'pointer';
                            });
                            
                            layer.on('mouseout', function() {
                                this.setStyle({ weight: 1 }); // Reset border thickness
                            });
                        }
                    }).addTo(map);
                    
                    // Explicitly bring the buildings layer to front
                    buildingsLayer.bringToFront();
                    
                    console.log(`Added ${buildingsData.features.length} building polygons to the map`);
                })
                .catch(error => {
                    console.error('Error loading building polygons:', error);
                });
            
            // No corner markers or debug overlays - clean presentation
            
            // Create a layer group for craters - make sure it uses the global variable
            cratersLayer = L.layerGroup({
                pane: 'cratersPane'
            }).addTo(map);
            
            // Setup drawing event handlers
            map.on('mousedown', function(e) {
                if (!drawingMode && !craterMode) return;
                
                if (drawingMode) {
                    startDrawing(e, map);
                } else if (craterMode) {
                    startCraterDrawing(e, map, cratersLayer);
                }
            });
            
            map.on('mousemove', function(e) {
                if (drawing && drawingMode) {
                    continueDrawing(e, map);
                } else if (drawing && craterMode) {
                    updateCraterSize(e, map);
                }
            });
            
            map.on('mouseup', function(e) {
                if (drawing && drawingMode) {
                    finishDrawing(map, buildingsLayer);
                } else if (drawing && craterMode) {
                    finishCraterDrawing(map, cratersLayer);
                }
            });
            
            // Initialize button event listeners
            initDrawingControls(map);
        })
        .catch(error => {
            console.error('Error loading tile data:', error);
            showErrorMessage('Error loading tile data. Please try again later.');
        });
}

/**
 * Toggle a building's selection state
 */
function toggleBuildingSelection(layer) {
    const featureId = layer.featureId;
    
    // Toggle selection state
    if (selectedBuildings.has(featureId)) {
        // Unselect the building
        selectedBuildings.delete(featureId);
        layer.setStyle({
            color: '#a5ffd6',        // Original color
            fillColor: 'transparent',
            fillOpacity: 0
        });
        console.log(`Building ${featureId} unselected`);
    } else {
        // Select the building
        selectedBuildings.add(featureId);
        layer.setStyle({
            color: '#ff3300',        // Highlighted color
            fillColor: '#ff3300',
            fillOpacity: 0.3
        });
        console.log(`Building ${featureId} selected as damaged`);
    }
    
    console.log(`Total buildings selected: ${selectedBuildings.size}`);
}

/**
 * Initialize drawing control buttons
 */
function initDrawingControls(map) {
    const drawBuildingsBtn = document.getElementById('draw-buildings-btn');
    const drawCratersBtn = document.getElementById('draw-craters-btn');
    const clearSelectionsBtn = document.getElementById('clear-selections-btn');
    
    if (!drawBuildingsBtn || !drawCratersBtn || !clearSelectionsBtn) {
        console.error('Drawing control buttons not found');
        return;
    }
    
    drawBuildingsBtn.addEventListener('click', function() {
        if (drawingMode) {
            // Turn off drawing mode
            drawingMode = false;
            this.classList.remove('active');
            map.dragging.enable();
        } else {
            // Turn on drawing mode, turn off crater mode
            drawingMode = true;
            craterMode = false;
            this.classList.add('active');
            drawCratersBtn.classList.remove('active');
            map.dragging.disable();
            console.log('Building selection mode activated');
        }
    });
    
    drawCratersBtn.addEventListener('click', function() {
        if (craterMode) {
            // Turn off crater mode
            craterMode = false;
            this.classList.remove('active');
            map.dragging.enable();
        } else {
            // Turn on crater mode, turn off drawing mode
            craterMode = true;
            drawingMode = false;
            this.classList.add('active');
            drawBuildingsBtn.classList.remove('active');
            map.dragging.disable();
            console.log('Crater marking mode activated');
        }
    });
    
    // Add clear selections button functionality
    clearSelectionsBtn.addEventListener('click', function() {
        clearAllSelections(map);
    });
}

/**
 * Start drawing a polygon
 */
function startDrawing(e, map) {
    drawing = true;
    points = [e.latlng];
    
    // Create a new polyline
    polyline = L.polyline([e.latlng], {
        color: '#ff7800',
        weight: 3,
        opacity: 0.8,
        pane: 'drawingPane'
    }).addTo(map);
}

/**
 * Continue drawing as mouse moves
 */
function continueDrawing(e, map) {
    if (!drawing) return;
    
    // Add the new point to our line
    points.push(e.latlng);
    polyline.setLatLngs(points);
}

/**
 * Finish drawing and select buildings
 */
function finishDrawing(map, buildingsLayer) {
    if (!drawing) return;
    
    drawing = false;
    
    // Only process if we have enough points to make a meaningful selection
    if (points.length < 3) {
        if (polyline) {
            map.removeLayer(polyline);
            polyline = null;
        }
        return;
    }
    
    // Close the polygon
    points.push(points[0]);
    polyline.setLatLngs(points);
    
    // Create a temporary polygon for intersection testing
    const drawnPolygon = L.polygon(points);
    
    // Find buildings that intersect with the drawn polygon
    buildingsLayer.eachLayer(function(layer) {
        // Check if the drawn polygon intersects with the building
        if (isPolygonIntersecting(drawnPolygon, layer)) {
            // Instead of duplicating code, use the toggle function
            toggleBuildingSelection(layer);
        }
    });
    
    // Remove the drawing polyline
    map.removeLayer(polyline);
    polyline = null;
}

/**
 * Check if a polygon intersects with a GeoJSON layer
 */
function isPolygonIntersecting(polygon, layer) {
    // Get the bounds of both objects
    const polyBounds = polygon.getBounds();
    const layerBounds = layer.getBounds();
    
    // Quick check using bounds first (optimization)
    if (!polyBounds.intersects(layerBounds)) {
        return false;
    }
    
    // For more precise intersection, we'd need a full geometric intersection test
    // This is a simplified approach that works for most cases
    try {
        // Check if at least one point of the layer is inside the polygon
        let isIntersecting = false;
        layer.getLatLngs()[0].forEach(function(point) {
            if (isPointInPolygon(point, polygon.getLatLngs()[0])) {
                isIntersecting = true;
            }
        });
        return isIntersecting;
    } catch (e) {
        console.error('Error checking intersection:', e);
        return false;
    }
}

/**
 * Check if a point is inside a polygon
 */
function isPointInPolygon(point, polygon) {
    let inside = false;
    let xi, yi, xj, yj, intersect;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        xi = polygon[i].lat;
        yi = polygon[i].lng;
        xj = polygon[j].lat;
        yj = polygon[j].lng;
        
        intersect = ((yi > point.lng) !== (yj > point.lng)) &&
            (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
            
        if (intersect) inside = !inside;
    }
    
    return inside;
}

/**
 * Start drawing a crater
 */
function startCraterDrawing(e, map) {
    drawing = true;
    const center = e.latlng;
    
    // Create a temporary crater with 0 radius
    polyline = L.circle(center, {
        radius: 0,
        color: '#ffbd00',
        fillColor: '#ffbd00',
        fillOpacity: 0.3,
        weight: 2,
        pane: 'cratersPane'
    }).addTo(map);
    
    // Store the center point
    points = [center];
}

/**
 * Update the crater size as the mouse moves
 */
function updateCraterSize(e, map) {
    if (!drawing || !polyline || points.length === 0) return;
    
    const center = points[0];
    const radius = center.distanceTo(e.latlng);
    
    // Update the circle radius
    polyline.setRadius(radius);
}

/**
 * Finish drawing a crater
 */
function finishCraterDrawing(map, cratersLayer) {
    if (!drawing || !polyline) return;
    
    drawing = false;
    
    // Get the final crater
    const center = points[0];
    const radius = polyline.getRadius();
    
    // Only add craters with a meaningful radius
    if (radius > 1) {
        // Add to our craters collection
        craters.push({
            center: center,
            radius: radius
        });
        
        // Remove the temporary drawing circle
        map.removeLayer(polyline);
        
        // Add a permanent crater to the layer with the correct pane setting
        const craterCircle = L.circle(center, {
            radius: radius,
            color: '#ffbd00',
            fillColor: '#ffbd00',
            fillOpacity: 0.3,
            weight: 2,
            pane: 'cratersPane'
        });
        
        // Add to the craters layer
        cratersLayer.addLayer(craterCircle);
        
        console.log(`Added crater at ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)} with radius ${radius.toFixed(1)}m`);
    } else {
        // Remove tiny craters
        map.removeLayer(polyline);
    }
    
    polyline = null;
}

/**
 * Load tile bounds data from CSV file
 * This is the same function as in damage-map.js but included here for independence
 */
function loadTileBoundsData(url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(csvText => {
            // Parse CSV data with proper handling of quoted fields
            const lines = csvText.trim().split('\n');
            const headers = lines[0].split(',');
            
            // Parse CSV lines with proper handling of quoted fields
            function parseCSVLine(line) {
                const result = [];
                let current = '';
                let inQuotes = false;
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    
                    if (char === '"') {
                        // Toggle the inQuotes flag
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        // End of field, add to result
                        result.push(current);
                        current = '';
                    } else {
                        // Add character to current field
                        current += char;
                    }
                }
                
                // Add the last field
                result.push(current);
                return result;
            }
            
            // Parse each line correctly
            const tiles = [];
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                const tile = {};
                
                // Map CSV values to object properties
                headers.forEach((header, index) => {
                    // Convert numeric values to numbers
                    if (['row', 'col'].includes(header)) {
                        tile[header] = parseInt(values[index], 10);
                    } else if (['lat_center', 'lon_center', 'lat_min', 'lat_max', 'lon_min', 'lon_max'].includes(header)) {
                        tile[header] = parseFloat(values[index]);
                    } else {
                        tile[header] = values[index];
                    }
                });
                
                tiles.push(tile);
            }
            
            return tiles;
        });
}

/**
 * Show error message on the map container
 */
function showErrorMessage(message) {
    const mapContainer = document.getElementById('building-selector-map');
    if (!mapContainer) return;
    
    const errorMsg = document.createElement('div');
    errorMsg.className = 'map-error-message';
    errorMsg.innerHTML = message;
    errorMsg.style.padding = '10px';
    errorMsg.style.background = 'rgba(255,255,255,0.8)';
    errorMsg.style.border = '1px solid #d73027';
    errorMsg.style.borderRadius = '4px';
    errorMsg.style.margin = '10px';
    errorMsg.style.fontFamily = 'var(--ui-font)';
    
    mapContainer.appendChild(errorMsg);
}

/**
 * Clear all selections (buildings and craters)
 */
function clearAllSelections(map) {
    // Clear selected buildings
    if (buildingsLayer) {
        buildingsLayer.eachLayer(function(layer) {
            // Reset building style to original
            layer.setStyle({
                color: '#a5ffd6',        // Greenish outline
                weight: 1,               // Thin border
                opacity: 0.7,            // Slightly transparent outline
                fillColor: 'transparent', // No fill
                fillOpacity: 0           // Fully transparent fill
            });
        });
        
        // Clear the selected buildings set
        selectedBuildings.clear();
    }
    
    // Clear all craters by clearing the layer
    if (cratersLayer) {
        cratersLayer.clearLayers();
        
        // Reset craters array
        craters = [];
        
        console.log('All crater markers cleared');
    }
    
    console.log('All selections cleared');
} 