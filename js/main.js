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
        fontSize: 12,
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

        // Floating animation
        floatSpeed: 0.5,
        floatAmount: 2.0
    },

    // Store light references for runtime updates
    lights: {
        ambient: null,
        main: null,
        fill: null,
        rim: null
    },

    // Letter positioning
    nextLetterX: -20 // Start position for letters
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

    // Load font (don't create initial text)
    loadFont();

    // Setup controls
    setupControls();

    // Listen for canvas resize events
    document.addEventListener('chatooly:canvas-resized', handleCanvasResize);
    window.addEventListener('resize', handleWindowResize);

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
}

function handleWindowResize() {
    const container = document.getElementById('chatooly-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    InflatableText.renderer.setSize(containerWidth, containerHeight);
    InflatableText.camera.aspect = containerWidth / containerHeight;
    InflatableText.camera.updateProjectionMatrix();
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
function createBalloonMaterial(hue) {
    // Create realistic balloon material with standard Three.js material
    const color = new THREE.Color().setHSL(hue, 0.8, 0.6);

    const material = new THREE.MeshPhysicalMaterial({
        color: color,
        metalness: 0.1,
        roughness: 0.2,
        transmission: 0.3,
        thickness: 0.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
        ior: 1.4,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        envMap: InflatableText.settings.useEnvMap ? InflatableText.settings.environmentMap : null,
        envMapIntensity: 1.0
    });

    return material;
}

// ========== CREATE INDIVIDUAL LETTER MESH ==========
function createLetterMesh(char) {
    if (!InflatableText.font) {
        console.warn('⚠️ Font not loaded yet');
        return null;
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

        // Floating animation (starts after inflation)
        floatOffset: Math.random() * Math.PI * 2, // Random phase
        floatTime: 0,
        position: {
            x: InflatableText.nextLetterX,
            y: 0,
            z: 0
        }
    };

    // Create initial geometry with 0 bevel (flat)
    const geometry = createLetterGeometry(char, 0, 0);

    // Create material with random hue
    const hue = Math.random();
    const material = createBalloonMaterial(hue);

    // Create mesh
    letterObj.mesh = new THREE.Mesh(geometry, material);
    letterObj.mesh.position.set(letterObj.position.x, letterObj.position.y, letterObj.position.z);
    letterObj.mesh.castShadow = true;
    letterObj.mesh.receiveShadow = true;

    // Add to scene
    InflatableText.scene.add(letterObj.mesh);

    // Move next letter position to the right
    InflatableText.nextLetterX += InflatableText.settings.fontSize * 1.2;

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

        // FLOATING ANIMATION (starts after inflation)
        if (!letterObj.isInflating) {
            letterObj.floatTime += deltaTime * InflatableText.settings.floatSpeed;

            // Gentle up/down float
            const floatY = Math.sin(letterObj.floatTime + letterObj.floatOffset) * InflatableText.settings.floatAmount;

            // Gentle left/right drift
            const floatX = Math.cos(letterObj.floatTime * 0.5 + letterObj.floatOffset) * InflatableText.settings.floatAmount * 0.5;

            letterObj.mesh.position.y = letterObj.position.y + floatY;
            letterObj.mesh.position.x = letterObj.position.x + floatX;
        }
    });
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
        const newText = e.target.value.toUpperCase();
        const currentLength = InflatableText.letterMeshes.length;

        // If text is longer, add new letters
        if (newText.length > currentLength) {
            for (let i = currentLength; i < newText.length; i++) {
                const char = newText[i];
                if (char.trim()) { // Only create mesh for non-whitespace
                    const letterObj = createLetterMesh(char);
                    if (letterObj) {
                        InflatableText.letterMeshes.push(letterObj);
                    }
                }
            }
        }
        // If text is shorter, remove letters from end
        else if (newText.length < currentLength) {
            const removeCount = currentLength - newText.length;
            for (let i = 0; i < removeCount; i++) {
                const letterObj = InflatableText.letterMeshes.pop();
                if (letterObj && letterObj.mesh) {
                    InflatableText.scene.remove(letterObj.mesh);
                    letterObj.mesh.geometry.dispose();
                    letterObj.mesh.material.dispose();
                }
            }
            // Adjust next position
            if (InflatableText.letterMeshes.length > 0) {
                const lastLetter = InflatableText.letterMeshes[InflatableText.letterMeshes.length - 1];
                InflatableText.nextLetterX = lastLetter.position.x + InflatableText.settings.fontSize * 1.2;
            } else {
                InflatableText.nextLetterX = -20;
            }
        }
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
