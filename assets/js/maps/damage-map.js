/**
 * damage-map.js
 * Initializes and manages the interactive building damage assessment map
 */

// Initialize the map when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initDamageMap();
});

/**
 * Initialize the damage assessment map
 */
function initDamageMap() {
    // Check if the map container exists
    const mapContainer = document.getElementById('damage-assessment-map');
    if (!mapContainer) return;

    // Create the map centered on a default location
    const map = L.map('damage-assessment-map', {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true
    });
    
    // Create custom panes with specific z-indexes
    map.createPane('satellitePane');
    map.createPane('dataPane');
    map.getPane('satellitePane').style.zIndex = 350;
    map.getPane('dataPane').style.zIndex = 450;

    // Add a minimalist OpenStreetMap tile layer as base map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Add a scale control to the map
    L.control.scale({position: 'bottomleft'}).addTo(map);

    // Create layer groups for buildings and craters
    const buildingsLayer = L.featureGroup();
    const cratersLayer = L.featureGroup();
    const perimeterLayer = L.featureGroup();
    const satelliteLayer = L.layerGroup(); // New layer for satellite imagery
    
    // Add satellite layer to the map (will be empty until tiles are loaded)
    satelliteLayer.addTo(map);
    
    // Heat map layer for zoomed out view (will be created after data is loaded)
    let heatmapLayer = null;
    
    // Define the zoom threshold for switching between visualization modes
    const ZOOM_THRESHOLD = 16;
    
    // Make the zoom threshold available globally for other functions
    window.ZOOM_THRESHOLD = ZOOM_THRESHOLD;
    
    // Add layers to the map in proper order
    perimeterLayer.addTo(map);
    buildingsLayer.addTo(map);
    cratersLayer.addTo(map);
    
    // Variable to store the tile bounds data
    let tileBoundsData = [];
    
    // Load data for buildings, craters, dataset perimeter, and tile bounds
    Promise.all([
        loadBuildingData('data/buildings_with_labels_stripped.geojson'),
        loadCraterData('data/all_craters.json'),
        // loadDatasetPerimeter('data/dataset_perimeter.geojson'),
        loadDatasetPerimeter('data/tile_perimeter.geojson'),
        loadTileBoundsData('data/tile_bounds_coords_adj.csv')
    ])
    .then(([buildingData, craterData, perimeterData, tileData]) => {
        // Store the tile data for later use
        tileBoundsData = tileData;
        
        // Display the buildings data
        const buildingPoints = displayBuildingDamageData(map, buildingData, buildingsLayer);
        
        // Create heatmap layer with building data
        createHeatmapLayer(map, buildingPoints);
        
        // Display the craters data
        displayCraterData(map, craterData, cratersLayer);
        
        // Display the dataset perimeter
        displayDatasetPerimeter(map, perimeterData, perimeterLayer);
        
        // Combine the bounds of all layers to set the map view
        const combinedBounds = L.featureGroup([buildingsLayer, cratersLayer, perimeterLayer]).getBounds();
        map.fitBounds(combinedBounds, {
            padding: [20, 20],
            maxZoom: 16
        });
        
        // Initialize the satellite imagery handling AFTER we have the map view set
        initSatelliteImagery(map, tileBoundsData, satelliteLayer, ZOOM_THRESHOLD);
        
        // Add interactive legend for toggling layers
        addInteractiveLegend(map, {
            'Damaged Buildings': buildingsLayer,
            'Craters': cratersLayer,
            'Satellite Imagery': satelliteLayer
        }, buildingsLayer, heatmapLayer, satelliteLayer, ZOOM_THRESHOLD);
        
        // Initial visualization based on current zoom level
        updateVisualizationByZoom(map.getZoom());
        
        // Update initial state of satellite legend item after a moment
        setTimeout(() => {
            if (window.legendItems && window.legendItems['Satellite Imagery']) {
                const satelliteLegendItem = window.legendItems['Satellite Imagery'];
                const zoomLevel = map.getZoom();
                
                // If zoom level is below threshold, make legend item appear lighter
                if (zoomLevel < ZOOM_THRESHOLD) {
                    const textLabel = satelliteLegendItem.querySelector('span');
                    const icon = satelliteLegendItem.querySelector('i');
                    
                    // Make both icon and text lighter to indicate not available at this zoom
                    icon.style.opacity = '0.4';
                    textLabel.style.color = '#888';
                    
                    // Add tooltip to explain zoom requirement
                    satelliteLegendItem.title = `Satellite imagery is only visible when zoomed in (level ${ZOOM_THRESHOLD}+)`;
                }
            }
        }, 100);
    })
    .catch(error => {
        console.error('Error loading map data:', error);
        // Show error message
        showErrorMessage(map, 'Error loading map data. Please try again later.');
        // Set default view in case of error
        map.setView([31.5, 34.47], 13);
    });
    
    // Add a zoom event listener to toggle between visualization modes
    map.on('zoomend', function() {
        updateVisualizationByZoom(map.getZoom());
    });
    
    // Function to update the visualization based on zoom level
    function updateVisualizationByZoom(zoomLevel) {
        if (zoomLevel < ZOOM_THRESHOLD) {
            // Zoomed out: show heatmap, hide individual markers
            if (map.hasLayer(buildingsLayer)) {
                map.removeLayer(buildingsLayer);
                // Only show heatmap if buildings layer was visible
                if (heatmapLayer) map.addLayer(heatmapLayer);
            }
        } else {
            // Zoomed in: show individual markers, hide heatmap
            if (heatmapLayer && map.hasLayer(heatmapLayer)) {
                map.removeLayer(heatmapLayer);
                // Only show markers if heatmap was visible
                map.addLayer(buildingsLayer);
            } else if (!map.hasLayer(buildingsLayer) && !map.hasLayer(heatmapLayer) && buildingsLayer) {
                // If neither is visible, don't change visibility
                // This preserves user's choice if they had manually toggled off the layer
            } else {
                map.addLayer(buildingsLayer);
            }
        }
        
        // Update legend state to match current visibility
        updateLegendState();
    }
    
    // Function to update the legend state based on current layer visibility
    function updateLegendState() {
        // This will be called after the legend is created
        if (!window.legendItems) return;
        
        // Update the damaged buildings legend item
        const buildingsLegendItem = window.legendItems['Damaged Buildings'];
        if (buildingsLegendItem) {
            const textLabel = buildingsLegendItem.querySelector('span');
            const circleIcon = buildingsLegendItem.querySelector('i');
            
            // Check if either the buildings layer or heatmap is visible
            const isVisible = map.hasLayer(buildingsLayer) || (heatmapLayer && map.hasLayer(heatmapLayer));
            
            if (isVisible) {
                // Restore normal appearance
                circleIcon.style.opacity = '1';
                textLabel.style.color = '#333'; // Normal text color when active
            } else {
                // Make both circle and text lighter
                circleIcon.style.opacity = '0.4';
                textLabel.style.color = '#888'; // Lighter text color when inactive
            }
        }
        
        // Update the satellite imagery legend item
        const satelliteLegendItem = window.legendItems['Satellite Imagery'];
        if (satelliteLegendItem) {
            const textLabel = satelliteLegendItem.querySelector('span');
            const icon = satelliteLegendItem.querySelector('i');
            
            // Check if the satellite layer is visible
            const isVisible = map.hasLayer(satelliteLayer);
            
            if (isVisible) {
                // Restore normal appearance
                icon.style.opacity = '1';
                textLabel.style.color = '#333'; // Normal text color when active
            } else {
                // Make both icon and text lighter
                icon.style.opacity = '0.4';
                textLabel.style.color = '#888'; // Lighter text color when inactive
            }
        }
    }
    
    // Store a reference to the updateLegendState function for use in other functions
    window.updateMapLegendState = updateLegendState;
    
    // Function to create the heatmap layer
    function createHeatmapLayer(map, buildingPoints) {
        if (buildingPoints.length > 0) {
            // Create a heatmap layer using the building points
            heatmapLayer = L.heatLayer(buildingPoints, {
                radius: 3,           // Reduced size of each "heat" point
                blur: 3,             // Reduced blur for sharper edges
                maxZoom: ZOOM_THRESHOLD,  // Zoom level where the points reach maximum intensity
                max: 0.1,            // Maximum point intensity
                minOpacity: 0.1,     // Lower opacity
                maxOpacity: 1,
                // Use discrete levels with the specified color scheme (darkest to lightest)
                gradient: {
                    0.2: '#E9CACE',  // Lightest
                    0.4: '#EBA0AA',
                    0.6: '#EC7785', 
                    0.8: '#EE4D61',
                    1.0: '#EF233C'   // Darkest
                },
                pane: 'dataPane'    // Use the custom data pane to stay on top
            });
            
            // Check if we should display the heatmap based on current zoom
            if (map.getZoom() < ZOOM_THRESHOLD) {
                heatmapLayer.addTo(map);
            }
        }
    }

    // Make sure the map resizes correctly when its container changes size
    window.addEventListener('resize', function() {
        map.invalidateSize();
    });
}

/**
 * Load building damage data from GeoJSON file
 */
function loadBuildingData(url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        });
}

/**
 * Load crater data from JSON file
 */
function loadCraterData(url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        });
}

/**
 * Load dataset perimeter from GeoJSON file
 */
function loadDatasetPerimeter(url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        });
}

/**
 * Load tile bounds data from CSV file
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
            
            console.log("CSV headers:", headers);
            
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
                
                // Show a sample of the first parsed line
                if (i === 1) {
                    console.log("First CSV line:", lines[i]);
                    console.log("Properly parsed into:", values);
                }
                
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
            
            // Log a sample tile for debugging
            if (tiles.length > 0) {
                console.log("Sample tile after correct parsing:", tiles[0]);
                // Show lat/lon bounds explicitly
                console.log("First tile bounds check:", {
                    lat_min: tiles[0].lat_min,
                    lat_max: tiles[0].lat_max,
                    lon_min: tiles[0].lon_min,
                    lon_max: tiles[0].lon_max
                });
            }
            
            console.log(`Loaded ${tiles.length} tiles`);
            return tiles;
        });
}

/**
 * Show error message on the map
 */
function showErrorMessage(map, message) {
    const errorMsg = L.DomUtil.create('div', 'map-error-message');
    errorMsg.innerHTML = message;
    errorMsg.style.padding = '10px';
    errorMsg.style.background = 'rgba(255,255,255,0.8)';
    errorMsg.style.border = '1px solid #d73027';
    errorMsg.style.borderRadius = '4px';
    errorMsg.style.margin = '10px';
    errorMsg.style.fontFamily = 'var(--ui-font)';
    map.getContainer().appendChild(errorMsg);
}

/**
 * Process and display the building damage data on the map
 * Returns an array of points for heatmap visualization
 */
function displayBuildingDamageData(map, data, layerGroup) {
    // Clear any existing data
    layerGroup.clearLayers();
    
    // Filter the features to only include damaged buildings
    const damagedBuildings = data.features.filter(feature => 
        feature.properties.is_damaged_labeled === "True"
    );
    
    // Create an array for heatmap points
    const heatmapPoints = [];
    
    // Define marker sizes based on zoom
    const DEFAULT_RADIUS = 4;
    const ZOOMED_IN_RADIUS = 2; // Smaller radius when zoomed in
    const ZOOM_THRESHOLD = 16;  // Match the main map's threshold
    
    // Function to update building marker sizes based on zoom level
    function updateBuildingMarkerSizes(zoomLevel) {
        layerGroup.eachLayer(function(layer) {
            if (layer instanceof L.CircleMarker) {
                if (zoomLevel >= ZOOM_THRESHOLD) {
                    // Use smaller radius when zoomed in
                    layer.setRadius(ZOOMED_IN_RADIUS);
                } else {
                    // Use default radius when zoomed out
                    layer.setRadius(DEFAULT_RADIUS);
                }
            }
        });
    }
    
    // Create markers for damaged buildings
    damagedBuildings.forEach(building => {
        // Get the center coordinates of the building
        const lat = building.properties.center_lat;
        const lon = building.properties.center_lon;
        
        // Add point to heatmap array [lat, lng, intensity]
        // We're using a constant intensity of 1 for each point
        heatmapPoints.push([lat, lon, 1]);
        
        // Create a small red circle marker for each damaged building
        const marker = L.circleMarker([lat, lon], {
            radius: DEFAULT_RADIUS, // Start with default radius
            fillColor: '#d73027',
            color: '#edf2f4',    // White edge color
            weight: 2,         // Thicker edge line
            opacity: 1,
            fillOpacity: 0.8,
            pane: 'dataPane' // Use the custom data pane to stay on top
        });
        
        // Add a popup with information about the building
        marker.bindPopup(`
            <div class="damage-popup">
                <h3>Damaged Building</h3>
                <p><strong>ID:</strong> ${building.properties.id}</p>
                <p><strong>Location:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
            </div>
        `);
        
        layerGroup.addLayer(marker);
    });
    
    // Set initial marker sizes based on current zoom
    updateBuildingMarkerSizes(map.getZoom());
    
    // Add a zoom change listener to update building marker sizes
    map.on('zoomend', function() {
        updateBuildingMarkerSizes(map.getZoom());
    });
    
    // Log the count of damaged buildings
    console.log(`Displaying ${damagedBuildings.length} damaged buildings`);
    
    // Return the points for heatmap
    return heatmapPoints;
}

/**
 * Process and display crater data on the map
 */
function displayCraterData(map, data, layerGroup) {
    // Clear any existing data
    layerGroup.clearLayers();
    
    let craterCount = 0;
    const FIXED_RADIUS = 5; // Fixed radius to use when zoomed out
    const ZOOM_THRESHOLD = 16; // Match the main map's threshold
    const CRATER_COLOR = '#ffbd00'; // Crater color
    
    // Add a zoom change listener to update crater sizes
    map.on('zoomend', function() {
        updateCraterSizes(map.getZoom());
    });
    
    // Function to update crater sizes based on zoom level
    function updateCraterSizes(zoomLevel) {
        layerGroup.eachLayer(function(layer) {
            if (layer.craterRadius) {
                if (zoomLevel >= ZOOM_THRESHOLD) {
                    // Use exact crater radius when zoomed in
                    // Convert from meters to pixels at the current zoom level and location
                    
                    // Get the crater's LatLng
                    const craterLatLng = layer.getLatLng();
                    
                    // Get a point 'radius' meters away from the center (horizontally)
                    // Use Leaflet's projection methods to calculate this properly
                    const pointA = map.project(craterLatLng);
                    const pointB = map.project(
                        L.latLng(
                            craterLatLng.lat,
                            // Move east by 'radius' meters (roughly convert to degrees)
                            craterLatLng.lng + (layer.craterRadius / (111320 * Math.cos(craterLatLng.lat * Math.PI / 180)))
                        )
                    );
                    
                    // Calculate pixel distance between the points at current zoom level
                    const radiusInPixels = pointA.distanceTo(pointB);
                    
                    // Set the radius in pixels
                    layer.setRadius(radiusInPixels);
                    
                    // When zoomed in, add a fill with low opacity
                    layer.setStyle({
                        fillOpacity: 0.2,
                        fillColor: CRATER_COLOR
                    });
                } else {
                    // Use fixed radius when zoomed out
                    layer.setRadius(FIXED_RADIUS);
                    
                    // When zoomed out, no fill (open circles)
                    layer.setStyle({
                        fillOpacity: 0,
                        fillColor: 'transparent'
                    });
                }
            }
        });
    }
    
    // Process the nested crater data structure
    data.forEach(tileData => {
        // Each tileData has a 'craters' array containing actual crater objects
        if (tileData.craters && Array.isArray(tileData.craters)) {
            tileData.craters.forEach(crater => {
                // Get the coordinates of the crater (note: it's lng not lon)
                const lat = crater.lat;
                const lng = crater.lng;
                
                if (lat && lng) {
                    // Create an open circle marker for each crater
                    const marker = L.circleMarker([lat, lng], {
                        radius: FIXED_RADIUS, // Start with fixed radius, will update based on zoom
                        fillColor: 'transparent', // Initial fill color (will be updated based on zoom)
                        color: CRATER_COLOR,    // Outline color
                        weight: 1,              // Line thickness
                        opacity: 0.8,           // Outline opacity
                        fillOpacity: 0,          // Initial fill opacity (will be updated based on zoom)
                        pane: 'dataPane'        // Use the custom data pane to stay on top
                    });
                    
                    // Store the actual crater radius for use when zoomed in
                    marker.craterRadius = crater.radius;
                    
                    // Add a popup with information about the crater
                    marker.bindPopup(`
                        <div class="damage-popup">
                            <h3>Crater</h3>
                            <p><strong>Location:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
                            <p><strong>Radius:</strong> ${crater.radius.toFixed(2)} m</p>
                            <p><strong>Tile:</strong> Row ${tileData.row}, Col ${tileData.col}</p>
                        </div>
                    `);
                    
                    layerGroup.addLayer(marker);
                    craterCount++;
                }
            });
        }
    });
    
    // Initialize crater sizes based on current zoom level
    updateCraterSizes(map.getZoom());
    
    // Log the count of craters
    console.log(`Displaying ${craterCount} craters`);
}

/**
 * Display dataset perimeter on the map
 */
function displayDatasetPerimeter(map, data, layerGroup) {
    // Clear any existing data
    layerGroup.clearLayers();
    
    // Add the perimeter as a thin gray line
    L.geoJSON(data, {
        style: {
            color: '#666666',     // Gray color
            weight: 1.5,          // Thin line
            opacity: 0.8,         // Slightly transparent
            fillOpacity: 0,       // No fill
            dashArray: '4,4'      // Optional: make it a dashed line
        }
    }).addTo(layerGroup);
    
    console.log('Dataset perimeter added to map');
}

/**
 * Add an interactive legend to the map that allows toggling layers
 */
function addInteractiveLegend(map, layers, buildingsLayer, heatmapLayer, satelliteLayer, zoomThreshold) {
    // Create a custom legend control
    const legend = L.control({position: 'topright'});
    
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend interactive-legend');
        
        // Loop through our layers and generate a label with a colored square for each
        let legendHtml = '';
        const layerColors = {
            'Damaged Buildings': '#d73027',
            'Craters': '#ffbd00',
            'Satellite Imagery': '#007bff'
        };
        
        Object.entries(layers).forEach(([name, layer]) => {
            // Create different style for craters vs buildings in legend
            if (name === 'Craters') {
                // For craters - empty circle with border
                legendHtml += `
                    <div class="legend-item" data-layer="${name}" title="Craters appear as outlines when zoomed out, and filled with lower opacity when zoomed in">
                        <i style="background:transparent; border:1.5px solid ${layerColors[name]}"></i>
                        <span>${name}</span>
                    </div>`;
            } else if (name === 'Satellite Imagery') {
                // For satellite imagery - blue square
                legendHtml += `
                    <div class="legend-item" data-layer="${name}" title="Satellite imagery (only visible when zoomed in)">
                        <i style="background:${layerColors[name]}; border-radius:0"></i>
                        <span>${name}</span>
                    </div>`;
            } else {
                // For buildings - filled circle
                legendHtml += `
                    <div class="legend-item" data-layer="${name}">
                        <i style="background:${layerColors[name]}"></i>
                        <span>${name}</span>
                    </div>`;
            }
        });
        
        div.innerHTML = legendHtml;
        
        // Style the legend
        div.style.backgroundColor = 'white';
        div.style.padding = '8px 10px';
        div.style.borderRadius = '4px';
        div.style.boxShadow = '0 1px 5px rgba(0,0,0,0.2)';
        div.style.cursor = 'pointer';
        
        // Store legend items for reference
        window.legendItems = {};
        
        // Style the legend items
        const items = div.getElementsByClassName('legend-item');
        for (let item of items) {
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.padding = '4px 0';
            item.style.position = 'relative';
            
            // Set initial text color
            const textLabel = item.querySelector('span');
            textLabel.style.color = '#333';
            
            // Store reference to this legend item
            const layerName = item.getAttribute('data-layer');
            window.legendItems[layerName] = item;
            
            // Add click event to toggle layer visibility
            item.addEventListener('click', function(e) {
                const layerName = this.getAttribute('data-layer');
                const layer = layers[layerName];
                const textLabel = this.querySelector('span');
                const circleIcon = this.querySelector('i');
                
                if (layerName === 'Damaged Buildings') {
                    // Special handling for buildings - toggle either heatmap or individual markers
                    const zoomLevel = map.getZoom();
                    const isVisible = map.hasLayer(buildingsLayer) || (heatmapLayer && map.hasLayer(heatmapLayer));
                    
                    if (isVisible) {
                        // Hide both representations
                        if (map.hasLayer(buildingsLayer)) {
                            map.removeLayer(buildingsLayer);
                        }
                        if (heatmapLayer && map.hasLayer(heatmapLayer)) {
                            map.removeLayer(heatmapLayer);
                        }
                        
                        // Make both circle and text lighter
                        circleIcon.style.opacity = '0.4';
                        textLabel.style.color = '#888'; // Lighter text color when inactive
                    } else {
                        // Show appropriate representation based on zoom level
                        if (zoomLevel < window.ZOOM_THRESHOLD) {
                            // Show heatmap when zoomed out
                            if (heatmapLayer) map.addLayer(heatmapLayer);
                        } else {
                            // Show individual markers when zoomed in
                            map.addLayer(buildingsLayer);
                        }
                        
                        // Restore normal appearance
                        circleIcon.style.opacity = '1';
                        textLabel.style.color = '#333'; // Normal text color when active
                    }
                } else if (layerName === 'Satellite Imagery') {
                    // Special handling for satellite imagery
                    const isVisible = map.hasLayer(satelliteLayer);
                    const currentZoom = map.getZoom();
                    
                    console.log(`Satellite toggle clicked. Currently visible: ${isVisible}, Current zoom: ${currentZoom}`);
                    
                    if (isVisible) {
                        // Hide satellite layer
                        map.removeLayer(satelliteLayer);
                        
                        // Make icon and text lighter
                        circleIcon.style.opacity = '0.4';
                        textLabel.style.color = '#888'; // Lighter text color when inactive
                        
                        console.log('Satellite layer removed from map');
                    } else {
                        // Show satellite layer
                        map.addLayer(satelliteLayer);
                        
                        // Check if we're zoomed in enough for tiles to be visible
                        if (currentZoom >= zoomThreshold) {
                            // Restore normal appearance
                            circleIcon.style.opacity = '1';
                            textLabel.style.color = '#333'; // Normal text color when active
                            
                            console.log('Triggering satellite tile loading');
                            // Manually trigger a moveend event to update visible tiles
                            map.fire('moveend');
                        } else {
                            // Keep reduced opacity to indicate not visible at this zoom
                            circleIcon.style.opacity = '0.4';
                            textLabel.style.color = '#888';
                            
                            // Add tooltip to explain zoom requirement
                            this.title = `Satellite imagery is only visible when zoomed in (level ${zoomThreshold}+)`;
                            
                            console.log(`Zoom level too low for satellite tiles: ${currentZoom}, need ${zoomThreshold}+`);
                        }
                    }
                } else {
                    // Normal toggle behavior for other layers (like craters)
                    if (map.hasLayer(layer)) {
                        // Hide the layer
                        map.removeLayer(layer);
                        
                        // Make both circle and text lighter
                        circleIcon.style.opacity = '0.4';
                        textLabel.style.color = '#888'; // Lighter text color when inactive
                    } else {
                        // Show the layer
                        map.addLayer(layer);
                        
                        // Restore normal appearance
                        circleIcon.style.opacity = '1';
                        textLabel.style.color = '#333'; // Normal text color when active
                    }
                }
                
                // Prevent the click from propagating to the map
                L.DomEvent.stopPropagation(e);
            });
        }
        
        // Style the color indicators
        const indicators = div.getElementsByTagName('i');
        for (let indicator of indicators) {
            indicator.style.width = '12px';
            indicator.style.height = '12px';
            indicator.style.display = 'inline-block';
            indicator.style.marginRight = '8px';
            
            // Set border-radius based on the parent's data-layer attribute
            const layerName = indicator.parentNode.getAttribute('data-layer');
            if (layerName === 'Satellite Imagery') {
                // Square for satellite imagery
                indicator.style.borderRadius = '0';
            } else {
                // Circle for other layers
                indicator.style.borderRadius = '50%';
            }
        }
        
        return div;
    };
    
    legend.addTo(map);
    
    // Update the legend state after it's added to the map
    if (window.updateMapLegendState) {
        setTimeout(window.updateMapLegendState, 100);
    }
}

/**
 * Initialize and manage satellite imagery display
 */
function initSatelliteImagery(map, tileBoundsData, satelliteLayer, zoomThreshold) {
    // Track currently displayed tile images to avoid duplicates
    const loadedTiles = new Set();
    
    // Add simple CSS for satellite tiles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .satellite-tile {
            pointer-events: none;    /* Allow clicking through the image */
            z-index: 500 !important; /* Force high z-index */
        }
        .leaflet-image-layer {
            z-index: 500 !important; /* Make sure image overlay panes are visible */
        }
        .leaflet-pane.satellitePane {
            z-index: 350 !important; /* Match our custom pane z-index */
        }
        .leaflet-pane.dataPane {
            z-index: 450 !important; /* Match our custom pane z-index */
        }
    `;
    document.head.appendChild(styleElement);
    
    // Log current state
    console.log(`Satellite layer initialization - Current zoom: ${map.getZoom()}, Threshold: ${zoomThreshold}`);
    console.log(`Satellite layer is on map: ${map.hasLayer(satelliteLayer)}`);
    console.log(`Number of tile bounds loaded: ${tileBoundsData.length}`);
    
    // Function to update visible satellite tiles based on current view
    function updateVisibleTiles() {
        const currentZoom = map.getZoom();
        
        // Only process if the layer is on the map and zoom level is sufficient
        if (!map.hasLayer(satelliteLayer) || currentZoom < zoomThreshold) {
            // Clear all tiles if zoom is below threshold or layer is hidden
            satelliteLayer.clearLayers();
            loadedTiles.clear();
            console.log(`Not showing satellite - Layer visible: ${map.hasLayer(satelliteLayer)}, Current zoom: ${currentZoom}, Threshold: ${zoomThreshold}`);
            return;
        }
        
        // Get current map bounds
        const bounds = map.getBounds();
        console.log("Current map bounds:", bounds.toBBoxString());
        
        // Find tiles that have any corner within the current view
        const visibleTiles = tileBoundsData.filter(tile => {
            // Create LatLng objects for all four corners of the tile
            const corners = [
                L.latLng(tile.lat_min, tile.lon_min), // Southwest
                L.latLng(tile.lat_min, tile.lon_max), // Southeast
                L.latLng(tile.lat_max, tile.lon_max), // Northeast
                L.latLng(tile.lat_max, tile.lon_min)  // Northwest
            ];
            
            // Check if any corner is within the current view
            const isVisible = corners.some(corner => bounds.contains(corner)) || 
                              // Also check if the tile completely contains the current view
                              (tile.lat_min <= bounds.getSouth() && 
                               tile.lat_max >= bounds.getNorth() && 
                               tile.lon_min <= bounds.getWest() && 
                               tile.lon_max >= bounds.getEast());
            
            if (isVisible) {
                console.log(`Tile ${tile.row}_${tile.col} has at least one corner within view`);
            }
            
            return isVisible;
        });
        
        console.log(`Found ${visibleTiles.length} satellite tiles in current view`);
        
        // Add new visible tiles
        visibleTiles.forEach(tile => {
            const tileId = `${tile.row}_${tile.col}`;
            
            // Only add if not already loaded
            if (!loadedTiles.has(tileId)) {
                try {
                    // Create image URL
                    const imageUrl = `images/tiles/cropped_row_${tile.row}_col_${tile.col}.webp`;
                    
                    // Output raw tile bounds data for debugging
                    console.log(`Raw tile bounds for ${tileId}:`, {
                        lat_min: tile.lat_min,
                        lat_max: tile.lat_max,
                        lon_min: tile.lon_min,
                        lon_max: tile.lon_max
                    });
                    
                    // Define the image bounds using the correct lat/lon values from CSV
                    const imageBounds = [
                        [tile.lat_min, tile.lon_min], // Southwest corner
                        [tile.lat_max, tile.lon_max]  // Northeast corner
                    ];
                    
                    // Log image information
                    console.log(`Adding satellite tile ${tileId} at ${imageUrl}`);
                    console.log(`Bounds formatted for Leaflet: ${JSON.stringify(imageBounds)}`);
                    
                    // Test image loading separately from overlay
                    const testImg = new Image();
                    testImg.onload = function() { 
                        console.log(`✅ Image exists for tile ${tileId}`);
                        
                        // Create image overlay in the satellite pane with 80% opacity
                        const imageOverlay = L.imageOverlay(imageUrl, imageBounds, {
                            opacity: 1.0,  // Set to 80% opacity as requested
                            interactive: false,
                            pane: 'satellitePane',
                            className: 'satellite-tile',
                        });
                        
                        // Add to layer and tracking set
                        satelliteLayer.addLayer(imageOverlay);
                        loadedTiles.add(tileId);
                        
                        console.log(`Added satellite tile overlay for: row ${tile.row}, col ${tile.col}`);
                    };
                    testImg.onerror = function() { 
                        console.error(`❌ Cannot load image for tile ${tileId}`); 
                    };
                    testImg.src = imageUrl;
                } catch (error) {
                    console.error(`Error adding tile ${tileId}:`, error);
                }
            }
        });
    }
    
    // Add event listeners to update visible tiles on map move or zoom
    map.on('moveend', updateVisibleTiles);
    
    // Handle zoom changes
    map.on('zoomend', function() {
        const currentZoom = map.getZoom();
        console.log(`Zoom changed to ${currentZoom}, threshold is ${zoomThreshold}`);
        
        // When crossing the threshold, clear all tiles or load new ones as appropriate
        if (currentZoom < zoomThreshold) {
            // Clear all tiles when zoomed out
            satelliteLayer.clearLayers();
            loadedTiles.clear();
            console.log('Cleared all satellite tiles - zoom below threshold');
        } else if (map.hasLayer(satelliteLayer)) {
            // Reload visible tiles when zoomed in
            console.log('Updating satellite tiles after zoom change');
            updateVisibleTiles();
        }
    });
    
    // Initial update to load any tiles that should be visible
    const currentZoom = map.getZoom();
    if (currentZoom >= zoomThreshold && map.hasLayer(satelliteLayer)) {
        console.log('Initial update of satellite tiles');
        updateVisibleTiles();
    } else {
        console.log(`Not loading satellite tiles initially - zoom level ${currentZoom} is below threshold ${zoomThreshold}`);
    }
    
    // Verify that satelliteLayer is properly added to the map
    console.log('Satellite layer added to map:', map.hasLayer(satelliteLayer));
    console.log('Current zoom level:', map.getZoom(), 'Threshold:', zoomThreshold);
} 