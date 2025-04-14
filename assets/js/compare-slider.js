/**
 * compare-slider.js
 * A simple before/after image comparison slider
 * For comparing satellite imagery of building damage
 */

document.addEventListener('DOMContentLoaded', function() {
    initCompareSliders();
    
    // TEMPORARY: Automatically animate all sliders
    // REMOVE THIS FUNCTION CALL WHEN ANIMATION IS NO LONGER NEEDED
    // autoAnimateSliders();
});

/**
 * TEMPORARY FUNCTION - Auto-animate all comparison sliders
 * This function makes sliders move side to side automatically for demonstration purposes
 * Can be safely removed when no longer needed
 */
function autoAnimateSliders() {
    const sliders = document.querySelectorAll('.compare-container');
    if (sliders.length === 0) return;
    
    console.log('Starting automatic slider animations');
    
    // Animation parameters
    const animationDuration = 3000; // 3 seconds for a full cycle
    const minPosition = 10;  // Don't go all the way to the edge
    const maxPosition = 90;  // Don't go all the way to the edge
    
    // Animate each slider
    sliders.forEach(container => {
        let direction = 1; // 1 = right, -1 = left
        let currentPosition = 50; // Start in the middle
        
        // Create animation interval
        const animationInterval = setInterval(() => {
            // Update position based on direction
            currentPosition += direction * 1; // Move 1% each step
            
            // Reverse direction if we hit a boundary
            if (currentPosition >= maxPosition) {
                direction = -1;
                currentPosition = maxPosition;
            } else if (currentPosition <= minPosition) {
                direction = 1;
                currentPosition = minPosition;
            }
            
            // Update slider position
            updateSliderPosition(container, currentPosition);
        }, 30); // Update every 30ms for smooth movement
        
        // Store the interval ID on the container element for later cleanup if needed
        container._animationInterval = animationInterval;
    });
    
    // OPTIONAL: Uncomment this to automatically stop animation after 30 seconds
    // setTimeout(() => {
    //     console.log('Stopping automatic slider animations');
    //     sliders.forEach(container => {
    //         if (container._animationInterval) {
    //             clearInterval(container._animationInterval);
    //             container._animationInterval = null;
    //         }
    //     });
    // }, 30000);
}

/**
 * Initialize all image comparison sliders on the page
 */
function initCompareSliders() {
    // Find all slider containers
    const sliders = document.querySelectorAll('.compare-container');
    
    if (sliders.length === 0) {
        console.log('No comparison sliders found on page');
        return;
    }
    
    console.log(`Initializing ${sliders.length} comparison slider(s)`);
    
    // Initialize each slider
    sliders.forEach(slider => {
        setupCompareSlider(slider);
    });
}

/**
 * Set up a single comparison slider
 * @param {HTMLElement} container - The slider container element
 */
function setupCompareSlider(container) {
    // Get elements
    const slider = container.querySelector('.compare-slider');
    const beforeImage = container.querySelector('.before-image');
    const afterImage = container.querySelector('.after-image');
    const sliderHandle = container.querySelector('.slider-handle');
    
    if (!slider || !beforeImage || !afterImage) {
        console.error('Missing required elements for compare slider');
        return;
    }
    
    // Set initial position (50%)
    const initialPosition = 50;
    updateSliderPosition(container, initialPosition);
    
    // Handle mouse/touch events
    let isDragging = false;
    
    // Mouse events
    slider.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
    
    // Touch events for mobile
    slider.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('touchmove', drag, { passive: true });
    window.addEventListener('touchend', endDrag);
    
    // Handle click anywhere on the container
    container.addEventListener('click', function(e) {
        // Don't handle clicks during drag operations
        if (isDragging) return;
        
        // Calculate click position relative to container width
        const rect = container.getBoundingClientRect();
        const position = ((e.clientX - rect.left) / rect.width) * 100;
        
        // Update slider position
        updateSliderPosition(container, position);
    });
    
    function startDrag(e) {
        e.preventDefault();
        isDragging = true;
        
        // Add a class to indicate dragging state
        container.classList.add('is-dragging');
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        // Get cursor/touch position
        let clientX;
        if (e.type === 'touchmove') {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }
        
        // Calculate position
        const rect = container.getBoundingClientRect();
        let position = ((clientX - rect.left) / rect.width) * 100;
        
        // Constrain position between 0 and 100
        position = Math.max(0, Math.min(100, position));
        
        // Update slider position
        updateSliderPosition(container, position);
    }
    
    function endDrag() {
        isDragging = false;
        container.classList.remove('is-dragging');
    }
}

/**
 * Update the slider position and image clip
 * @param {HTMLElement} container - The slider container
 * @param {number} position - Position percentage (0-100)
 */
function updateSliderPosition(container, position) {
    const slider = container.querySelector('.compare-slider');
    const beforeImage = container.querySelector('.before-image');
    const handle = container.querySelector('.slider-handle');
    
    // Update slider position
    slider.style.left = `${position}%`;
    
    // Update handle position (if present)
    if (handle) {
        handle.style.left = `${position}%`;
    }
    
    // Update before image clip
    beforeImage.style.clipPath = `inset(0 ${100 - position}% 0 0)`;
    beforeImage.style.webkitClipPath = `inset(0 ${100 - position}% 0 0)`;
}

/**
 * Add a new comparison slider to the page
 * @param {string} containerId - The ID of the container to add the slider to
 * @param {string} beforeSrc - Path to the "before" image
 * @param {string} afterSrc - Path to the "after" image
 * @param {string} beforeLabel - Label for the "before" image
 * @param {string} afterLabel - Label for the "after" image
 */
function addComparisonSlider(containerId, beforeSrc, afterSrc, beforeLabel, afterLabel) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID "${containerId}" not found`);
        return;
    }
    
    // Create HTML for the slider
    const sliderHtml = `
        <div class="compare-container">
            <div class="compare-images">
                <img class="before-image" src="${beforeSrc}" alt="${beforeLabel}">
                <img class="after-image" src="${afterSrc}" alt="${afterLabel}">
            </div>
            <div class="compare-slider">
                <div class="slider-handle">
                    <div class="handle-line"></div>
                    <div class="handle-arrows">
                        <div class="arrow-left">◄</div>
                        <div class="arrow-right">►</div>
                    </div>
                </div>
            </div>
            <div class="compare-labels">
                <div class="before-label">${beforeLabel}</div>
                <div class="after-label">${afterLabel}</div>
            </div>
        </div>
    `;
    
    // Add the slider to the container
    container.innerHTML = sliderHtml;
    
    // Initialize the new slider
    setupCompareSlider(container.querySelector('.compare-container'));
} 