/**
 * process-diagram.js
 * Simple hierarchical process flow diagram with expandable stages
 * Rewritten to focus on initial overview layout and centering.
 */

// Initialize the diagram when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initProcessDiagramSVG();
});

// --- Global variable to hold the ESC key handler ---
// We define it here so it can be added and removed
let handleEscKey = null; 

/**
 * Initialize the process diagram - focusing on the high-level overview layout.
 */
function initProcessDiagram() {
    const diagramContainer = document.getElementById('process-diagram');
    if (!diagramContainer) {
        console.error("Diagram container '#process-diagram' not found.");
        return;
    }

    // --- Clean up potential old ESC listener ---
    // Important if init is called multiple times or after errors
    if (handleEscKey && typeof document !== 'undefined') {
        document.removeEventListener('keydown', handleEscKey);
        console.log("Removed existing ESC listener.");
        handleEscKey = null; // Reset the handler variable
    }
    
    // Clear any existing content
    diagramContainer.innerHTML = ''; 
    
    // --- Layout Constants ---
    const width = diagramContainer.clientWidth || 800; 
    const height = 500; // Keep the increased height
    const stageWidth = 120;
    const stageHeight = 80;
    const stageMargin = 40; 
    const titleHeightEstimate = 40; 
    const titleBoxGap = 20;         
    
    // --- SVG Setup ---
    const svg = d3.select('#process-diagram')
        .append('svg')
        .attr('width', '100%') 
        .attr('height', height) 
        .attr('viewBox', `0 0 ${width} ${height}`) 
        .attr('preserveAspectRatio', 'xMidYMid meet'); 
        
    // Append the main container group *once* here
    // renderDetailView will now select this instead of creating its own
    const container = svg.append('g')
        .attr('class', 'diagram-container'); // Keep the class for potential styling
        
    // --- Data ---
    const diagramData = createDiagramData(); 
    const { stages } = diagramData; 
    
    // --- Calculate Positions (for overview) ---
    const contentBlockHeight = titleHeightEstimate + titleBoxGap + stageHeight;
    const startYOffset = Math.max(0, (height - contentBlockHeight) / 2);
    const titleY = startYOffset + 15; 
    const stagesStartY = startYOffset + titleHeightEstimate + titleBoxGap;
    const totalStagesWidth = stages.length * stageWidth + (stages.length - 1) * stageMargin;
    const stagesStartX = (width - totalStagesWidth) / 2;
    
    // --- Render Title ---
    container.append('text')
        .attr('x', width / 2) 
        .attr('y', titleY)    
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central') 
        .attr('font-family', 'var(--title-font, sans-serif)')
        .attr('font-size', '20px') 
        .attr('font-weight', 'bold')
        .attr('fill', '#184e77') 
        .text('Process Overview'); 
        
    // --- Render Overview Stages ---
    const stageGroup = container.selectAll('.high-level-stage')
        .data(stages)
        .enter()
        .append('g')
        .attr('class', 'high-level-stage')
        .attr('transform', (d, i) => {
            const x = stagesStartX + i * (stageWidth + stageMargin);
            return `translate(${x}, ${stagesStartY})`;
        })
        .style('cursor', 'pointer') 
        .on('click', function(event, d) {
            console.log("--- Stage Clicked (Overview) ---"); 
            console.log("Stage ID:", d.id);      
            
            try { 
                // Clear the overview content specifically
                container.html(''); 
                console.log("Overview container cleared."); 

                // Show the back button 
                if (diagramContainer._backButton) {
                     diagramContainer._backButton.style.display = 'block';
                     console.log("Back button displayed."); 
                } else {
                     console.error("Back button reference not found on diagramContainer.");
                     // Attempt to find/create it again if lost? Or just log error.
                }

                // --- Define and Add ESC Key Listener ---
                handleEscKey = function(e) {
                    if (e.key === 'Escape') {
                        console.log("ESC key pressed - returning to overview.");
                        // Hide back button
                        if (diagramContainer._backButton) {
                            diagramContainer._backButton.style.display = 'none';
                        }
                        // Remove this listener *before* re-initializing
                        document.removeEventListener('keydown', handleEscKey);
                        handleEscKey = null; // Clear the reference
                        // Re-initialize the overview diagram
                        initProcessDiagram(); 
                    }
                };
                document.addEventListener('keydown', handleEscKey);
                console.log("ESC key listener added.");

                // Call the function to render the detail view
                console.log("Calling renderDetailView..."); 
                // Pass the persistent container group
                renderDetailView(container, diagramData, d.id, width, height); 
                console.log("renderDetailView finished."); 

            } catch (error) {
                console.error("Error in overview click handler:", error); 
            }
        });
        
    // Add stage rectangles
    stageGroup.append('rect')
        .attr('width', stageWidth)
        .attr('height', stageHeight)
        .attr('rx', 8) 
        .attr('ry', 8)
        .attr('fill', '#d9ed92') 
        .attr('stroke', 'none');
        
    // Add stage labels
    stageGroup.append('text')
        .attr('x', stageWidth / 2) 
        .attr('y', stageHeight / 2) 
        .attr('text-anchor', 'middle') 
        .attr('dominant-baseline', 'central') 
        .attr('font-family', 'var(--title-font, sans-serif)')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#184e77') 
        .text(d => d.label)
        .call(wrapText, stageWidth - 20); 
        
    // --- Render Arrows (Overview) ---
    const arrowY = stagesStartY + stageHeight / 2;
    for (let i = 0; i < stages.length - 1; i++) {
        const x1 = stagesStartX + (i + 1) * stageWidth + i * stageMargin; 
        const x2 = x1 + stageMargin; 
        container.append('line')
            .attr('x1', x1)
            .attr('y1', arrowY)
            .attr('x2', x2 - 10) 
            .attr('y2', arrowY)
            .attr('stroke', '#184e77')
            .attr('stroke-width', 2);
        container.append('polygon')
            .attr('points', `${x2-10},${arrowY-5} ${x2},${arrowY} ${x2-10},${arrowY+5}`)
            .attr('fill', '#184e77');
    }
    
    // --- Back Button (Setup) ---
    // Ensure button exists or create it
    let backButton = diagramContainer._backButton;
    if (!backButton) {
        backButton = document.createElement('button');
        backButton.textContent = 'Back to Overview';
        // Apply styles (consider moving to CSS)
        backButton.style.position = 'absolute'; 
        backButton.style.bottom = '10px';
        backButton.style.right = '10px';
        backButton.style.padding = '5px 10px';
        backButton.style.background = '#fff';
        backButton.style.color = '#184e77';
        backButton.style.border = '1px solid #184e77';
        backButton.style.borderRadius = '2px';
        backButton.style.cursor = 'pointer';
        backButton.style.zIndex = '100';
        
        // Add click listener for the back button
        backButton.addEventListener('click', function() {
            console.log("Back button clicked"); 
            // Hide the back button itself
            backButton.style.display = 'none';
            // --- Remove ESC listener ---
            if (handleEscKey && typeof document !== 'undefined') {
                document.removeEventListener('keydown', handleEscKey);
                console.log("ESC key listener removed by back button.");
                handleEscKey = null; // Clear the reference
            }
            // Re-initialize the overview diagram
            initProcessDiagram(); 
        });
        
        // Append to the main container div, not the SVG
        diagramContainer.appendChild(backButton); 
        // Store reference on the container element
        diagramContainer._backButton = backButton; 
        console.log("Back button created and stored.");
    }
    // Ensure it's hidden initially when overview loads
    backButton.style.display = 'none'; 

    // Store other references if needed
    diagramContainer._svg = svg;
    // Store the persistent container group reference
    diagramContainer._container = container; 
    diagramContainer._diagramData = diagramData;
    diagramContainer._width = width;
    diagramContainer._height = height;
    console.log("initProcessDiagram finished.");
}

/**
 * Creates the data structure for the diagram.
 * Includes high-level stages and detailed nodes/links for each stage.
 * CORRECTED based *only* on the provided image content for DC and DP.
 * Other stages are placeholders until details are provided.
 */
function createDiagramData() {
    // --- High-Level Stages ---
    const stages = [
        { id: 'DC', label: 'Data Collection' },
        { id: 'DP', label: 'Data Processing' },
        { id: 'ML', label: 'Manual Labeling' },
        { id: 'MT', label: 'Model Training' },
        { id: 'PR', label: 'Prediction Refinement' },
        { id: 'OV', label: 'Output Visualization' }
    ];

    // --- Detailed Nodes for Each Stage ---
    // Defines the individual boxes within each high-level stage
    // Based *strictly* on the provided image.
    const stageNodes = {
        'DC': [
            { id: 'dc-gew', label: 'Google Earth Web' },
            { id: 'dc-as', label: 'Automated Screenshots' },
            { id: 'dc-latest', label: 'Latest imagery capture (2023)' },
            { id: 'dc-earlier', label: 'Earlier imagery capture (2022)' },
            { id: 'dc-osm', label: 'Building Footprint data from Open Street Maps' }
        ],
        'DP': [
            { id: 'dp-align', label: 'Align images' },
            { id: 'dp-geo', label: 'Geo-reference images' },
            { id: 'dp-extract', label: 'Extract building images' }
        ],
        // --- Placeholders for stages not shown in detail in the image ---
        'ML': [
             // { id: 'ml-placeholder', label: 'Manual Labeling Details...' } // Add nodes when provided
        ],
        'MT': [
             // { id: 'mt-placeholder', label: 'Model Training Details...' } // Add nodes when provided
        ],
        'PR': [
             // { id: 'pr-placeholder', label: 'Prediction Refinement Details...' } // Add nodes when provided
        ],
        'OV': [
             // { id: 'ov-placeholder', label: 'Output Visualization Details...' } // Add nodes when provided
        ]
    };

    // --- Detailed Links for Each Stage ---
    // Defines the connections *between nodes within the same stage*
    // Based *strictly* on the provided image.
    const stageLinks = {
        'DC': [
            { source: 'dc-gew', target: 'dc-as' },
            { source: 'dc-as', target: 'dc-latest' },
            { source: 'dc-as', target: 'dc-earlier' }
            // Note: Link from dc-osm is inter-stage, handled by main flow/layout later
            // Note: Links from dc-latest/dc-earlier are inter-stage, handled by main flow/layout later
        ],
        'DP': [
            { source: 'dp-align', target: 'dp-geo' },
            { source: 'dp-geo', target: 'dp-extract' }
            // Note: Links into dp-align and dp-extract are inter-stage
            // Note: Link out of dp-extract is inter-stage
        ],
        // --- Placeholders for stages not shown in detail in the image ---
        'ML': [ /* Add links when provided */ ],
        'MT': [ /* Add links when provided */ ],
        'PR': [ /* Add links when provided */ ],
        'OV': [ /* Add links when provided */ ]
    };

    // Return the complete data structure
    return { stages, stageNodes, stageLinks };
}

// --- Text Wrapping Utility ---
/**
 * Wraps SVG text based on specified width.
 * Appends tspan elements for each line.
 * @param {d3.Selection} textSelection - The D3 selection of text elements.
 * @param {number} width - The maximum width for the text.
 */
function wrapText(textSelection, width) {
  textSelection.each(function() {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse(); // Split into words
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1; // ems
    // Get initial position (adjust slightly for multi-line centering)
    const x = text.attr('x'); 
    const y = text.attr('y'); 
    const dy = parseFloat(text.attr('dy') || 0); // Initial dy if any

    // Clear existing text content
    text.text(null); 

    // Create the first tspan for the first line
    let tspan = text.append('tspan')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('dy', dy + 'em');

    // Process words one by one
    while (word = words.pop()) {
      line.push(word); // Add word to current line
      tspan.text(line.join(' ')); // Set tspan text

      // Check if line exceeds width
      if (tspan.node().getComputedTextLength() > width) {
        line.pop(); // Remove the word that caused overflow
        tspan.text(line.join(' ')); // Reset tspan to previous state
        line = [word]; // Start new line with the overflow word

        // Create new tspan for the new line
        tspan = text.append('tspan')
                    .attr('x', x)
                    .attr('y', y)
                    // Increment dy for new line position
                    .attr('dy', ++lineNumber * lineHeight + dy + 'em') 
                    .text(word);
      }
    }

    // Adjust vertical centering for multi-line text
    const tspans = text.selectAll('tspan');
    const numLines = tspans.size();
    if (numLines > 1) {
        // Calculate the total height of the text block
        const totalTextHeight = (numLines -1) * lineHeight; 
        // Shift the entire block up by half its height 
        // (relative to the original single-line 'y' position)
        const verticalShift = - (totalTextHeight / 2); 
        
        // Apply the shift to the first tspan, others are relative to it
         tspans.attr('dy', function(d, i) {
             // For the first line (i=0), apply base shift + its own dy
             // For subsequent lines, add the line height increment
             return (i === 0 ? verticalShift : (i * lineHeight) + verticalShift) + 'em';
         });
    }
  });
}

// --- Detail View Rendering ---

/**
 * Renders or updates the detailed view for a specific stage, showing all stages
 * and animating transitions.
 * @param {d3.Selection} container - The main SVG group container (persistent).
 * @param {object} diagramData - The full data object {stages, stageNodes, stageLinks}.
 * @param {string} activeStageId - The ID of the stage to center.
 * @param {number} width - The width of the SVG canvas.
 * @param {number} height - The height of the SVG canvas.
 * @param {boolean} isInitialRender - Flag to skip transition on first load.
 */
function renderDetailView(container, diagramData, activeStageId, width, height, isInitialRender = false) {
    console.log(`--- renderDetailView Called --- Active: ${activeStageId}, Initial: ${isInitialRender}`);
    const { stages, stageNodes, stageLinks } = diagramData;

    // --- Detail View Layout Constants ---
    const nodeWidth = 100;
    const nodeHeight = 50;
    const nodeMargin = { x: 40, y: 30 };
    const detailPadding = { top: 80, right: 60, bottom: 60, left: 60 };
    const stageBlockMargin = 50;
    const detailTitleFontSize = '16px';
    const transitionDuration = isInitialRender ? 0 : 500; // No transition on first load

    // --- Pre-calculate Layouts, Dimensions, Max Height, Y Position ---
    const allLayouts = {}; // Keep this local to renderDetailView
    const allContainerDims = {};
    stages.forEach(stage => {
        const nodes = stageNodes[stage.id] || [];
        allLayouts[stage.id] = calculateNodeLayout(
            nodes,
            stage.id,
            nodeWidth,
            nodeHeight,
            nodeMargin,
            stageLinks // Pass the stageLinks object
        );
        allContainerDims[stage.id] = {
            width: allLayouts[stage.id].totalWidth + detailPadding.left + detailPadding.right,
            height: allLayouts[stage.id].totalHeight + detailPadding.top + detailPadding.bottom
        };
        if (stage.id === 'PR') {
            console.log(`Calculated dimensions for PR:`, allContainerDims[stage.id]);
        }
    });
    // Removed maxHeight calculation - height is now based on individual content

    // --- Calculate Y Position (Center Vertically) ---
    // We still need a reference height. Let's use the active stage's height.
    const activeStageHeight = allContainerDims[activeStageId]?.height || height; // Fallback to container height
    const nodesStartY = Math.max(0, (height - activeStageHeight) / 2);

    // --- Calculate X Positions (Centering the Active Stage) ---
    const activeIndex = stages.findIndex(s => s.id === activeStageId);
    const allXPositions = {};
    let currentX = (width - allContainerDims[activeStageId].width) / 2; 
    allXPositions[activeStageId] = currentX;
    let leftX = currentX;
    for (let i = activeIndex - 1; i >= 0; i--) {
        const stageId = stages[i].id;
        leftX -= (allContainerDims[stageId].width + stageBlockMargin);
        allXPositions[stageId] = leftX;
    }
    let rightX = currentX;
    for (let i = activeIndex + 1; i < stages.length; i++) {
        const stageId = stages[i].id;
        rightX += (allContainerDims[stages[i-1].id].width + stageBlockMargin); 
        allXPositions[stageId] = rightX;
    }
    console.log("Calculated X Positions:", allXPositions);


    // --- D3 Data Join for Stage Blocks ---
    const t = container.transition().duration(transitionDuration);

    const blocks = container.selectAll('.detail-block')
        .data(stages, d => d.id)
        .join(
            enter => enter.append('g')
                .attr('class', 'detail-block')
                .attr('transform', d => {
                    const initialX = allXPositions[d.id] ?? 0; // Use calculated initial X
                    // *** Log initial transform ***
                    // console.log(`Initial transform for ${d.id}: translate(${initialX}, ${nodesStartY})`);
                    return `translate(${initialX}, ${nodesStartY})`;
                })
                .style('cursor', d => d.id === activeStageId ? 'default' : 'pointer')
                .style('opacity', 0) // Start transparent for fade-in
                // *** Call renderStaticStageContent with necessary arguments ***
                .each(function(d) {
                    renderStaticStageContent.call(
                        this, // Set 'this' context
                        d,    // Stage data (e.g., {id: 'DC', label: '...'})
                        allLayouts[d.id], // Pass the calculated layout
                        stageLinks,       // Pass the stageLinks object
                        nodeWidth,        // Pass nodeWidth
                        nodeHeight        // Pass nodeHeight
                    );
                })
                .on('click', (event, d) => {
                    if (d.id !== activeStageId) {
                        console.log(`Detail block clicked: ${d.id}`);
                        // Re-render with the clicked stage as active
                        renderDetailView(container, diagramData, d.id, width, height, false);
                    }
                })
                .call(enter => enter.transition(t).style('opacity', 1)), // Fade in

            update => update
                .call(update => update.transition(t) // Apply transition to updates
                    .attr('transform', d => {
                        const targetX = allXPositions[d.id] ?? 0;
                        if (d.id === 'PR') {
                             console.log(`Applying transform to PR block: targetX=${targetX}, activeStageId=${activeStageId}`);
                        }
                        return `translate(${targetX}, ${nodesStartY})`;
                    })
                    .style('cursor', d => d.id === activeStageId ? 'default' : 'pointer')
                    .style('opacity', 1) // Ensure opacity is 1 after transition
                ),

            exit => exit
                .call(exit => exit.transition(t) // Apply transition to exits
                    .style('opacity', 0) // Fade out
                    .remove()
                )
        );

    // --- Render Background Rect AFTER static content is potentially added ---
    // Select existing or append new background rect
    blocks.each(function(d) {
        const blockGroup = d3.select(this);
        let bgRect = blockGroup.select('.detail-container-bg');
        if (bgRect.empty()) {
            bgRect = blockGroup.insert('rect', ':first-child') // Insert behind other content
                .attr('class', 'detail-container-bg')
                .attr('rx', 10)
                .attr('ry', 10);
        }

        // Update dimensions and style
        bgRect
            .attr('width', allContainerDims[d.id]?.width || 0)
            .attr('height', allContainerDims[d.id]?.height || 0)
            .style('fill', d.id === activeStageId ? '#ffffff' : '#f0f0f0') // White active, grey inactive
            .style('stroke', d.id === activeStageId ? '#184e77' : '#cccccc') // Darker border active
            .style('stroke-width', d.id === activeStageId ? 1.5 : 1);

        // Apply transition *only* to fill and stroke for existing elements
        if (!bgRect.enter().empty()) { // Check if it's not a newly entered element
             bgRect.transition(t)
                .style('fill', d.id === activeStageId ? '#ffffff' : '#f0f0f0')
                .style('stroke', d.id === activeStageId ? '#184e77' : '#cccccc')
                .style('stroke-width', d.id === activeStageId ? 1.5 : 1);
        }
    });


    // --- Render Detail Titles ---
    const titles = container.selectAll('.detail-title')
        .data(stages, d => d.id);

    titles.join(
        enter => enter.append('text')
            .attr('class', 'detail-title')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-family', 'var(--title-font, sans-serif)')
            .attr('font-size', detailTitleFontSize)
            .attr('font-weight', 'bold')
            .attr('x', d => allXPositions[d.id] + allContainerDims[d.id].width / 2)
            .attr('y', nodesStartY + detailPadding.top / 2)
            .attr('fill', d => d.id === activeStageId ? '#184e77' : '#555')
            .text(d => d.label)
            .style('opacity', 0)
            .call(enter => enter.transition(t).style('opacity', 1)), 

        update => update, 

        exit => exit.transition(t).style('opacity', 0).remove() 
    )
    .call(selection => {
        selection.transition(t) 
            .attr('x', d => allXPositions[d.id] + allContainerDims[d.id].width / 2)
            .attr('y', nodesStartY + detailPadding.top / 2)
            .attr('fill', d => d.id === activeStageId ? '#184e77' : '#555');
    });


    console.log("--- renderDetailView Update/Render Complete ---");
}

/**
 * Renders the static content (nodes, links, arrows) for a single detail stage block.
 * Called by renderDetailView for entering blocks.
 * Made more robust against missing node coordinates.
 * Accepts necessary data as arguments.
 */
function renderStaticStageContent(stageData, layout, stageLinksForRender, nodeWidth, nodeHeight) {
    const blockGroup = d3.select(this); // The <g class="detail-block"> element
    blockGroup.html(''); // Clear previous static content if any (safer)

    // Retrieve layout data passed as argument
    if (!layout) {
        console.error(`Layout data missing for stage ${stageData.id}`);
        return;
    }
    const layoutNodes = layout.nodes || []; // Nodes with calculated positions

    // --- Define Arrowhead Marker ---
    // Find the parent SVG element using the DOM node
    // *** FIX: Get the node first, then use closest, then wrap back in d3 if needed ***
    const svgNode = blockGroup.node().closest('svg');
    if (!svgNode) {
        console.error("Could not find parent SVG element for stage", stageData.id);
        return; // Cannot proceed without SVG
    }
    const svgSelection = d3.select(svgNode); // Wrap the found SVG node in a D3 selection

    // Check if arrowhead marker already exists in this SVG
    if (svgSelection.select('defs #arrowhead').empty()) {
         // Append defs if it doesn't exist
         let defs = svgSelection.select('defs');
         if (defs.empty()) {
             defs = svgSelection.append('defs');
         }
         // Append the marker definition
         defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 8) // Offset arrowhead slightly from end of line
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#666') // Arrowhead color
            .style('stroke', 'none');
    }


    // --- Render Nodes ---
    const nodeGroup = blockGroup.append('g').attr('class', 'detail-nodes');
    nodeGroup.selectAll('.detail-node')
        .data(layoutNodes, d => d.id) // Use nodes from layout result
        .join(
            enter => {
                const g = enter.append('g')
                    .attr('class', 'detail-node')
                    // Use layout coordinates, fallback to 0,0 if null/undefined
                    .attr('transform', d => `translate(${d.x ?? 0}, ${d.y ?? 0})`);

                g.append('rect')
                    .attr('width', nodeWidth)
                    .attr('height', nodeHeight)
                    .attr('rx', 5)
                    .attr('ry', 5)
                    .attr('fill', '#e9f5db') // Node background
                    .attr('stroke', '#aaccbb'); // Node border

                g.append('text')
                    .attr('x', nodeWidth / 2)
                    .attr('y', nodeHeight / 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'central')
                    .attr('font-family', 'var(--body-font, sans-serif)')
                    .attr('font-size', '11px')
                    .attr('fill', '#333')
                    .text(d => d.label) // Access label directly (should be present from layout mapping)
                    .call(wrapText, nodeWidth - 15);

                return g;
            },
            update => update,
            exit => exit.remove()
        );


    // --- Render Links ---
    const links = stageLinksForRender[stageData.id] || []; // Use passed links object
    const linkGroup = blockGroup.append('g').attr('class', 'detail-links');

    // Create a map of layout nodes for efficient lookup by ID
    const layoutNodeMap = new Map(layoutNodes.map(n => [n.id, n]));

    linkGroup.selectAll('.detail-link')
        .data(links)
        .enter()
        .append('line')
        .attr('class', 'detail-link')
        .each(function(d) { // Use .each for robust coordinate setting
            const sourceNode = layoutNodeMap.get(d.source);
            const targetNode = layoutNodeMap.get(d.target);

            // *** CRITICAL CHECK ***
            // Ensure both nodes exist in the layout map AND have valid coordinates
            if (sourceNode && targetNode &&
                sourceNode.x != null && sourceNode.y != null &&
                targetNode.x != null && targetNode.y != null)
            {
                d3.select(this)
                    .attr('x1', sourceNode.x + nodeWidth / 2)
                    .attr('y1', sourceNode.y + nodeHeight) // Link from bottom-center
                    .attr('x2', targetNode.x + nodeWidth / 2)
                    .attr('y2', targetNode.y) // Link to top-center
                    .attr('stroke', '#666')
                    .attr('stroke-width', 1.5)
                    .attr('marker-end', 'url(#arrowhead)'); // Apply arrowhead
            } else {
                // Log a warning if a link cannot be drawn
                console.warn(`Could not draw link in stage ${stageData.id}: ${d.source} -> ${d.target}. Missing node or coordinates. Source found:`, !!sourceNode, "Coords:", sourceNode?.x, sourceNode?.y, "Target found:", !!targetNode, "Coords:", targetNode?.x, targetNode?.y);
                // Remove the invalid line element
                d3.select(this).remove();
            }
        });
}

/**
 * Calculates node positions using d3-dag (Sugiyama layout).
 * Returns layout info including nodes with coordinates and overall dimensions.
 * CORRECTED to use d3dag prefix for d3-dag functions.
 * Added check for d3dag library presence.
 */
function calculateNodeLayout(nodes, stageId, nodeWidth, nodeHeight, nodePadding, stageLinksForLayout) {
    // --- Check if d3-dag library is loaded ---
    if (typeof d3dag === 'undefined') {
        console.error("d3-dag library (d3dag) not found. Please ensure it's included in your HTML.");
        // Return a basic fallback layout
        const fallbackNodes = nodes.map((node, i) => ({
            ...node, id: node.id, data: node,
            x: i * (nodeWidth + nodePadding.x), y: 0,
            width: nodeWidth, height: nodeHeight
        }));
        return {
            nodes: fallbackNodes,
            links: [],
            totalWidth: nodes.length * nodeWidth + Math.max(0, nodes.length - 1) * nodePadding.x,
            totalHeight: nodeHeight
        };
    }
    // --- End Check ---


    const nodesForLayout = nodes.map(n => n.id);
    const linksForLayout = (stageLinksForLayout[stageId] || []).map(l => [l.source, l.target]);

    let dag = null;
    try {
        // *** FIX: Use d3dag.dagConnect ***
        dag = d3dag.dagConnect()(nodesForLayout.map(id => [id, id]).concat(linksForLayout));

        if (!dag) {
            throw new Error("d3dag.dagConnect returned null or undefined.");
        }
        if (dag.size() === 0 && nodes.length > 0) {
             console.warn(`DAG created for stage ${stageId} is empty despite having nodes.`);
        }
    } catch (error) {
        console.error(`DAG creation failed for stage ${stageId}:`, error);
        dag = null;
    }

    // Initialize layoutNodes with fallback positions
    let layoutNodes = nodes.map((node, i) => ({
        ...node, id: node.id, data: node,
        x: i * (nodeWidth + nodePadding.x), y: 0,
        width: nodeWidth, height: nodeHeight
    }));
    let totalWidth = nodes.length * nodeWidth + Math.max(0, nodes.length - 1) * nodePadding.x;
    let totalHeight = nodeHeight;
    let layoutLinks = [];

    // Apply Sugiyama layout if DAG is valid
    if (dag && dag.size() > 0) {
         // *** FIX: Use d3dag.sugiyama and its methods ***
         const layout = d3dag.sugiyama()
            .nodeSize([nodeWidth + nodePadding.x, nodeHeight + nodePadding.y])
            .layering(d3dag.layeringSimplex()) // Use d3dag prefix
            .decross(d3dag.decrossTwoLayer()) // Use d3dag prefix
            .coord(d3dag.coordVert());       // Use d3dag prefix

        try {
            layout(dag); // Apply layout

            // --- Debug Logging (Keep for now) ---
            if (stageId === 'DC') {
                console.log(`--- Raw Sugiyama Output for ${stageId} (using d3dag) ---`);
                dag.each(node => {
                    console.log(`Node: ${node.data}, Raw X: ${node.x}, Raw Y: ${node.y}`);
                });
                console.log(`------------------------------------------------------`);
            }
            // --- End Debug Logging ---

            // Extract node and link positions
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            layoutNodes = nodes.map(originalNode => {
                const dagNode = dag.descendants().find(d => d.data === originalNode.id);
                if (dagNode && dagNode.x != null && dagNode.y != null) {
                    minX = Math.min(minX, dagNode.x);
                    maxX = Math.max(maxX, dagNode.x);
                    minY = Math.min(minY, dagNode.y);
                    maxY = Math.max(maxY, dagNode.y);
                    return { ...originalNode, id: originalNode.id, data: originalNode, x: dagNode.x, y: dagNode.y, width: nodeWidth, height: nodeHeight };
                } else {
                    const fallbackNode = layoutNodes.find(n => n.id === originalNode.id);
                    return fallbackNode || { ...originalNode, id: originalNode.id, data: originalNode, x: 0, y: 0, width: nodeWidth, height: nodeHeight };
                }
            });

            // Normalize coordinates
            if (isFinite(minX) && isFinite(minY)) {
                layoutNodes.forEach(node => { node.x -= minX; node.y -= minY; });
                totalWidth = (maxX - minX) + nodeWidth;
                totalHeight = (maxY - minY) + nodeHeight;
            } else {
                 console.warn(`Layout for stage ${stageId} produced invalid coordinate ranges. Using fallback dimensions.`);
            }

            // Extract link points
            layoutLinks = dag.links().map(link => {
                const sourceNode = layoutNodes.find(n => n.id === link.source.data);
                const targetNode = layoutNodes.find(n => n.id === link.target.data);
                if (sourceNode && targetNode) {
                    return { source: sourceNode, target: targetNode, points: link.points };
                }
                return null;
            }).filter(link => link !== null);

        } catch (error) {
            console.error(`Sugiyama layout failed for stage ${stageId}:`, error);
            layoutLinks = []; // Keep fallback layoutNodes
        }
    } else if (nodes.length > 0) {
         console.warn(`Using fallback layout for stage ${stageId} due to DAG issues or empty DAG.`);
         layoutLinks = []; // Keep fallback layoutNodes
    } else {
        totalWidth = 0; totalHeight = 0; layoutNodes = []; layoutLinks = [];
    }

    // Ensure dimensions are valid numbers
    totalWidth = isFinite(totalWidth) ? Math.max(nodeWidth, totalWidth) : (nodes.length > 0 ? nodeWidth : 0);
    totalHeight = isFinite(totalHeight) ? Math.max(nodeHeight, totalHeight) : (nodes.length > 0 ? nodeHeight : 0);

    return { nodes: layoutNodes, links: layoutLinks, totalWidth: totalWidth, totalHeight: totalHeight };
}

/**
 * Initializes the process diagram by loading and displaying ONLY the detailed SVG,
 * scaled to fit the container height.
 */
function initProcessDiagramSVG() {
    // Define the container ID and the path to the detailed SVG
    const detailContainerId = 'process-detail-svg-container';
    const detailedSvgPath = 'flowcharts/detailed-01-01.svg';

    // Select the container element using D3
    const detailContainer = d3.select(`#${detailContainerId}`);

    // Check if the container element exists in the HTML
    if (detailContainer.empty()) {
        console.error(`Process diagram container #${detailContainerId} not found.`);
        return;
    }

    // Load the detailed SVG file using D3's XML loader
    d3.xml(detailedSvgPath)
        .then(detailXml => {
            console.log('Detailed SVG loaded successfully.');

            // Get the root <svg> element from the loaded XML
            const detailSvgNode = detailXml.documentElement;
            detailContainer.html('');
            detailContainer.node().appendChild(detailSvgNode);

            // Select the newly added SVG element using D3
            const detailSelection = d3.select(detailSvgNode);

            // Style the SVG
            detailSelection
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('preserveAspectRatio', 'xMinYMid slice'); // Changed to xMin to align left

            // Update the style element in the SVG to include our font definitions
            let styleElement = detailSelection.select('style');
            const currentStyle = styleElement.text();
            styleElement.text(currentStyle + `
                .st2 { font-family: 'Lato', sans-serif !important; }
                .st1 { fill: #495057 !important; }
            `);

            // Create wrapper for content
            const existingContent = detailSelection.node().innerHTML;
            detailSelection.node().innerHTML = '';
            
            const contentWrapper = detailSelection
                .append('g')
                .attr('class', 'drag-wrapper')
                .html(existingContent);

            // Position at left edge
            const initialX = 0;
            contentWrapper.attr('transform', `translate(${initialX},0)`);
            
            // Track the current position
            let currentX = initialX;

            // Create drag behavior with a very simple implementation
            const drag = d3.drag()
                .on('start', function(event) {
                    // Store starting position
                    d3.select(this).attr('cursor', 'grabbing');
                })
                .on('drag', function(event) {
                    // Simple drag that just adds the delta X
                    currentX += event.dx;
                    
                    // Allow movement right but not left of initial position
                    currentX = Math.min(currentX, 0);
                    
                    d3.select(this).attr('transform', `translate(${currentX},0)`);
                })
                .on('end', function(event) {
                    // Reset cursor
                    d3.select(this).attr('cursor', 'grab');
                });

            // Apply drag behavior
            contentWrapper
                .style('cursor', 'grab')
                .call(drag);

            // Ensure container is visible
            detailContainer.classed('hidden', false);
            detailContainer.style('display', null);
        })
        .catch(error => {
            console.error('Error loading detailed SVG file:', error);
            detailContainer.html('<p>Error loading detail diagram. Please check the file path and network connection.</p>');
        });
}

// Make sure this function is called when the page loads, e.g.:
// document.addEventListener('DOMContentLoaded', initProcessDiagramSVG);
// or if using jQuery:
// $(document).ready(initProcessDiagramSVG); 