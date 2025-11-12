/*
 * Clock Mode Module
 * Author: Studio Video
 *
 * Features:
 * - Real-time clock display in HH:MM:SS format
 * - Smooth digit transitions with physics
 * - Fullscreen mode with no UI controls
 * - Modular and independent from main.js
 */

const ClockMode = {
    enabled: false,
    currentTime: '',
    digitPositions: [], // Array of {x, y} positions for 8 digits
    digitMeshes: {}, // Map of position index to letter object
    intervalId: null,
    colonMeshes: [], // Static colon meshes

    // Clock-specific settings
    clockFontSize: 15, // Separate font size for clock digits (independent from global font size)

    // Settings for old/flying digits
    oldDigitSettings: {
        bounciness: 0, // How bouncy old digits are (0-1)
        pushForce: 0.07, // How hard old digits are pushed away
        gravity: 0, // Base gravity for old digits (will be modulated by sway)
        gravitySway: 0.1, // Amplitude of gravity oscillation (0 = no sway, higher = more sway)
        gravitySwaySpeed: 1.0, // Speed of gravity oscillation (cycles per second)
        collisionStrength: 0, // How strongly old digits collide with each other
        opacity: 0.9, // Opacity for old digits (0-1)
        scaleStart: 1.0, // Starting scale (1.0 = same size as current digits)
        scaleEnd: 0, // Ending scale (0 = vanish completely)
        scaleShrinkSpeed: 0.2 // How fast digits shrink (units per second, 0.2 = takes 5 seconds to shrink from 1 to 0)
    }
};

// ========== INITIALIZE CLOCK MODE ==========
function initClockMode() {
    if (ClockMode.enabled) return;

    console.log('🕐 Entering Clock Mode');
    ClockMode.enabled = true;

    // Clear all existing letters
    clearAllLetters();

    // Enable custom bounding box if not already enabled
    // User can adjust width/height in Debug UI to control clock spacing
    if (!InflatableText.settings.useBoundingBoxSize) {
        InflatableText.settings.useBoundingBoxSize = true;
        InflatableText.settings.boundingBoxWidth = 200;
        InflatableText.settings.boundingBoxHeight = 40;
        updateCanvasBounds();
    }

    // Calculate digit positions
    calculateDigitPositions();

    // Get initial time and spawn all digits
    const now = new Date();
    ClockMode.currentTime = formatTime(now);
    spawnInitialDigits();

    // Start clock interval (update every second)
    ClockMode.intervalId = setInterval(updateClockTime, 1000);

    console.log('✅ Clock Mode active');
}

// ========== STOP CLOCK MODE ==========
function stopClockMode() {
    if (!ClockMode.enabled) return;

    console.log('🕐 Exiting Clock Mode');
    ClockMode.enabled = false;

    // Stop interval
    if (ClockMode.intervalId) {
        clearInterval(ClockMode.intervalId);
        ClockMode.intervalId = null;
    }

    // Clear all clock digits and colons
    clearAllLetters();
    ClockMode.digitMeshes = {};
    ClockMode.colonMeshes.forEach(colonObj => {
        if (colonObj.mesh) {
            InflatableText.scene.remove(colonObj.mesh);
            colonObj.mesh.geometry.dispose();
            colonObj.mesh.material.dispose();
        }
    });
    ClockMode.colonMeshes = [];

    // Restore normal bounding box settings
    InflatableText.settings.useBoundingBoxSize = false;
    updateCanvasBounds();

    console.log('✅ Clock Mode exited');
}

// ========== FORMAT TIME ==========
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// ========== CALCULATE DIGIT POSITIONS ==========
function calculateDigitPositions() {
    // Clock format: HH:MM:SS (8 characters total, including 2 colons)
    // We need positions for: [H][H][:][M][M][:][S][S]
    // Digit indices: 0, 1, 3, 4, 6, 7 (skip colons at 2 and 5)

    const bounds = InflatableText.canvasBounds;
    const boxWidth = bounds.maxX - bounds.minX;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Use letter spacing setting to control digit spacing
    // Use clock-specific font size instead of global font size
    let charSpacing;
    if (InflatableText.settings.autoSpacing) {
        // Automatic spacing based on clock font size
        charSpacing = ClockMode.clockFontSize * 1.2;
    } else {
        // Manual spacing - use letter spacing multiplier with clock font size
        const baseSpacing = ClockMode.clockFontSize * 1.2;
        charSpacing = baseSpacing * InflatableText.settings.letterSpacing;
    }

    // Calculate total width needed for all characters
    const totalChars = 8;
    const totalWidth = (totalChars - 1) * charSpacing; // -1 because spacing is between chars
    const startX = -(totalWidth / 2); // Center the clock

    ClockMode.digitPositions = [];
    for (let i = 0; i < totalChars; i++) {
        ClockMode.digitPositions.push({
            x: startX + i * charSpacing,
            y: centerY,
            isColon: (i === 2 || i === 5) // Mark colon positions
        });
    }

    console.log('📐 Digit positions calculated:', ClockMode.digitPositions);
    console.log('   Spacing mode:', InflatableText.settings.autoSpacing ? 'Automatic' : 'Manual');
    console.log('   Character spacing:', charSpacing.toFixed(2));
}

// ========== SPAWN INITIAL DIGITS ==========
function spawnInitialDigits() {
    const timeStr = ClockMode.currentTime; // Format: "HH:MM:SS"

    for (let i = 0; i < timeStr.length; i++) {
        const char = timeStr[i];
        const position = ClockMode.digitPositions[i];

        if (position.isColon) {
            // Spawn colon (static, no updates)
            spawnColon(i, position);
        } else {
            // Spawn digit
            spawnDigitAt(char, i, position);
        }
    }

    console.log('🕐 Initial time spawned:', timeStr);
}

// ========== SPAWN DIGIT AT POSITION ==========
function spawnDigitAt(char, positionIndex, position) {
    // Temporarily override global font size with clock font size
    const originalFontSize = InflatableText.settings.fontSize;
    InflatableText.settings.fontSize = ClockMode.clockFontSize;

    // Use global createLetterMesh function from main.js
    const gridPosition = { x: position.x, y: position.y };
    const letterObj = createLetterMesh(char, positionIndex, gridPosition);

    // Restore original font size
    InflatableText.settings.fontSize = originalFontSize;

    if (letterObj) {
        // Mark as static clock digit (won't be affected by physics)
        letterObj.isClockDigit = true;
        letterObj.isStatic = true; // Completely frozen in place

        ClockMode.digitMeshes[positionIndex] = letterObj;

        // Also add to global letter meshes for animation updates
        if (!InflatableText.letterMeshes.includes(letterObj)) {
            InflatableText.letterMeshes.push(letterObj);
        }
    }
}

// ========== SPAWN COLON (STATIC) ==========
function spawnColon(positionIndex, position) {
    // Temporarily override global font size with clock font size
    const originalFontSize = InflatableText.settings.fontSize;
    InflatableText.settings.fontSize = ClockMode.clockFontSize;

    const gridPosition = { x: position.x, y: position.y };
    const colonObj = createLetterMesh(':', positionIndex, gridPosition);

    // Restore original font size
    InflatableText.settings.fontSize = originalFontSize;

    if (colonObj) {
        ClockMode.colonMeshes.push(colonObj);

        // Add to global letter meshes for rendering
        if (!InflatableText.letterMeshes.includes(colonObj)) {
            InflatableText.letterMeshes.push(colonObj);
        }
    }
}

// ========== UPDATE CLOCK TIME ==========
function updateClockTime() {
    if (!ClockMode.enabled) return;

    const now = new Date();
    const newTime = formatTime(now);

    // Compare with current time and find changed digits
    for (let i = 0; i < newTime.length; i++) {
        if (i === 2 || i === 5) continue; // Skip colons

        const newChar = newTime[i];
        const oldChar = ClockMode.currentTime[i];

        if (newChar !== oldChar) {
            // Digit changed - transition it
            transitionDigit(i, newChar);
            console.log(`🔄 Digit ${i} changed: ${oldChar} → ${newChar}`);
        }
    }

    ClockMode.currentTime = newTime;
}

// ========== TRANSITION DIGIT ==========
function transitionDigit(positionIndex, newChar) {
    const position = ClockMode.digitPositions[positionIndex];
    const oldLetterObj = ClockMode.digitMeshes[positionIndex];

    // Give old digit a push (physics will make it fall/bounce away)
    if (oldLetterObj) {
        // Mark as flying digit (no longer static, affected by special physics)
        oldLetterObj.isStatic = false;
        oldLetterObj.isClockDigit = false;
        oldLetterObj.isFlyingDigit = true;
        oldLetterObj.birthTime = Date.now(); // Track when this digit started flying

        // Apply push force with settings
        const pushForce = ClockMode.oldDigitSettings.pushForce;
        oldLetterObj.velocity.y = pushForce * (0.5 + Math.random() * 0.5); // Upward push
        oldLetterObj.velocity.x = (Math.random() - 0.5) * pushForce * 0.5; // Horizontal drift

        // Apply initial opacity and scale to old digit
        if (oldLetterObj.mesh) {
            if (oldLetterObj.mesh.material) {
                oldLetterObj.mesh.material.opacity = ClockMode.oldDigitSettings.opacity;
                oldLetterObj.mesh.material.transparent = true;
            }

            // Apply starting scale
            const scale = ClockMode.oldDigitSettings.scaleStart;
            oldLetterObj.mesh.scale.set(scale, scale, scale);
        }

        // Remove from digit tracking (but keep in global letterMeshes for physics)
        delete ClockMode.digitMeshes[positionIndex];

        console.log(`💨 Pushed old digit "${oldLetterObj.char}" away with force ${pushForce}`);
    }

    // Spawn new digit at the same position
    spawnDigitAt(newChar, positionIndex, position);
    console.log(`✨ Spawned new digit "${newChar}" at position ${positionIndex}`);
}

// ========== UPDATE DIGIT POSITIONS (for live spacing adjustment) ==========
function updateDigitPositions() {
    if (!ClockMode.enabled) return;

    // Recalculate positions with new spacing
    calculateDigitPositions();

    // Update all existing digit meshes to new positions
    Object.keys(ClockMode.digitMeshes).forEach(posIndex => {
        const letterObj = ClockMode.digitMeshes[posIndex];
        const newPosition = ClockMode.digitPositions[posIndex];

        if (letterObj && letterObj.mesh && newPosition) {
            letterObj.position.x = newPosition.x;
            letterObj.position.y = newPosition.y;
            letterObj.mesh.position.x = newPosition.x;
            letterObj.mesh.position.y = newPosition.y;
        }
    });

    // Update colon positions too
    ClockMode.colonMeshes.forEach((colonObj, index) => {
        // Colons are at positions 2 and 5
        const colonIndex = index === 0 ? 2 : 5;
        const newPosition = ClockMode.digitPositions[colonIndex];

        if (colonObj && colonObj.mesh && newPosition) {
            colonObj.position.x = newPosition.x;
            colonObj.position.y = newPosition.y;
            colonObj.mesh.position.x = newPosition.x;
            colonObj.mesh.position.y = newPosition.y;
        }
    });

    console.log('🔄 Updated digit positions in real-time');
}

// ========== EXPORT FUNCTIONS ==========
window.ClockMode = {
    init: initClockMode,
    stop: stopClockMode,
    isActive: () => ClockMode.enabled,
    updatePositions: updateDigitPositions, // For live spacing adjustments
    oldDigitSettings: ClockMode.oldDigitSettings, // Expose settings for physics
    get clockFontSize() { return ClockMode.clockFontSize; }, // Get clock font size
    set clockFontSize(value) { ClockMode.clockFontSize = value; } // Set clock font size
};
