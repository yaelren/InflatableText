/*
 * Inflatable Text - UI Controls
 * Handles all user interface interactions and control panel setup
 */

// ========== TEXT WRAPPING FOR AUTO SPACING ==========
function wrapTextToFit(lines, boxWidth, boxHeight, letterWidth, letterHeight) {
    const wrappedLines = [];

    // Calculate max characters per line based on box width
    const maxCharsPerLine = Math.floor(boxWidth / letterWidth);

    if (maxCharsPerLine <= 0) {
        return { lines: lines, letterWidth: letterWidth, letterHeight: letterHeight }; // Can't fit any characters, return as-is
    }

    // Wrap each line
    lines.forEach(line => {
        if (line.length === 0) {
            wrappedLines.push('');
            return;
        }

        // Split line into chunks that fit
        const words = line.split(' ');
        let currentLine = '';

        words.forEach((word, wordIndex) => {
            // Try adding this word to current line
            const testLine = currentLine ? currentLine + ' ' + word : word;

            if (testLine.length <= maxCharsPerLine) {
                // Word fits on current line
                currentLine = testLine;
            } else {
                // Word doesn't fit
                if (currentLine) {
                    // Save current line and start new line with word
                    wrappedLines.push(currentLine);
                    currentLine = word;
                } else {
                    // Word itself is longer than max chars - force break it
                    if (word.length > maxCharsPerLine) {
                        // Break long word into chunks
                        for (let i = 0; i < word.length; i += maxCharsPerLine) {
                            wrappedLines.push(word.substring(i, i + maxCharsPerLine));
                        }
                        currentLine = '';
                    } else {
                        currentLine = word;
                    }
                }
            }

            // Add last word if it's the final word
            if (wordIndex === words.length - 1 && currentLine) {
                wrappedLines.push(currentLine);
            }
        });
    });

    // Now check if wrapped lines fit vertically, and adjust spacing if needed
    let adjustedLetterWidth = letterWidth;
    let adjustedLetterHeight = letterHeight;

    // Check if text fits vertically
    const totalHeight = wrappedLines.length * letterHeight;
    if (totalHeight > boxHeight) {
        // Need to shrink line spacing to fit
        adjustedLetterHeight = boxHeight / wrappedLines.length;
    }

    // Check if text fits horizontally (find longest line)
    const maxLineLength = Math.max(...wrappedLines.map(line => line.replace(/\s/g, '').length));
    const totalWidth = maxLineLength * letterWidth;
    if (totalWidth > boxWidth) {
        // Need to shrink letter spacing to fit
        adjustedLetterWidth = boxWidth / maxLineLength;
        // Also adjust letter height proportionally to maintain aspect ratio
        adjustedLetterHeight = adjustedLetterWidth * 1.25; // Maintain similar ratio

        // Re-check vertical fit with new letter height
        const newTotalHeight = wrappedLines.length * adjustedLetterHeight;
        if (newTotalHeight > boxHeight) {
            adjustedLetterHeight = boxHeight / wrappedLines.length;
        }
    }

    return { lines: wrappedLines, letterWidth: adjustedLetterWidth, letterHeight: adjustedLetterHeight };
}

// ========== UI CONTROLS ==========
function setupControls() {
    // Text input - creates new letter on each keystroke
    const textInput = document.getElementById('text-input');

    textInput.addEventListener('input', (e) => {
        const text = e.target.value.toUpperCase();

        // If typing animation is playing, don't update letters immediately
        if (InflatableText.settings.playTypingAnimation) {
            return;
        }

        // If empty, clear all
        if (!text) {
            InflatableText.letterMeshes.forEach(letterObj => {
                if (letterObj.mesh) {
                    InflatableText.scene.remove(letterObj.mesh);
                    letterObj.mesh.geometry.dispose();
                    letterObj.mesh.material.dispose();
                }
            });
            InflatableText.letterMeshes = [];
            return;
        }

        // Split text into lines
        let lines = text.split('\n');

        // Calculate grid layout parameters
        const bounds = InflatableText.canvasBounds;
        const boxWidth = bounds.maxX - bounds.minX;
        const boxHeight = bounds.maxY - bounds.minY;

        // Calculate letter spacing using settings
        let letterWidth, letterHeight;

        if (InflatableText.settings.autoSpacing) {
            // Automatic spacing based on font size
            letterWidth = InflatableText.settings.fontSize * 1.2; // 120% of font size
            letterHeight = InflatableText.settings.fontSize * 1.5; // 150% of font size for line height

            // Auto-wrap text if it doesn't fit in the bounding box
            const result = wrapTextToFit(lines, boxWidth, boxHeight, letterWidth, letterHeight);
            lines = result.lines;
            letterWidth = result.letterWidth;
            letterHeight = result.letterHeight;
        } else {
            // Manual spacing using sliders
            // Find the longest line for width calculation
            const maxLineLength = Math.max(...lines.map(line => line.length));
            if (maxLineLength === 0) return;

            letterWidth = (boxWidth / maxLineLength) * InflatableText.settings.letterSpacing;
            letterHeight = (boxHeight / lines.length) * InflatableText.settings.lineSpacing;
        }

        // Calculate total height of all lines and center vertically
        const totalTextHeight = lines.length * letterHeight;
        const verticalOffset = (boxHeight - totalTextHeight) / 2;

        // Build array of new letter data with positions
        const newLetters = [];
        lines.forEach((line, rowIndex) => {
            // Calculate centering offset for this line
            const lineLength = line.replace(/\s/g, '').length; // Count non-whitespace chars
            const lineWidth = lineLength * letterWidth;
            const centerOffset = (boxWidth - lineWidth) / 2;

            let charIndexInLine = 0;
            for (let colIndex = 0; colIndex < line.length; colIndex++) {
                const char = line[colIndex];

                if (char.trim()) {
                    let x, y;

                    if (InflatableText.settings.randomSpawn) {
                        // Random spawn position within bounds
                        const angle = Math.random() * Math.PI * 2;
                        const radius = InflatableText.settings.spawnRadius;
                        x = Math.cos(angle) * radius;
                        y = Math.sin(angle) * radius;
                    } else {
                        // Grid layout position
                        x = bounds.minX + centerOffset + charIndexInLine * letterWidth + letterWidth / 2;
                        y = bounds.maxY - verticalOffset - rowIndex * letterHeight - letterHeight / 2;
                    }

                    newLetters.push({ char, x, y });
                    charIndexInLine++;
                }
            }
        });

        // Update existing letters positions and remove excess
        if (newLetters.length < InflatableText.letterMeshes.length) {
            // Remove extra letters from the end
            const removeCount = InflatableText.letterMeshes.length - newLetters.length;
            for (let i = 0; i < removeCount; i++) {
                const letterObj = InflatableText.letterMeshes.pop();
                if (letterObj && letterObj.mesh) {
                    InflatableText.scene.remove(letterObj.mesh);
                    letterObj.mesh.geometry.dispose();
                    letterObj.mesh.material.dispose();
                }
            }
        }

        // Update existing letters or add new ones
        newLetters.forEach((newLetter, index) => {
            if (index < InflatableText.letterMeshes.length) {
                const letterObj = InflatableText.letterMeshes[index];

                // Only update position if NOT in random spawn mode AND position has significantly changed
                if (!InflatableText.settings.randomSpawn) {
                    const positionChanged =
                        Math.abs(letterObj.position.x - newLetter.x) > 0.1 ||
                        Math.abs(letterObj.position.y - newLetter.y) > 0.1;

                    if (positionChanged) {
                        letterObj.position.x = newLetter.x;
                        letterObj.position.y = newLetter.y;
                        // Reset velocity when position is updated
                        letterObj.velocity.x = 0;
                        letterObj.velocity.y = 0;
                    }
                }

                // Update character if changed
                if (letterObj.char !== newLetter.char) {
                    letterObj.char = newLetter.char;
                    // Rebuild geometry with current bevel values
                    const oldGeometry = letterObj.mesh.geometry;
                    letterObj.mesh.geometry = createLetterGeometry(
                        letterObj.char,
                        letterObj.currentBevelThickness,
                        letterObj.currentBevelSize
                    );
                    oldGeometry.dispose();
                }
            } else {
                // Create new letter
                const gridPosition = { x: newLetter.x, y: newLetter.y };
                const letterObj = createLetterMesh(newLetter.char, index, gridPosition);
                if (letterObj) {
                    InflatableText.letterMeshes.push(letterObj);
                }
            }
        });
    });

    // Background color
    const bgColor = document.getElementById('bg-color');
    bgColor.addEventListener('input', (e) => {
        InflatableText.settings.backgroundColor = e.target.value;
        updateSceneBackground();

        // If using background as environment map and no background image, update environment map with new color
        if (InflatableText.settings.useBackgroundAsEnv && !InflatableText.settings.backgroundImage) {
            Materials.updateAllMaterialsEnvironmentMap();
        }
    });

    // Use background as environment map toggle
    const useBgAsEnv = document.getElementById('use-bg-as-env');
    useBgAsEnv.addEventListener('change', (e) => {
        InflatableText.settings.useBackgroundAsEnv = e.target.checked;
        Materials.updateAllMaterialsEnvironmentMap();
        console.log(`🌍 Use background as environment map: ${e.target.checked ? 'enabled' : 'disabled'}`);
    });

    // Background image upload
    const bgImage = document.getElementById('bg-image');
    const bgImageOptions = document.getElementById('bg-image-options');

    bgImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const loader = new THREE.TextureLoader();
                loader.load(event.target.result, (texture) => {
                    InflatableText.settings.backgroundImage = texture;

                    // Show background image options
                    bgImageOptions.style.display = 'block';

                    // Convert background image to environment map format
                    const pmremGenerator = new THREE.PMREMGenerator(InflatableText.renderer);
                    pmremGenerator.compileEquirectangularShader();
                    InflatableText.settings.backgroundImageEnvMap = pmremGenerator.fromEquirectangular(texture).texture;
                    pmremGenerator.dispose();

                    updateSceneBackground();

                    // If using background as environment map, update environment map with new image
                    if (InflatableText.settings.useBackgroundAsEnv) {
                        Materials.updateAllMaterialsEnvironmentMap();
                    }
                });
            };
            reader.readAsDataURL(file);
        }
    });

    // Background fill mode
    const bgFillMode = document.getElementById('bg-fill-mode');
    bgFillMode.addEventListener('change', (e) => {
        InflatableText.settings.bgFillMode = e.target.value;
        updateSceneBackground();
    });

    // Clear background image
    const clearBgBtn = document.getElementById('clear-bg-btn');
    if (clearBgBtn) {
        clearBgBtn.addEventListener('click', () => {
            InflatableText.settings.backgroundImage = null;
            InflatableText.settings.backgroundImageEnvMap = null;
            bgImage.value = ''; // Reset file input
            bgImageOptions.style.display = 'none'; // Hide options
            updateSceneBackground();

            // If using background as environment map, update to use solid color
            if (InflatableText.settings.useBackgroundAsEnv) {
                Materials.updateAllMaterialsEnvironmentMap();
            }
        });
    }

    // Transparent background toggle
    const transparentBg = document.getElementById('transparent-bg');
    transparentBg.addEventListener('change', (e) => {
        InflatableText.settings.transparentBg = e.target.checked;
        updateSceneBackground();

        // If using background as environment map, update environment map
        if (InflatableText.settings.useBackgroundAsEnv) {
            Materials.updateAllMaterialsEnvironmentMap();
        }
    });

    // Replay button - restart all animations
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            if (InflatableText.settings.playTypingAnimation) {
                // If typing animation is enabled, restart the typing animation
                startTypingAnimation();
            } else {
                // Otherwise, restart inflation animations for existing letters
                InflatableText.letterMeshes.forEach(letterObj => {
                    letterObj.inflation = 0;
                    letterObj.currentBevelThickness = 0;
                    letterObj.currentBevelSize = 0;
                    letterObj.isInflating = true;
                    letterObj.floatTime = 0;
                });
            }
        });
    }

    // Inflation speed
    const inflationSpeed = document.getElementById('inflation-speed');
    const inflationSpeedInput = document.getElementById('inflation-speed-input');
    inflationSpeed.addEventListener('input', (e) => {
        InflatableText.settings.inflationSpeed = parseFloat(e.target.value);
        inflationSpeedInput.value = e.target.value;
    });
    inflationSpeedInput.addEventListener('input', (e) => {
        InflatableText.settings.inflationSpeed = parseFloat(e.target.value);
        inflationSpeed.value = e.target.value;
    });

    // Play typing animation toggle
    const playTypingAnimation = document.getElementById('play-typing-animation');
    playTypingAnimation.addEventListener('change', (e) => {
        InflatableText.settings.playTypingAnimation = e.target.checked;
        
        if (e.target.checked) {
            // Start typing animation
            startTypingAnimation();
        } else {
            // Stop typing animation
            stopTypingAnimation();
        }
    });

    // Squish Animation toggle
    const squishAnimation = document.getElementById('squish-animation');
    squishAnimation.addEventListener('change', (e) => {
        InflatableText.settings.squishAnimation = e.target.checked;
        if (e.target.checked) {
            // Reset squish state when enabling
            InflatableText.squishState.time = 0;
            InflatableText.squishState.currentScaleWidth = 1.0;
            InflatableText.squishState.currentScaleHeight = 1.0;
        } else {
            // Reset to normal scale when disabling
            InflatableText.squishState.currentScaleWidth = 1.0;
            InflatableText.squishState.currentScaleHeight = 1.0;
            updateCanvasBounds();
        }
    });

    // Squish Speed
    const squishSpeed = document.getElementById('squish-speed');
    const squishSpeedInput = document.getElementById('squish-speed-input');
    squishSpeed.addEventListener('input', (e) => {
        InflatableText.settings.squishSpeed = parseFloat(e.target.value);
        squishSpeedInput.value = e.target.value;
    });
    squishSpeedInput.addEventListener('input', (e) => {
        InflatableText.settings.squishSpeed = parseFloat(e.target.value);
        squishSpeed.value = e.target.value;
    });

    // Squish Easing
    const squishEasing = document.getElementById('squish-easing');
    squishEasing.addEventListener('change', (e) => {
        InflatableText.settings.squishEasing = e.target.value;
    });

    // Squish Ping Pong toggle
    const squishPingPong = document.getElementById('squish-ping-pong');
    squishPingPong.addEventListener('change', (e) => {
        InflatableText.settings.squishPingPong = e.target.checked;
    });

    // Squish Width Min
    const squishWidthMin = document.getElementById('squish-width-min');
    const squishWidthMinInput = document.getElementById('squish-width-min-input');
    squishWidthMin.addEventListener('input', (e) => {
        InflatableText.settings.squishWidthMin = parseFloat(e.target.value) / 100;
        squishWidthMinInput.value = e.target.value;
    });
    squishWidthMinInput.addEventListener('input', (e) => {
        InflatableText.settings.squishWidthMin = parseFloat(e.target.value) / 100;
        squishWidthMin.value = e.target.value;
    });

    // Squish Width Max
    const squishWidthMax = document.getElementById('squish-width-max');
    const squishWidthMaxInput = document.getElementById('squish-width-max-input');
    squishWidthMax.addEventListener('input', (e) => {
        InflatableText.settings.squishWidthMax = parseFloat(e.target.value) / 100;
        squishWidthMaxInput.value = e.target.value;
    });
    squishWidthMaxInput.addEventListener('input', (e) => {
        InflatableText.settings.squishWidthMax = parseFloat(e.target.value) / 100;
        squishWidthMax.value = e.target.value;
    });

    // Squish Height Min
    const squishHeightMin = document.getElementById('squish-height-min');
    const squishHeightMinInput = document.getElementById('squish-height-min-input');
    squishHeightMin.addEventListener('input', (e) => {
        InflatableText.settings.squishHeightMin = parseFloat(e.target.value) / 100;
        squishHeightMinInput.value = e.target.value;
    });
    squishHeightMinInput.addEventListener('input', (e) => {
        InflatableText.settings.squishHeightMin = parseFloat(e.target.value) / 100;
        squishHeightMin.value = e.target.value;
    });

    // Squish Height Max
    const squishHeightMax = document.getElementById('squish-height-max');
    const squishHeightMaxInput = document.getElementById('squish-height-max-input');
    squishHeightMax.addEventListener('input', (e) => {
        InflatableText.settings.squishHeightMax = parseFloat(e.target.value) / 100;
        squishHeightMaxInput.value = e.target.value;
    });
    squishHeightMaxInput.addEventListener('input', (e) => {
        InflatableText.settings.squishHeightMax = parseFloat(e.target.value) / 100;
        squishHeightMax.value = e.target.value;
    });

    // Font size
    const fontSize = document.getElementById('font-size');
    const fontSizeInput = document.getElementById('font-size-input');
    fontSize.addEventListener('input', (e) => {
        InflatableText.settings.fontSize = parseFloat(e.target.value);
        fontSizeInput.value = e.target.value;
        // If auto spacing is on, trigger text update to recalculate
        if (InflatableText.settings.autoSpacing) {
            const textInput = document.getElementById('text-input');
            textInput.dispatchEvent(new Event('input'));
        }
    });
    fontSizeInput.addEventListener('input', (e) => {
        InflatableText.settings.fontSize = parseFloat(e.target.value);
        fontSize.value = e.target.value;
        // If auto spacing is on, trigger text update to recalculate
        if (InflatableText.settings.autoSpacing) {
            const textInput = document.getElementById('text-input');
            textInput.dispatchEvent(new Event('input'));
        }
    });

    // Automatic spacing toggle
    const autoSpacing = document.getElementById('auto-spacing');
    const letterSpacing = document.getElementById('letter-spacing');
    const letterSpacingInput = document.getElementById('letter-spacing-input');
    const lineSpacing = document.getElementById('line-spacing');
    const lineSpacingInput = document.getElementById('line-spacing-input');

    function updateSpacingControlsState() {
        const isAuto = InflatableText.settings.autoSpacing;
        letterSpacing.disabled = isAuto;
        letterSpacingInput.disabled = isAuto;
        lineSpacing.disabled = isAuto;
        lineSpacingInput.disabled = isAuto;

        // Grey out labels
        letterSpacing.style.opacity = isAuto ? '0.5' : '1';
        letterSpacingInput.style.opacity = isAuto ? '0.5' : '1';
        lineSpacing.style.opacity = isAuto ? '0.5' : '1';
        lineSpacingInput.style.opacity = isAuto ? '0.5' : '1';
    }

    autoSpacing.addEventListener('change', (e) => {
        InflatableText.settings.autoSpacing = e.target.checked;
        updateSpacingControlsState();
        // Trigger text input update to recalculate positions
        const textInput = document.getElementById('text-input');
        textInput.dispatchEvent(new Event('input'));
    });

    // Initialize spacing controls state
    updateSpacingControlsState();

    // Random spawn toggle
    const randomSpawn = document.getElementById('random-spawn');
    randomSpawn.addEventListener('change', (e) => {
        InflatableText.settings.randomSpawn = e.target.checked;
        // Note: Don't trigger text update here - only affects new letters from now on
    });

    // Letter spacing (already declared above)
    letterSpacing.addEventListener('input', (e) => {
        InflatableText.settings.letterSpacing = parseFloat(e.target.value);
        letterSpacingInput.value = e.target.value;
        // Trigger text input update to recalculate positions
        const textInput = document.getElementById('text-input');
        textInput.dispatchEvent(new Event('input'));
    });
    letterSpacingInput.addEventListener('input', (e) => {
        InflatableText.settings.letterSpacing = parseFloat(e.target.value);
        letterSpacing.value = e.target.value;
        // Trigger text input update to recalculate positions
        const textInput = document.getElementById('text-input');
        textInput.dispatchEvent(new Event('input'));
    });

    // Line spacing (already declared above)
    lineSpacing.addEventListener('input', (e) => {
        InflatableText.settings.lineSpacing = parseFloat(e.target.value);
        lineSpacingInput.value = e.target.value;
        // Trigger text input update to recalculate positions
        const textInput = document.getElementById('text-input');
        textInput.dispatchEvent(new Event('input'));
    });
    lineSpacingInput.addEventListener('input', (e) => {
        InflatableText.settings.lineSpacing = parseFloat(e.target.value);
        lineSpacing.value = e.target.value;
        // Trigger text input update to recalculate positions
        const textInput = document.getElementById('text-input');
        textInput.dispatchEvent(new Event('input'));
    });

    // Boundary padding
    const boundaryPadding = document.getElementById('boundary-padding');
    const boundaryPaddingInput = document.getElementById('boundary-padding-input');
    boundaryPadding.addEventListener('input', (e) => {
        InflatableText.settings.boundaryPadding = parseFloat(e.target.value);
        boundaryPaddingInput.value = e.target.value;
        updateCanvasBounds();
    });
    boundaryPaddingInput.addEventListener('input', (e) => {
        InflatableText.settings.boundaryPadding = parseFloat(e.target.value);
        boundaryPadding.value = e.target.value;
        updateCanvasBounds();
    });

    // Spawn radius
    const spawnRadius = document.getElementById('spawn-radius');
    const spawnRadiusInput = document.getElementById('spawn-radius-input');
    spawnRadius.addEventListener('input', (e) => {
        InflatableText.settings.spawnRadius = parseFloat(e.target.value);
        spawnRadiusInput.value = e.target.value;
    });
    spawnRadiusInput.addEventListener('input', (e) => {
        InflatableText.settings.spawnRadius = parseFloat(e.target.value);
        spawnRadius.value = e.target.value;
    });

    // Gravity
    const gravity = document.getElementById('gravity');
    const gravityInput = document.getElementById('gravity-input');
    gravity.addEventListener('input', (e) => {
        InflatableText.settings.gravity = parseFloat(e.target.value);
        gravityInput.value = e.target.value;
    });
    gravityInput.addEventListener('input', (e) => {
        InflatableText.settings.gravity = parseFloat(e.target.value);
        gravity.value = e.target.value;
    });

    // Bounciness
    const bounciness = document.getElementById('bounciness');
    const bouncinessInput = document.getElementById('bounciness-input');
    bounciness.addEventListener('input', (e) => {
        InflatableText.settings.bounciness = parseFloat(e.target.value);
        bouncinessInput.value = e.target.value;
    });
    bouncinessInput.addEventListener('input', (e) => {
        InflatableText.settings.bounciness = parseFloat(e.target.value);
        bounciness.value = e.target.value;
    });

    // Collider size
    const colliderSize = document.getElementById('collider-size');
    const colliderSizeInput = document.getElementById('collider-size-input');
    colliderSize.addEventListener('input', (e) => {
        InflatableText.settings.colliderSize = parseFloat(e.target.value);
        colliderSizeInput.value = e.target.value;
    });
    colliderSizeInput.addEventListener('input', (e) => {
        InflatableText.settings.colliderSize = parseFloat(e.target.value);
        colliderSize.value = e.target.value;
    });

    // Color palette controls
    setupColorPalette();

    // Material preset controls
    setupMaterialControls();

    // Lighting intensity controls
    setupLightingControls();

    // Light follows mouse toggle
    const lightFollowsMouse = document.getElementById('light-follows-mouse');
    lightFollowsMouse.addEventListener('change', (e) => {
        InflatableText.settings.lightFollowsMouse = e.target.checked;
    });

    // Bounding box visibility toggle
    const showBoundingBox = document.getElementById('show-bounding-box');
    showBoundingBox.addEventListener('change', (e) => {
        InflatableText.settings.showBoundingBox = e.target.checked;
        updateBoundingBoxDebug();
    });

    // Use custom bounding box size toggle
    const useBoundingBoxSize = document.getElementById('use-bounding-box-size');
    useBoundingBoxSize.addEventListener('change', (e) => {
        InflatableText.settings.useBoundingBoxSize = e.target.checked;
        updateCanvasBounds();
    });

    // Bounding box width
    const boundingBoxWidth = document.getElementById('bounding-box-width');
    const boundingBoxWidthInput = document.getElementById('bounding-box-width-input');
    boundingBoxWidth.addEventListener('input', (e) => {
        InflatableText.settings.boundingBoxWidth = parseFloat(e.target.value);
        boundingBoxWidthInput.value = e.target.value;
        updateCanvasBounds();
    });
    boundingBoxWidthInput.addEventListener('input', (e) => {
        InflatableText.settings.boundingBoxWidth = parseFloat(e.target.value);
        boundingBoxWidth.value = e.target.value;
        updateCanvasBounds();
    });

    // Bounding box height
    const boundingBoxHeight = document.getElementById('bounding-box-height');
    const boundingBoxHeightInput = document.getElementById('bounding-box-height-input');
    boundingBoxHeight.addEventListener('input', (e) => {
        InflatableText.settings.boundingBoxHeight = parseFloat(e.target.value);
        boundingBoxHeightInput.value = e.target.value;
        updateCanvasBounds();
    });
    boundingBoxHeightInput.addEventListener('input', (e) => {
        InflatableText.settings.boundingBoxHeight = parseFloat(e.target.value);
        boundingBoxHeight.value = e.target.value;
        updateCanvasBounds();
    });

    // Clear button - removes all letters
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            // Stop typing animation if it's playing
            if (InflatableText.settings.playTypingAnimation) {
                stopTypingAnimation();
                // Uncheck the typing animation toggle
                const playTypingAnimation = document.getElementById('play-typing-animation');
                playTypingAnimation.checked = false;
                InflatableText.settings.playTypingAnimation = false;
            }
            
            // Remove all meshes
            InflatableText.letterMeshes.forEach(letterObj => {
                if (letterObj.mesh) {
                    InflatableText.scene.remove(letterObj.mesh);
                    letterObj.mesh.geometry.dispose();
                    letterObj.mesh.material.dispose();
                }
            });
            InflatableText.letterMeshes = [];
            InflatableText.nextLetterX = -20;
            textInput.value = "";
        });
    }
}

// ========== COLOR PALETTE UI ==========
function setupColorPalette() {
    renderColorPalette();

    // Add color button
    const addColorBtn = document.getElementById('add-color-btn');
    addColorBtn.addEventListener('click', () => {
        // Add a random color
        const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        InflatableText.settings.letterColors.push(randomColor);
        renderColorPalette();
        updateAllLetterColors();
    });
}

function renderColorPalette() {
    const paletteList = document.getElementById('color-palette-list');
    paletteList.innerHTML = '';

    // Create compact container for all colors
    const colorsContainer = document.createElement('div');
    colorsContainer.style.display = 'flex';
    colorsContainer.style.flexWrap = 'wrap';
    colorsContainer.style.gap = '8px';
    colorsContainer.style.marginBottom = '10px';

    InflatableText.settings.letterColors.forEach((color, index) => {
        const colorItem = document.createElement('div');
        colorItem.style.display = 'flex';
        colorItem.style.flexDirection = 'column';
        colorItem.style.alignItems = 'center';
        colorItem.style.gap = '4px';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = color;
        colorInput.style.width = '40px';
        colorInput.style.height = '40px';
        colorInput.style.padding = '0';
        colorInput.style.border = 'none';
        colorInput.style.borderRadius = '4px';
        colorInput.style.cursor = 'pointer';
        colorInput.addEventListener('input', (e) => {
            InflatableText.settings.letterColors[index] = e.target.value;
            updateAllLetterColors();
        });

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.className = 'chatooly-button';
        removeBtn.style.width = '40px';
        removeBtn.style.height = '20px';
        removeBtn.style.padding = '0';
        removeBtn.style.fontSize = '14px';
        removeBtn.style.lineHeight = '1';
        removeBtn.addEventListener('click', () => {
            if (InflatableText.settings.letterColors.length > 1) {
                InflatableText.settings.letterColors.splice(index, 1);
                renderColorPalette();
                updateAllLetterColors();
            }
        });

        colorItem.appendChild(colorInput);
        colorItem.appendChild(removeBtn);
        colorsContainer.appendChild(colorItem);
    });

    paletteList.appendChild(colorsContainer);
}

function updateAllLetterColors() {
    InflatableText.letterMeshes.forEach((letterObj, index) => {
        if (letterObj.mesh && letterObj.mesh.material) {
            const palette = InflatableText.settings.letterColors;
            const colorHex = palette[index % palette.length];
            letterObj.mesh.material.color.set(colorHex);
        }
    });
}

// ========== UPDATE MATERIAL PROPERTIES ==========
function updateAllMaterials() {
    InflatableText.letterMeshes.forEach(letterObj => {
        if (letterObj.mesh && letterObj.mesh.material) {
            letterObj.mesh.material.metalness = InflatableText.settings.metalness;
            letterObj.mesh.material.roughness = InflatableText.settings.roughness;
            letterObj.mesh.material.transmission = InflatableText.settings.transmission;
            letterObj.mesh.material.clearcoat = InflatableText.settings.clearcoat;
            letterObj.mesh.material.clearcoatRoughness = InflatableText.settings.clearcoatRoughness;
            letterObj.mesh.material.opacity = InflatableText.settings.opacity;
            letterObj.mesh.material.needsUpdate = true;
        }
    });
}


// ========== MATERIAL PRESET CONTROLS ==========
function setupMaterialControls() {
    // Material preset dropdown
    const materialPresetSelect = document.getElementById('material-preset');
    if (materialPresetSelect) {
        materialPresetSelect.addEventListener('change', (e) => {
            InflatableText.settings.selectedMaterial = e.target.value;
            console.log(`🎨 Material changed to: ${e.target.value}`);
            
            // Automatically apply the new material to all letters
            Materials.applyMaterialToAllLetters();
        });
    }
}

// ========== LIGHTING CONTROLS ==========
function setupLightingControls() {
    // Ambient light toggle
    const ambientEnabled = document.getElementById('ambient-enabled');
    if (ambientEnabled) {
        ambientEnabled.addEventListener('change', (e) => {
            Lighting.toggleLights({ ambient: e.target.checked });
        });
    }

    // Ambient light intensity
    const ambientIntensity = document.getElementById('ambient-intensity');
    const ambientIntensityInput = document.getElementById('ambient-intensity-input');
    if (ambientIntensity && ambientIntensityInput) {
        ambientIntensity.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            ambientIntensityInput.value = value;
            Lighting.updateLightIntensities({ ambient: value });
        });
        ambientIntensityInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            ambientIntensity.value = value;
            Lighting.updateLightIntensities({ ambient: value });
        });
    }

    // Main light toggle
    const mainLightEnabled = document.getElementById('main-light-enabled');
    if (mainLightEnabled) {
        mainLightEnabled.addEventListener('change', (e) => {
            Lighting.toggleLights({ main: e.target.checked });
        });
    }

    // Main light intensity
    const mainLightIntensity = document.getElementById('main-light-intensity');
    const mainLightIntensityInput = document.getElementById('main-light-intensity-input');
    if (mainLightIntensity && mainLightIntensityInput) {
        mainLightIntensity.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            mainLightIntensityInput.value = value;
            Lighting.updateLightIntensities({ main: value });
        });
        mainLightIntensityInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            mainLightIntensity.value = value;
            Lighting.updateLightIntensities({ main: value });
        });
    }

    // Main light position controls
    setupLightPositionControls('main', 'mainLightPosition', Lighting.updateMainLightPosition.bind(Lighting));

    // Fill light toggle
    const fillLightEnabled = document.getElementById('fill-light-enabled');
    if (fillLightEnabled) {
        fillLightEnabled.addEventListener('change', (e) => {
            Lighting.toggleLights({ fill: e.target.checked });
        });
    }

    // Fill light intensity
    const fillLightIntensity = document.getElementById('fill-light-intensity');
    const fillLightIntensityInput = document.getElementById('fill-light-intensity-input');
    if (fillLightIntensity && fillLightIntensityInput) {
        fillLightIntensity.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            fillLightIntensityInput.value = value;
            Lighting.updateLightIntensities({ fill: value });
        });
        fillLightIntensityInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            fillLightIntensity.value = value;
            Lighting.updateLightIntensities({ fill: value });
        });
    }

    // Fill light position controls
    setupLightPositionControls('fill', 'fillLightPosition', Lighting.updateFillLightPosition.bind(Lighting));

    // Rim light toggle
    const rimLightEnabled = document.getElementById('rim-light-enabled');
    if (rimLightEnabled) {
        rimLightEnabled.addEventListener('change', (e) => {
            Lighting.toggleLights({ rim: e.target.checked });
        });
    }

    // Rim light intensity
    const rimLightIntensity = document.getElementById('rim-light-intensity');
    const rimLightIntensityInput = document.getElementById('rim-light-intensity-input');
    if (rimLightIntensity && rimLightIntensityInput) {
        rimLightIntensity.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            rimLightIntensityInput.value = value;
            Lighting.updateLightIntensities({ rim: value });
        });
        rimLightIntensityInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            rimLightIntensity.value = value;
            Lighting.updateLightIntensities({ rim: value });
        });
    }

    // Rim light position X
    const rimLightX = document.getElementById('rim-light-x');
    const rimLightXInput = document.getElementById('rim-light-x-input');
    if (rimLightX && rimLightXInput) {
        rimLightX.addEventListener('input', (e) => {
            const x = parseFloat(e.target.value);
            rimLightXInput.value = x;
            const pos = InflatableText.settings.rimLightPosition;
            Lighting.updateRimLightPosition(x, pos.y, pos.z);
        });
        rimLightXInput.addEventListener('input', (e) => {
            const x = parseFloat(e.target.value);
            rimLightX.value = x;
            const pos = InflatableText.settings.rimLightPosition;
            Lighting.updateRimLightPosition(x, pos.y, pos.z);
        });
    }

    // Rim light position Y
    const rimLightY = document.getElementById('rim-light-y');
    const rimLightYInput = document.getElementById('rim-light-y-input');
    if (rimLightY && rimLightYInput) {
        rimLightY.addEventListener('input', (e) => {
            const y = parseFloat(e.target.value);
            rimLightYInput.value = y;
            const pos = InflatableText.settings.rimLightPosition;
            Lighting.updateRimLightPosition(pos.x, y, pos.z);
        });
        rimLightYInput.addEventListener('input', (e) => {
            const y = parseFloat(e.target.value);
            rimLightY.value = y;
            const pos = InflatableText.settings.rimLightPosition;
            Lighting.updateRimLightPosition(pos.x, y, pos.z);
        });
    }

    // Rim light position Z
    const rimLightZ = document.getElementById('rim-light-z');
    const rimLightZInput = document.getElementById('rim-light-z-input');
    if (rimLightZ && rimLightZInput) {
        rimLightZ.addEventListener('input', (e) => {
            const z = parseFloat(e.target.value);
            rimLightZInput.value = z;
            const pos = InflatableText.settings.rimLightPosition;
            Lighting.updateRimLightPosition(pos.x, pos.y, z);
        });
        rimLightZInput.addEventListener('input', (e) => {
            const z = parseFloat(e.target.value);
            rimLightZ.value = z;
            const pos = InflatableText.settings.rimLightPosition;
            Lighting.updateRimLightPosition(pos.x, pos.y, z);
        });
    }
}

// ========== HELPER: LIGHT POSITION CONTROLS ==========
function setupLightPositionControls(lightName, settingsKey, updateFunction) {
    // X position
    const xSlider = document.getElementById(`${lightName}-light-x`);
    const xInput = document.getElementById(`${lightName}-light-x-input`);
    if (xSlider && xInput) {
        xSlider.addEventListener('input', (e) => {
            const x = parseFloat(e.target.value);
            xInput.value = x;
            const pos = InflatableText.settings[settingsKey];
            updateFunction(x, pos.y, pos.z);
        });
        xInput.addEventListener('input', (e) => {
            const x = parseFloat(e.target.value);
            xSlider.value = x;
            const pos = InflatableText.settings[settingsKey];
            updateFunction(x, pos.y, pos.z);
        });
    }

    // Y position
    const ySlider = document.getElementById(`${lightName}-light-y`);
    const yInput = document.getElementById(`${lightName}-light-y-input`);
    if (ySlider && yInput) {
        ySlider.addEventListener('input', (e) => {
            const y = parseFloat(e.target.value);
            yInput.value = y;
            const pos = InflatableText.settings[settingsKey];
            updateFunction(pos.x, y, pos.z);
        });
        yInput.addEventListener('input', (e) => {
            const y = parseFloat(e.target.value);
            ySlider.value = y;
            const pos = InflatableText.settings[settingsKey];
            updateFunction(pos.x, y, pos.z);
        });
    }

    // Z position
    const zSlider = document.getElementById(`${lightName}-light-z`);
    const zInput = document.getElementById(`${lightName}-light-z-input`);
    if (zSlider && zInput) {
        zSlider.addEventListener('input', (e) => {
            const z = parseFloat(e.target.value);
            zInput.value = z;
            const pos = InflatableText.settings[settingsKey];
            updateFunction(pos.x, pos.y, z);
        });
        zInput.addEventListener('input', (e) => {
            const z = parseFloat(e.target.value);
            zSlider.value = z;
            const pos = InflatableText.settings[settingsKey];
            updateFunction(pos.x, pos.y, z);
        });
    }
}
