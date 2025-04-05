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
    // We'll adjust the view after loading the data
    const map = L.map('damage-assessment-map', {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true
    });

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
    
    // Add layers to the map
    buildingsLayer.addTo(map);
    cratersLayer.addTo(map);

    // Load data for both buildings and craters
    Promise.all([
        loadBuildingData('data/buildings_with_labels_stripped.geojson'),
        loadCraterData('data/all_craters.json')
    ])
    .then(([buildingData, craterData]) => {
        // Display the buildings data
        displayBuildingDamageData(map, buildingData, buildingsLayer);
        
        // Display the craters data
        displayCraterData(map, craterData, cratersLayer);
        
        // Combine the bounds of both layers to set the map view
        const combinedBounds = L.featureGroup([buildingsLayer, cratersLayer]).getBounds();
        map.fitBounds(combinedBounds, {
            padding: [20, 20],
            maxZoom: 16
        });
        
        // Add interactive legend for toggling layers
        addInteractiveLegend(map, {
            'Damaged Buildings': buildingsLayer,
            'Craters': cratersLayer
        });
    })
    .catch(error => {
        console.error('Error loading map data:', error);
        // Show error message
        showErrorMessage(map, 'Error loading map data. Please try again later.');
        // Set default view in case of error
        map.setView([31.5, 34.47], 13);
    });

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
 */
function displayBuildingDamageData(map, data, layerGroup) {
    // Clear any existing data
    layerGroup.clearLayers();
    
    // Filter the features to only include damaged buildings
    const damagedBuildings = data.features.filter(feature => 
        feature.properties.is_damaged_labeled === "True"
    );
    
    // Create markers for damaged buildings
    damagedBuildings.forEach(building => {
        // Get the center coordinates of the building
        const lat = building.properties.center_lat;
        const lon = building.properties.center_lon;
        
        // Create a small red circle marker for each damaged building
        const marker = L.circleMarker([lat, lon], {
            radius: 4,
            fillColor: '#d73027',
            color: '#d73027',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
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
    
    // Log the count of damaged buildings
    console.log(`Displaying ${damagedBuildings.length} damaged buildings`);
}

/**
 * Process and display crater data on the map
 */
function displayCraterData(map, data, layerGroup) {
    // Clear any existing data
    layerGroup.clearLayers();
    
    let craterCount = 0;
    
    // Process the nested crater data structure
    data.forEach(tileData => {
        // Each tileData has a 'craters' array containing actual crater objects
        if (tileData.craters && Array.isArray(tileData.craters)) {
            tileData.craters.forEach(crater => {
                // Get the coordinates of the crater (note: it's lng not lon)
                const lat = crater.lat;
                const lng = crater.lng;
                
                if (lat && lng) {
                    // Create a purple circle marker for each crater
                    const marker = L.circleMarker([lat, lng], {
                        radius: 5,
                        fillColor: '#7570b3', // Purple color for craters
                        color: '#7570b3',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.7
                    });
                    
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
    
    // Log the count of craters
    console.log(`Displaying ${craterCount} craters`);
}

/**
 * Add an interactive legend to the map that allows toggling layers
 */
function addInteractiveLegend(map, layers) {
    // Create a custom legend control
    const legend = L.control({position: 'topright'});
    
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend interactive-legend');
        
        // Loop through our layers and generate a label with a colored square for each
        let legendHtml = '';
        const layerColors = {
            'Damaged Buildings': '#d73027',
            'Craters': '#7570b3'
        };
        
        Object.entries(layers).forEach(([name, layer]) => {
            legendHtml += `
                <div class="legend-item" data-layer="${name}">
                    <i style="background:${layerColors[name]}"></i>
                    <span>${name}</span>
                </div>`;
        });
        
        div.innerHTML = legendHtml;
        
        // Style the legend
        div.style.backgroundColor = 'white';
        div.style.padding = '8px 10px';
        div.style.borderRadius = '4px';
        div.style.boxShadow = '0 1px 5px rgba(0,0,0,0.2)';
        div.style.cursor = 'pointer';
        
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
            
            // Add click event to toggle layer visibility
            item.addEventListener('click', function(e) {
                const layerName = this.getAttribute('data-layer');
                const layer = layers[layerName];
                const textLabel = this.querySelector('span');
                const circleIcon = this.querySelector('i');
                
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
            indicator.style.borderRadius = '50%';
        }
        
        return div;
    };
    
    legend.addTo(map);
} 