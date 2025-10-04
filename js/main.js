/*
 * Inflatable Text - 3D Text with Custom Shader Inflation
 * Author: Studio Video
 *
 * Features:
 * - Three.js 3D rendering with custom shader material
 * - GPU-based vertex inflation along normals
 * - Real-time geometry parameter editing
 * - Interactive 3D viewing with OrbitControls
 */

// ========== GLOBAL STATE ==========
const InflatableText = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    letterMeshes: [], // Array of individual letter objects
    font: null,
    isInitialized: false,
    canvas: null,

    // Settings
    settings: {
        inflationSpeed: 1.0, // Speed of bevel animation (higher = faster)
        fontSize: 5,
        autoSpacing: true, // Automatically calculate spacing based on font size
        randomSpawn: false, // Use random spawn positions instead of grid layout
        letterSpacing: 0.3, // Multiplier for spacing between letters (0.1 = very tight, 2 = very loose)
        lineSpacing: 0.3, // Multiplier for spacing between lines (0.1 = very tight, 2 = very loose)
        backgroundColor: '#000000',
        backgroundImage: null, // Background image texture
        backgroundImageSprite: null, // Sprite for background image rendering
        environmentMap: null, // Environment map for reflections
        transparentBg: false, // Transparent background option
        useEnvMap: false, // Use background as environment map
        bgFillMode: 'fill', // 'fill' or 'fit'

        // Fixed geometry parameters
        extrudeDepth: 0.2,
        curveSegments: 64,
        bevelSegments: 32,

        // Inflation targets (ONLY thing that animates)
        targetBevelThickness: 0.23,
        targetBevelSize: 0.15,

        // Physics settings
        spawnRadius: 5,
        gravity: 0,
        boundaryPadding: 5, // Padding from canvas edges
        bounciness: 0.1, // 0 = no bounce, 1 = full bounce
        colliderSize: 0.4, // Multiplier for collision radius (0.3 = small, 2 = large)

        // Bounding box settings
        useBoundingBoxSize: false, // Use custom width/height instead of auto-calculated
        boundingBoxWidth: 50,
        boundingBoxHeight: 40,

        // Color palette for letters
        letterColors: ['#ff6b9d', '#c44569', '#4a69bd'],

        // Debug options
        showBoundingBox: true
    },

    // Store light references for runtime updates
    lights: {
        ambient: null,
        main: null,
        fill: null,
        rim: null
    },

    // Canvas bounds (updated on resize)
    canvasBounds: {
        minX: -400,
        maxX: 400,
        minY: -300,
        maxY: 300
    }
};

// ========== INITIALIZATION ==========
function init() {
    InflatableText.canvas = document.getElementById('chatooly-canvas');

    // Get container size to match canvas properly
    const container = document.getElementById('chatooly-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Setup Three.js renderer
    InflatableText.renderer = new THREE.WebGLRenderer({
        canvas: InflatableText.canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true  // Required for Chatooly exports
    });
    InflatableText.renderer.setSize(containerWidth, containerHeight);
    InflatableText.renderer.setPixelRatio(window.devicePixelRatio);
    InflatableText.renderer.shadowMap.enabled = true;
    InflatableText.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Setup scene
    InflatableText.scene = new THREE.Scene();
    updateSceneBackground();

    // Setup camera
    InflatableText.camera = new THREE.PerspectiveCamera(
        60,
        containerWidth / containerHeight,
        0.1,
        1000
    );
    InflatableText.camera.position.set(0, 0, 30);
    InflatableText.camera.lookAt(0, 0, 0);

    // Setup OrbitControls
    InflatableText.controls = new THREE.OrbitControls(InflatableText.camera, InflatableText.canvas);
    InflatableText.controls.enableDamping = true;
    InflatableText.controls.dampingFactor = 0.05;
    InflatableText.controls.screenSpacePanning = false;
    InflatableText.controls.minDistance = 5;
    InflatableText.controls.maxDistance = 100;

    // Add lighting
    setupLighting();

    // Add debug bounding box
    createBoundingBoxDebug();

    // Load font (don't create initial text)
    loadFont();

    // Setup controls
    setupControls();

    // Canvas click interaction removed - using grid layout now

    // Listen for canvas resize events
    document.addEventListener('chatooly:canvas-resized', handleCanvasResize);
    window.addEventListener('resize', handleWindowResize);

    // Calculate initial canvas bounds
    updateCanvasBounds();

    // Start animation loop
    animate();

    InflatableText.isInitialized = true;
}

// ========== CANVAS RESIZE HANDLING ==========
function handleCanvasResize(e) {
    const newWidth = e.detail.canvas.width;
    const newHeight = e.detail.canvas.height;

    InflatableText.renderer.setSize(newWidth, newHeight, false);
    InflatableText.camera.aspect = newWidth / newHeight;
    InflatableText.camera.updateProjectionMatrix();
    updateCanvasBounds();
}

function handleWindowResize() {
    const container = document.getElementById('chatooly-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    InflatableText.renderer.setSize(containerWidth, containerHeight);
    InflatableText.camera.aspect = containerWidth / containerHeight;
    InflatableText.camera.updateProjectionMatrix();
    updateCanvasBounds();
}

// ========== UPDATE CANVAS BOUNDS ==========
function updateCanvasBounds() {
    let visibleWidth, visibleHeight;

    if (InflatableText.settings.useBoundingBoxSize) {
        // Use custom width and height
        visibleWidth = InflatableText.settings.boundingBoxWidth;
        visibleHeight = InflatableText.settings.boundingBoxHeight;
    } else {
        // Calculate visible area in world space based on camera
        const vFOV = InflatableText.camera.fov * Math.PI / 180;
        const distance = InflatableText.camera.position.z;
        visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
        visibleWidth = visibleHeight * InflatableText.camera.aspect;
    }

    const padding = InflatableText.settings.boundaryPadding;

    InflatableText.canvasBounds = {
        minX: -(visibleWidth / 2) + padding,
        maxX: (visibleWidth / 2) - padding,
        minY: -(visibleHeight / 2) + padding,
        maxY: (visibleHeight / 2) - padding
    };

    // Update debug bounding box
    updateBoundingBoxDebug();
}

// ========== DEBUG BOUNDING BOX ==========
let debugBoundingBox = null;

function createBoundingBoxDebug() {
    // Create a wireframe box to visualize boundaries
    const geometry = new THREE.BoxGeometry(1, 1, 5);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    debugBoundingBox = new THREE.LineSegments(edges, material);
    InflatableText.scene.add(debugBoundingBox);
}

function updateBoundingBoxDebug() {
    if (!debugBoundingBox) return;

    const bounds = InflatableText.canvasBounds;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    debugBoundingBox.scale.set(width, height, 1);
    debugBoundingBox.position.set(centerX, centerY, 0);
    debugBoundingBox.visible = InflatableText.settings.showBoundingBox;
}

// ========== LIGHTING SETUP ==========
function setupLighting() {
    // Ambient light for overall illumination
    InflatableText.lights.ambient = new THREE.AmbientLight(0xffffff, InflatableText.settings.ambientIntensity);
    InflatableText.scene.add(InflatableText.lights.ambient);

    // Main directional light (key light)
    InflatableText.lights.main = new THREE.DirectionalLight(0xffffff, InflatableText.settings.mainLightIntensity);
    InflatableText.lights.main.position.set(10, 20, 10);
    InflatableText.lights.main.castShadow = true;
    InflatableText.scene.add(InflatableText.lights.main);

    // Fill light (softer, from opposite side)
    InflatableText.lights.fill = new THREE.DirectionalLight(0x88ccff, InflatableText.settings.fillLightIntensity);
    InflatableText.lights.fill.position.set(-10, 5, -5);
    InflatableText.scene.add(InflatableText.lights.fill);

    // Rim light (for balloon edge glow)
    InflatableText.lights.rim = new THREE.DirectionalLight(0xffaaff, InflatableText.settings.rimLightIntensity);
    InflatableText.lights.rim.position.set(0, 0, -10);
    InflatableText.scene.add(InflatableText.lights.rim);
}

// ========== BACKGROUND MANAGEMENT ==========
function updateSceneBackground() {
    // Remove existing background sprite if any
    if (InflatableText.settings.backgroundImageSprite) {
        InflatableText.scene.remove(InflatableText.settings.backgroundImageSprite);
        InflatableText.settings.backgroundImageSprite = null;
    }

    if (InflatableText.settings.transparentBg) {
        // Transparent background
        InflatableText.scene.background = null;
    } else if (InflatableText.settings.backgroundImage) {
        // Use sprite for background image to control fill/fit
        createBackgroundSprite();
        InflatableText.scene.background = new THREE.Color(InflatableText.settings.backgroundColor);
    } else {
        // Solid color background
        InflatableText.scene.background = new THREE.Color(InflatableText.settings.backgroundColor);
    }
}

function createBackgroundSprite() {
    const texture = InflatableText.settings.backgroundImage;
    if (!texture) return;

    const container = document.getElementById('chatooly-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const containerAspect = containerWidth / containerHeight;

    // Get texture dimensions
    const textureAspect = texture.image.width / texture.image.height;

    let planeWidth, planeHeight;

    if (InflatableText.settings.bgFillMode === 'fill') {
        // Fill mode: cover entire view (may crop image)
        if (containerAspect > textureAspect) {
            // Container is wider than image
            planeWidth = 100;
            planeHeight = 100 / containerAspect;
        } else {
            // Container is taller than image
            planeHeight = 100;
            planeWidth = 100 * containerAspect;
        }
    } else {
        // Fit mode: fit entire image (may show letterboxing)
        if (containerAspect > textureAspect) {
            // Container is wider than image
            planeHeight = 100;
            planeWidth = 100 * (textureAspect / containerAspect);
        } else {
            // Container is taller than image
            planeWidth = 100;
            planeHeight = 100 / (textureAspect * containerAspect);
        }
    }

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false
    });

    const sprite = new THREE.Mesh(geometry, material);
    sprite.position.z = -50; // Place behind all letters
    sprite.renderOrder = -1; // Render first

    InflatableText.settings.backgroundImageSprite = sprite;
    InflatableText.scene.add(sprite);
}

// ========== REMOVED: Physics boundaries (no longer needed) ==========

// ========== FONT LOADING ==========
function loadFont() {
    const loader = new THREE.FontLoader();

    // Load Balloony Regular JSON font
    loader.load(
        'fonts/Balloony_Regular.json',
        function(font) {
            InflatableText.font = font;
            console.log('✅ Balloony Regular font loaded - Start typing!');

            // Enable text input once font is loaded
            const textInput = document.getElementById('text-input');
            textInput.disabled = false;
            textInput.placeholder = "Type letters...";
            textInput.value = ""; // Clear initial value
            textInput.focus(); // Auto-focus for typing
        },
        undefined,
        function(error) {
            console.error('❌ Error loading Balloony font:', error);
            alert('Font loading failed. Please refresh the page.');
        }
    );
}

// ========== BALLOON MATERIAL CREATION ==========
function createBalloonMaterial(colorIndex) {
    // Get color from palette, cycling through if index exceeds palette length
    const palette = InflatableText.settings.letterColors;
    const colorHex = palette[colorIndex % palette.length];
    const color = new THREE.Color(colorHex);

    const material = new THREE.MeshPhysicalMaterial({
        color: color,
        metalness: 0.1,
        roughness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        envMap: InflatableText.settings.useEnvMap ? InflatableText.settings.environmentMap : null,
        envMapIntensity: 1.0
    });

    return material;
}

// ========== CREATE INDIVIDUAL LETTER MESH ==========
function createLetterMesh(char, letterIndex, gridPosition = null) {
    if (!InflatableText.font) {
        console.warn('⚠️ Font not loaded yet');
        return null;
    }

    let spawnX, spawnY;

    if (gridPosition) {
        // Use grid position (from text layout)
        spawnX = gridPosition.x;
        spawnY = gridPosition.y;
    } else {
        // Calculate random spawn position around center (fallback)
        const angle = Math.random() * Math.PI * 2;
        const radius = InflatableText.settings.spawnRadius;
        spawnX = Math.cos(angle) * radius;
        spawnY = Math.sin(angle) * radius;
    }

    // Create letter object to track animation state
    const letterObj = {
        char: char,
        mesh: null,

        // Inflation animation (ONLY thing that animates during spawn)
        currentBevelThickness: 0,
        currentBevelSize: 0,
        inflation: 0, // 0 to 1
        isInflating: true,

        // Physics
        velocity: {
            x: 0,
            y: 0,
            z: 0
        },
        position: {
            x: spawnX,
            y: spawnY,
            z: 0
        }
    };

    // Create initial geometry with 0 bevel (flat)
    const geometry = createLetterGeometry(char, 0, 0);

    // Create material with color from palette, cycling through based on letter index
    const material = createBalloonMaterial(letterIndex);

    // Create mesh
    letterObj.mesh = new THREE.Mesh(geometry, material);
    letterObj.mesh.position.set(letterObj.position.x, letterObj.position.y, letterObj.position.z);
    letterObj.mesh.castShadow = true;
    letterObj.mesh.receiveShadow = true;

    // Add to scene
    InflatableText.scene.add(letterObj.mesh);

    console.log('✅ Letter created:', char);
    return letterObj;
}

// ========== CREATE LETTER GEOMETRY ==========
function createLetterGeometry(char, bevelThickness, bevelSize) {
    const geometry = new THREE.TextGeometry(char, {
        font: InflatableText.font,
        size: InflatableText.settings.fontSize,
        height: InflatableText.settings.fontSize * InflatableText.settings.extrudeDepth,
        curveSegments: InflatableText.settings.curveSegments,
        bevelEnabled: true,
        bevelThickness: InflatableText.settings.fontSize * bevelThickness,
        bevelSize: InflatableText.settings.fontSize * bevelSize,
        bevelSegments: InflatableText.settings.bevelSegments
    });

    geometry.computeBoundingBox();

    // Fix inverted normals
    const index = geometry.index;
    if (index) {
        const indices = index.array;
        for (let i = 0; i < indices.length; i += 3) {
            const temp = indices[i];
            indices[i] = indices[i + 2];
            indices[i + 2] = temp;
        }
        index.needsUpdate = true;
    }

    geometry.computeVertexNormals();
    geometry.center();

    return geometry;
}

// ========== UPDATE ALL LETTERS ==========
function updateLetters(deltaTime) {
    const bounds = InflatableText.canvasBounds;

    InflatableText.letterMeshes.forEach(letterObj => {
        // INFLATION ANIMATION (plays once on spawn)
        if (letterObj.isInflating) {
            letterObj.inflation += deltaTime * InflatableText.settings.inflationSpeed;

            if (letterObj.inflation >= 1.0) {
                letterObj.inflation = 1.0;
                letterObj.isInflating = false; // Stop inflating
            }

            // Ease-out cubic
            const easedInflation = 1 - Math.pow(1 - letterObj.inflation, 3);

            // Animate bevel from 0 to target values
            letterObj.currentBevelThickness = easedInflation * InflatableText.settings.targetBevelThickness;
            letterObj.currentBevelSize = easedInflation * InflatableText.settings.targetBevelSize;

            // Rebuild geometry
            const oldGeometry = letterObj.mesh.geometry;
            letterObj.mesh.geometry = createLetterGeometry(
                letterObj.char,
                letterObj.currentBevelThickness,
                letterObj.currentBevelSize
            );
            oldGeometry.dispose();
        }

        // PHYSICS (gravity and boundary collision)
        // Apply gravity
        letterObj.velocity.y -= InflatableText.settings.gravity * deltaTime * 60;

        // Update position
        letterObj.position.x += letterObj.velocity.x * deltaTime * 60;
        letterObj.position.y += letterObj.velocity.y * deltaTime * 60;

        // Boundary collision with bounce
        if (letterObj.position.x < bounds.minX) {
            letterObj.position.x = bounds.minX;
            letterObj.velocity.x = Math.abs(letterObj.velocity.x) * InflatableText.settings.bounciness;
        } else if (letterObj.position.x > bounds.maxX) {
            letterObj.position.x = bounds.maxX;
            letterObj.velocity.x = -Math.abs(letterObj.velocity.x) * InflatableText.settings.bounciness;
        }

        if (letterObj.position.y < bounds.minY) {
            letterObj.position.y = bounds.minY;
            letterObj.velocity.y = Math.abs(letterObj.velocity.y) * InflatableText.settings.bounciness;
        } else if (letterObj.position.y > bounds.maxY) {
            letterObj.position.y = bounds.maxY;
            letterObj.velocity.y = -Math.abs(letterObj.velocity.y) * InflatableText.settings.bounciness;
        }

        // Update mesh position
        letterObj.mesh.position.x = letterObj.position.x;
        letterObj.mesh.position.y = letterObj.position.y;
    });

    // Letter-to-letter collision detection
    for (let i = 0; i < InflatableText.letterMeshes.length; i++) {
        for (let j = i + 1; j < InflatableText.letterMeshes.length; j++) {
            const letterA = InflatableText.letterMeshes[i];
            const letterB = InflatableText.letterMeshes[j];

            // Calculate distance between letters
            const dx = letterB.position.x - letterA.position.x;
            const dy = letterB.position.y - letterA.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Collision radius based on font size and collider size setting
            const collisionRadius = InflatableText.settings.fontSize * InflatableText.settings.colliderSize;
            const minDistance = collisionRadius * 2;

            // Check for collision
            if (distance < minDistance && distance > 0) {
                // Calculate collision normal
                const nx = dx / distance;
                const ny = dy / distance;

                // Separate overlapping letters
                const overlap = minDistance - distance;
                const separationX = nx * overlap * 0.5;
                const separationY = ny * overlap * 0.5;

                letterA.position.x -= separationX;
                letterA.position.y -= separationY;
                letterB.position.x += separationX;
                letterB.position.y += separationY;

                // Calculate relative velocity
                const dvx = letterB.velocity.x - letterA.velocity.x;
                const dvy = letterB.velocity.y - letterA.velocity.y;
                const relativeVelocity = dvx * nx + dvy * ny;

                // Only resolve if letters are moving towards each other
                if (relativeVelocity < 0) {
                    // Apply collision response with bounciness
                    const impulse = relativeVelocity * InflatableText.settings.bounciness;
                    letterA.velocity.x -= impulse * nx;
                    letterA.velocity.y -= impulse * ny;
                    letterB.velocity.x += impulse * nx;
                    letterB.velocity.y += impulse * ny;
                }
            }
        }
    }
}

// ========== ANIMATION LOOP ==========
let lastTime = Date.now();

function animate() {
    requestAnimationFrame(animate);

    const currentTime = Date.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Update orbit controls
    if (InflatableText.controls) {
        InflatableText.controls.update();
    }

    // Update all letter animations
    updateLetters(deltaTime);

    // Render scene
    InflatableText.renderer.render(InflatableText.scene, InflatableText.camera);
}

// ========== UI CONTROLS ==========
function setupControls() {
    // Text input - creates new letter on each keystroke
    const textInput = document.getElementById('text-input');

    textInput.addEventListener('input', (e) => {
        const text = e.target.value.toUpperCase();

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
        const lines = text.split('\n');

        // Calculate grid layout parameters
        const bounds = InflatableText.canvasBounds;
        const boxWidth = bounds.maxX - bounds.minX;
        const boxHeight = bounds.maxY - bounds.minY;

        // Find the longest line for width calculation
        const maxLineLength = Math.max(...lines.map(line => line.length));
        if (maxLineLength === 0) return;

        // Calculate letter spacing using settings
        let letterWidth, letterHeight;

        if (InflatableText.settings.autoSpacing) {
            // Automatic spacing based on font size
            letterWidth = InflatableText.settings.fontSize * 1.2; // 120% of font size
            letterHeight = InflatableText.settings.fontSize * 1.5; // 150% of font size for line height
        } else {
            // Manual spacing using sliders
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

                    // Create environment map from the same texture if enabled
                    if (InflatableText.settings.useEnvMap) {
                        const pmremGenerator = new THREE.PMREMGenerator(InflatableText.renderer);
                        pmremGenerator.compileEquirectangularShader();
                        InflatableText.settings.environmentMap = pmremGenerator.fromEquirectangular(texture).texture;
                        pmremGenerator.dispose();
                        updateAllMaterialsEnvMap();
                    }

                    updateSceneBackground();
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
            InflatableText.settings.environmentMap = null;
            bgImage.value = ''; // Reset file input
            bgImageOptions.style.display = 'none'; // Hide options
            updateSceneBackground();
            updateAllMaterialsEnvMap();
        });
    }

    // Transparent background toggle
    const transparentBg = document.getElementById('transparent-bg');
    transparentBg.addEventListener('change', (e) => {
        InflatableText.settings.transparentBg = e.target.checked;
        updateSceneBackground();
    });

    // Use background as environment map toggle
    const useEnvMap = document.getElementById('use-env-map');
    useEnvMap.addEventListener('change', (e) => {
        InflatableText.settings.useEnvMap = e.target.checked;

        if (e.target.checked && InflatableText.settings.backgroundImage) {
            // Create environment map from existing background image
            const pmremGenerator = new THREE.PMREMGenerator(InflatableText.renderer);
            pmremGenerator.compileEquirectangularShader();
            InflatableText.settings.environmentMap = pmremGenerator.fromEquirectangular(InflatableText.settings.backgroundImage).texture;
            pmremGenerator.dispose();
        } else {
            // Clear environment map
            InflatableText.settings.environmentMap = null;
        }

        updateAllMaterialsEnvMap();
    });

    // Replay button - restart all animations
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            InflatableText.letterMeshes.forEach(letterObj => {
                letterObj.inflation = 0;
                letterObj.currentBevelThickness = 0;
                letterObj.currentBevelSize = 0;
                letterObj.isInflating = true;
                letterObj.floatTime = 0;
            });
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

// ========== UPDATE ENVIRONMENT MAP ON ALL MATERIALS ==========
function updateAllMaterialsEnvMap() {
    InflatableText.letterMeshes.forEach(letterObj => {
        if (letterObj.mesh && letterObj.mesh.material) {
            letterObj.mesh.material.envMap = InflatableText.settings.useEnvMap ? InflatableText.settings.environmentMap : null;
            letterObj.mesh.material.needsUpdate = true;
        }
    });
}


// ========== HIGH-RES EXPORT (REQUIRED FOR CHATOOLY) ==========
window.renderHighResolution = function(targetCanvas, scale) {
    if (!InflatableText.isInitialized) {
        console.warn('Tool not ready for high-res export');
        return;
    }

    // Save original size
    const originalWidth = InflatableText.renderer.domElement.width;
    const originalHeight = InflatableText.renderer.domElement.height;

    // Set high-res size
    const newWidth = originalWidth * scale;
    const newHeight = originalHeight * scale;

    InflatableText.renderer.setSize(newWidth, newHeight, false);
    InflatableText.camera.aspect = newWidth / newHeight;
    InflatableText.camera.updateProjectionMatrix();

    // Render high-res frame
    InflatableText.renderer.render(InflatableText.scene, InflatableText.camera);

    // Copy to target canvas
    const ctx = targetCanvas.getContext('2d');
    targetCanvas.width = newWidth;
    targetCanvas.height = newHeight;

    // Clear canvas with transparency if transparent background is enabled
    if (InflatableText.settings.transparentBg) {
        ctx.clearRect(0, 0, newWidth, newHeight);
    }

    ctx.drawImage(InflatableText.renderer.domElement, 0, 0);

    // Restore original size
    InflatableText.renderer.setSize(originalWidth, originalHeight, false);
    InflatableText.camera.aspect = originalWidth / originalHeight;
    InflatableText.camera.updateProjectionMatrix();

    console.log(`High-res export completed at ${scale}x resolution`);
};

// ========== START THE TOOL ==========
window.addEventListener('DOMContentLoaded', init);
