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
    textMesh: null, // Single text mesh instead of array
    textMaterial: null,
    font: null,
    isInitialized: false,
    canvas: null,
    currentText: "HELLO", // Default text

    // Settings
    settings: {
        inflationSpeed: 0.01,
        inflationAmount: 0.5, // Maximum inflation distance (shader uniform value)
        fontSize: 12, // Larger default font size
        backgroundColor: '#000000',

        // Material properties
        metalness: 0.1,
        roughness: 0.2,
        transmission: 0.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        opacity: 0.9,

        // Lighting
        ambientIntensity: 0.4,
        mainLightIntensity: 0.8,
        fillLightIntensity: 0.3,
        rimLightIntensity: 0.4,

        // TextGeometry extrusion parameters - optimized for rounded balloon edges
        extrudeDepth: 0.2, // Shallower extrusion for more balloon-like shape
        curveSegments: 32,
        bevelThickness: 0.4, // Increased for rounder edges
        bevelSize: 0.3, // Increased for rounder edges
        bevelSegments: 16
    },

    // Store light references for runtime updates
    lights: {
        ambient: null,
        main: null,
        fill: null,
        rim: null
    },

    // Animation state
    inflation: 0,
    targetInflation: 1.0
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
    InflatableText.scene.background = new THREE.Color(InflatableText.settings.backgroundColor);

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

    // Load font and create initial text
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

// ========== REMOVED: Physics boundaries (no longer needed) ==========

// ========== FONT LOADING ==========
function loadFont() {
    const loader = new THREE.FontLoader();

    // Load Balloony Regular JSON font
    loader.load(
        'fonts/Balloony_Regular.json',
        function(font) {
            InflatableText.font = font;
            console.log('✅ Balloony Regular font loaded - Ready to create text!');

            // Create initial text
            createText(InflatableText.currentText);

            // Enable text input once font is loaded
            const textInput = document.getElementById('text-input');
            textInput.disabled = false;
            textInput.placeholder = "Enter your text...";
        },
        undefined,
        function(error) {
            console.error('❌ Error loading Balloony font:', error);
            console.log('Trying Game Bubble fallback...');

            // Fallback to Game Bubble if Balloony fails
            loader.load(
                'fonts/Game Bubble_Regular.json',
                function(font) {
                    InflatableText.font = font;
                    console.log('✅ Game Bubble font loaded (fallback)');

                    createText(InflatableText.currentText);

                    const textInput = document.getElementById('text-input');
                    textInput.disabled = false;
                    textInput.placeholder = "Enter your text...";
                },
                undefined,
                function(fallbackError) {
                    console.error('❌ Fallback font also failed:', fallbackError);
                    alert('Font loading failed. Please refresh the page.');
                }
            );
        }
    );
}

// ========== BALLOON MATERIAL CREATION (CUSTOM SHADER) ==========
function createBalloonMaterial(hue) {
    // Create realistic balloon material with custom shader for inflation
    const color = new THREE.Color().setHSL(hue, 0.8, 0.6);

    // Custom shader material with inflate uniform
    const material = new THREE.ShaderMaterial({
        uniforms: {
            inflate: { value: 0.0 },
            baseColor: { value: color },
            lightPosition: { value: new THREE.Vector3(10, 20, 10) },
            ambientIntensity: { value: 0.3 },
            diffuseIntensity: { value: 0.7 },
            specularIntensity: { value: 0.5 },
            shininess: { value: 32.0 }
        },
        vertexShader: `
            uniform float inflate;
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                vNormal = normalize(normalMatrix * normal);

                // Push vertices along their normals for inflation effect
                vec3 inflatedPosition = position + normal * inflate;
                vPosition = (modelViewMatrix * vec4(inflatedPosition, 1.0)).xyz;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(inflatedPosition, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 baseColor;
            uniform vec3 lightPosition;
            uniform float ambientIntensity;
            uniform float diffuseIntensity;
            uniform float specularIntensity;
            uniform float shininess;

            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                // Normalize interpolated normal
                vec3 normal = normalize(vNormal);

                // Ambient lighting
                vec3 ambient = baseColor * ambientIntensity;

                // Diffuse lighting (Lambertian)
                vec3 lightDir = normalize(lightPosition - vPosition);
                float diff = max(dot(normal, lightDir), 0.0);
                vec3 diffuse = baseColor * diff * diffuseIntensity;

                // Specular lighting (Blinn-Phong for balloon shine)
                vec3 viewDir = normalize(-vPosition);
                vec3 halfDir = normalize(lightDir + viewDir);
                float spec = pow(max(dot(normal, halfDir), 0.0), shininess);
                vec3 specular = vec3(1.0) * spec * specularIntensity;

                // Rim lighting for balloon edge glow
                float rimPower = 1.0 - max(0.0, dot(viewDir, normal));
                vec3 rim = baseColor * pow(rimPower, 3.0) * 0.5;

                // Combine all lighting components
                vec3 finalColor = ambient + diffuse + specular + rim;

                gl_FragColor = vec4(finalColor, 0.9);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    return material;
}

// ========== CREATE/UPDATE TEXT MESH ==========
function createText(text) {
    if (!InflatableText.font) {
        console.warn('⚠️ Font not loaded yet - please wait for font to load');
        return;
    }

    // Remove existing text mesh if present
    if (InflatableText.textMesh) {
        InflatableText.scene.remove(InflatableText.textMesh);
        InflatableText.textMesh.geometry.dispose();
        if (InflatableText.textMaterial) {
            // Don't dispose material, we'll reuse it
        }
    }

    // Create text geometry with current settings
    const textGeometry = new THREE.TextGeometry(text, {
        font: InflatableText.font,
        size: InflatableText.settings.fontSize,
        height: InflatableText.settings.fontSize * InflatableText.settings.extrudeDepth,
        curveSegments: InflatableText.settings.curveSegments,
        bevelEnabled: true,
        bevelThickness: InflatableText.settings.fontSize * InflatableText.settings.bevelThickness,
        bevelSize: InflatableText.settings.fontSize * InflatableText.settings.bevelSize,
        bevelSegments: InflatableText.settings.bevelSegments
    });

    // Compute geometry
    textGeometry.computeBoundingBox();

    // Fix inverted normals
    const index = textGeometry.index;
    if (index) {
        const indices = index.array;
        for (let i = 0; i < indices.length; i += 3) {
            const temp = indices[i];
            indices[i] = indices[i + 2];
            indices[i + 2] = temp;
        }
        index.needsUpdate = true;
    }

    textGeometry.computeVertexNormals();
    textGeometry.center();

    // Create or reuse material
    if (!InflatableText.textMaterial) {
        const hue = Math.random();
        InflatableText.textMaterial = createBalloonMaterial(hue);
    }

    // Create mesh
    InflatableText.textMesh = new THREE.Mesh(textGeometry, InflatableText.textMaterial);
    InflatableText.textMesh.position.set(0, 0, 0);
    InflatableText.textMesh.castShadow = true;
    InflatableText.textMesh.receiveShadow = true;

    // Add to scene
    InflatableText.scene.add(InflatableText.textMesh);

    // Reset inflation animation
    InflatableText.inflation = 0;

    console.log('✅ Text created:', text);
}

// ========== UPDATE TEXT INFLATION ==========
function updateInflation(deltaTime) {
    // Animate inflation
    if (InflatableText.inflation < InflatableText.targetInflation) {
        InflatableText.inflation += deltaTime * InflatableText.settings.inflationSpeed;
        InflatableText.inflation = Math.min(InflatableText.inflation, InflatableText.targetInflation);

        // Apply easing (ease-out) for smooth inflation
        const easedInflation = 1 - Math.pow(1 - InflatableText.inflation, 3);

        // Update shader uniform
        if (InflatableText.textMaterial && InflatableText.textMaterial.uniforms) {
            InflatableText.textMaterial.uniforms.inflate.value = easedInflation * InflatableText.settings.inflationAmount;
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

    // Update inflation animation
    updateInflation(deltaTime);

    // Render scene
    InflatableText.renderer.render(InflatableText.scene, InflatableText.camera);
}

// ========== UI CONTROLS ==========
function setupControls() {
    // Text input - updates on Enter or blur
    const textInput = document.getElementById('text-input');

    const updateText = () => {
        const text = textInput.value.trim().toUpperCase();
        if (text && text !== InflatableText.currentText) {
            InflatableText.currentText = text;
            createText(text);
        }
    };

    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            updateText();
        }
    });

    textInput.addEventListener('blur', updateText);

    // Background color
    const bgColor = document.getElementById('bg-color');
    bgColor.addEventListener('input', (e) => {
        InflatableText.settings.backgroundColor = e.target.value;
        InflatableText.scene.background = new THREE.Color(e.target.value);
    });

    // Font size - rebuilds text geometry
    const fontSize = document.getElementById('font-size');
    const fontSizeInput = document.getElementById('font-size-input');
    fontSize.addEventListener('input', (e) => {
        InflatableText.settings.fontSize = parseFloat(e.target.value);
        fontSizeInput.value = e.target.value;
        createText(InflatableText.currentText);
    });
    fontSizeInput.addEventListener('input', (e) => {
        InflatableText.settings.fontSize = parseFloat(e.target.value);
        fontSize.value = e.target.value;
        createText(InflatableText.currentText);
    });

    // Inflation amount - updates shader immediately
    const inflationAmount = document.getElementById('inflation-amount');
    const inflationAmountInput = document.getElementById('inflation-amount-input');
    inflationAmount.addEventListener('input', (e) => {
        InflatableText.settings.inflationAmount = parseFloat(e.target.value);
        inflationAmountInput.value = e.target.value;
        // Update shader immediately if fully inflated
        if (InflatableText.textMaterial && InflatableText.inflation >= InflatableText.targetInflation) {
            InflatableText.textMaterial.uniforms.inflate.value = InflatableText.settings.inflationAmount;
        }
    });
    inflationAmountInput.addEventListener('input', (e) => {
        InflatableText.settings.inflationAmount = parseFloat(e.target.value);
        inflationAmount.value = e.target.value;
        // Update shader immediately if fully inflated
        if (InflatableText.textMaterial && InflatableText.inflation >= InflatableText.targetInflation) {
            InflatableText.textMaterial.uniforms.inflate.value = InflatableText.settings.inflationAmount;
        }
    });

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

    // REMOVED: Spawn delay, gravity, bounciness (no longer using physics)

    // Material controls
    const metalness = document.getElementById('metalness');
    const metalnessInput = document.getElementById('metalness-input');
    metalness.addEventListener('input', (e) => {
        InflatableText.settings.metalness = parseFloat(e.target.value);
        metalnessInput.value = e.target.value;
        updateAllMaterials();
    });
    metalnessInput.addEventListener('input', (e) => {
        InflatableText.settings.metalness = parseFloat(e.target.value);
        metalness.value = e.target.value;
        updateAllMaterials();
    });

    const roughness = document.getElementById('roughness');
    const roughnessInput = document.getElementById('roughness-input');
    roughness.addEventListener('input', (e) => {
        InflatableText.settings.roughness = parseFloat(e.target.value);
        roughnessInput.value = e.target.value;
        updateAllMaterials();
    });
    roughnessInput.addEventListener('input', (e) => {
        InflatableText.settings.roughness = parseFloat(e.target.value);
        roughness.value = e.target.value;
        updateAllMaterials();
    });

    const transmission = document.getElementById('transmission');
    const transmissionInput = document.getElementById('transmission-input');
    transmission.addEventListener('input', (e) => {
        InflatableText.settings.transmission = parseFloat(e.target.value);
        transmissionInput.value = e.target.value;
        updateAllMaterials();
    });
    transmissionInput.addEventListener('input', (e) => {
        InflatableText.settings.transmission = parseFloat(e.target.value);
        transmission.value = e.target.value;
        updateAllMaterials();
    });

    const clearcoat = document.getElementById('clearcoat');
    const clearcoatInput = document.getElementById('clearcoat-input');
    clearcoat.addEventListener('input', (e) => {
        InflatableText.settings.clearcoat = parseFloat(e.target.value);
        clearcoatInput.value = e.target.value;
        updateAllMaterials();
    });
    clearcoatInput.addEventListener('input', (e) => {
        InflatableText.settings.clearcoat = parseFloat(e.target.value);
        clearcoat.value = e.target.value;
        updateAllMaterials();
    });

    const clearcoatRoughness = document.getElementById('clearcoat-roughness');
    const clearcoatRoughnessInput = document.getElementById('clearcoat-roughness-input');
    clearcoatRoughness.addEventListener('input', (e) => {
        InflatableText.settings.clearcoatRoughness = parseFloat(e.target.value);
        clearcoatRoughnessInput.value = e.target.value;
        updateAllMaterials();
    });
    clearcoatRoughnessInput.addEventListener('input', (e) => {
        InflatableText.settings.clearcoatRoughness = parseFloat(e.target.value);
        clearcoatRoughness.value = e.target.value;
        updateAllMaterials();
    });

    const opacity = document.getElementById('opacity');
    const opacityInput = document.getElementById('opacity-input');
    opacity.addEventListener('input', (e) => {
        InflatableText.settings.opacity = parseFloat(e.target.value);
        opacityInput.value = e.target.value;
        updateAllMaterials();
    });
    opacityInput.addEventListener('input', (e) => {
        InflatableText.settings.opacity = parseFloat(e.target.value);
        opacity.value = e.target.value;
        updateAllMaterials();
    });

    // Lighting controls
    const ambientLight = document.getElementById('ambient-light');
    const ambientLightInput = document.getElementById('ambient-light-input');
    ambientLight.addEventListener('input', (e) => {
        InflatableText.settings.ambientIntensity = parseFloat(e.target.value);
        ambientLightInput.value = e.target.value;
        if (InflatableText.lights.ambient) {
            InflatableText.lights.ambient.intensity = InflatableText.settings.ambientIntensity;
        }
    });
    ambientLightInput.addEventListener('input', (e) => {
        InflatableText.settings.ambientIntensity = parseFloat(e.target.value);
        ambientLight.value = e.target.value;
        if (InflatableText.lights.ambient) {
            InflatableText.lights.ambient.intensity = InflatableText.settings.ambientIntensity;
        }
    });

    const mainLight = document.getElementById('main-light');
    const mainLightInput = document.getElementById('main-light-input');
    mainLight.addEventListener('input', (e) => {
        InflatableText.settings.mainLightIntensity = parseFloat(e.target.value);
        mainLightInput.value = e.target.value;
        if (InflatableText.lights.main) {
            InflatableText.lights.main.intensity = InflatableText.settings.mainLightIntensity;
        }
    });
    mainLightInput.addEventListener('input', (e) => {
        InflatableText.settings.mainLightIntensity = parseFloat(e.target.value);
        mainLight.value = e.target.value;
        if (InflatableText.lights.main) {
            InflatableText.lights.main.intensity = InflatableText.settings.mainLightIntensity;
        }
    });

    const fillLight = document.getElementById('fill-light');
    const fillLightInput = document.getElementById('fill-light-input');
    fillLight.addEventListener('input', (e) => {
        InflatableText.settings.fillLightIntensity = parseFloat(e.target.value);
        fillLightInput.value = e.target.value;
        if (InflatableText.lights.fill) {
            InflatableText.lights.fill.intensity = InflatableText.settings.fillLightIntensity;
        }
    });
    fillLightInput.addEventListener('input', (e) => {
        InflatableText.settings.fillLightIntensity = parseFloat(e.target.value);
        fillLight.value = e.target.value;
        if (InflatableText.lights.fill) {
            InflatableText.lights.fill.intensity = InflatableText.settings.fillLightIntensity;
        }
    });

    const rimLight = document.getElementById('rim-light');
    const rimLightInput = document.getElementById('rim-light-input');
    rimLight.addEventListener('input', (e) => {
        InflatableText.settings.rimLightIntensity = parseFloat(e.target.value);
        rimLightInput.value = e.target.value;
        if (InflatableText.lights.rim) {
            InflatableText.lights.rim.intensity = InflatableText.settings.rimLightIntensity;
        }
    });
    rimLightInput.addEventListener('input', (e) => {
        InflatableText.settings.rimLightIntensity = parseFloat(e.target.value);
        rimLight.value = e.target.value;
        if (InflatableText.lights.rim) {
            InflatableText.lights.rim.intensity = InflatableText.settings.rimLightIntensity;
        }
    });

    // Main Light Position
    const mainLightX = document.getElementById('main-light-x');
    const mainLightXInput = document.getElementById('main-light-x-input');
    mainLightX.addEventListener('input', (e) => {
        mainLightXInput.value = e.target.value;
        if (InflatableText.lights.main) {
            InflatableText.lights.main.position.x = parseFloat(e.target.value);
        }
    });
    mainLightXInput.addEventListener('input', (e) => {
        mainLightX.value = e.target.value;
        if (InflatableText.lights.main) {
            InflatableText.lights.main.position.x = parseFloat(e.target.value);
        }
    });

    const mainLightY = document.getElementById('main-light-y');
    const mainLightYInput = document.getElementById('main-light-y-input');
    mainLightY.addEventListener('input', (e) => {
        mainLightYInput.value = e.target.value;
        if (InflatableText.lights.main) {
            InflatableText.lights.main.position.y = parseFloat(e.target.value);
        }
    });
    mainLightYInput.addEventListener('input', (e) => {
        mainLightY.value = e.target.value;
        if (InflatableText.lights.main) {
            InflatableText.lights.main.position.y = parseFloat(e.target.value);
        }
    });

    const mainLightZ = document.getElementById('main-light-z');
    const mainLightZInput = document.getElementById('main-light-z-input');
    mainLightZ.addEventListener('input', (e) => {
        mainLightZInput.value = e.target.value;
        if (InflatableText.lights.main) {
            InflatableText.lights.main.position.z = parseFloat(e.target.value);
        }
    });
    mainLightZInput.addEventListener('input', (e) => {
        mainLightZ.value = e.target.value;
        if (InflatableText.lights.main) {
            InflatableText.lights.main.position.z = parseFloat(e.target.value);
        }
    });

    // Fill Light Position
    const fillLightX = document.getElementById('fill-light-x');
    const fillLightXInput = document.getElementById('fill-light-x-input');
    fillLightX.addEventListener('input', (e) => {
        fillLightXInput.value = e.target.value;
        if (InflatableText.lights.fill) {
            InflatableText.lights.fill.position.x = parseFloat(e.target.value);
        }
    });
    fillLightXInput.addEventListener('input', (e) => {
        fillLightX.value = e.target.value;
        if (InflatableText.lights.fill) {
            InflatableText.lights.fill.position.x = parseFloat(e.target.value);
        }
    });

    const fillLightY = document.getElementById('fill-light-y');
    const fillLightYInput = document.getElementById('fill-light-y-input');
    fillLightY.addEventListener('input', (e) => {
        fillLightYInput.value = e.target.value;
        if (InflatableText.lights.fill) {
            InflatableText.lights.fill.position.y = parseFloat(e.target.value);
        }
    });
    fillLightYInput.addEventListener('input', (e) => {
        fillLightY.value = e.target.value;
        if (InflatableText.lights.fill) {
            InflatableText.lights.fill.position.y = parseFloat(e.target.value);
        }
    });

    const fillLightZ = document.getElementById('fill-light-z');
    const fillLightZInput = document.getElementById('fill-light-z-input');
    fillLightZ.addEventListener('input', (e) => {
        fillLightZInput.value = e.target.value;
        if (InflatableText.lights.fill) {
            InflatableText.lights.fill.position.z = parseFloat(e.target.value);
        }
    });
    fillLightZInput.addEventListener('input', (e) => {
        fillLightZ.value = e.target.value;
        if (InflatableText.lights.fill) {
            InflatableText.lights.fill.position.z = parseFloat(e.target.value);
        }
    });

    // Rim Light Position
    const rimLightX = document.getElementById('rim-light-x');
    const rimLightXInput = document.getElementById('rim-light-x-input');
    rimLightX.addEventListener('input', (e) => {
        rimLightXInput.value = e.target.value;
        if (InflatableText.lights.rim) {
            InflatableText.lights.rim.position.x = parseFloat(e.target.value);
        }
    });
    rimLightXInput.addEventListener('input', (e) => {
        rimLightX.value = e.target.value;
        if (InflatableText.lights.rim) {
            InflatableText.lights.rim.position.x = parseFloat(e.target.value);
        }
    });

    const rimLightY = document.getElementById('rim-light-y');
    const rimLightYInput = document.getElementById('rim-light-y-input');
    rimLightY.addEventListener('input', (e) => {
        rimLightYInput.value = e.target.value;
        if (InflatableText.lights.rim) {
            InflatableText.lights.rim.position.y = parseFloat(e.target.value);
        }
    });
    rimLightYInput.addEventListener('input', (e) => {
        rimLightY.value = e.target.value;
        if (InflatableText.lights.rim) {
            InflatableText.lights.rim.position.y = parseFloat(e.target.value);
        }
    });

    const rimLightZ = document.getElementById('rim-light-z');
    const rimLightZInput = document.getElementById('rim-light-z-input');
    rimLightZ.addEventListener('input', (e) => {
        rimLightZInput.value = e.target.value;
        if (InflatableText.lights.rim) {
            InflatableText.lights.rim.position.z = parseFloat(e.target.value);
        }
    });
    rimLightZInput.addEventListener('input', (e) => {
        rimLightZ.value = e.target.value;
        if (InflatableText.lights.rim) {
            InflatableText.lights.rim.position.z = parseFloat(e.target.value);
        }
    });

    // 3D Geometry Controls - all rebuild text in real-time
    const extrudeDepth = document.getElementById('extrude-depth');
    const extrudeDepthInput = document.getElementById('extrude-depth-input');
    extrudeDepth.addEventListener('input', (e) => {
        InflatableText.settings.extrudeDepth = parseFloat(e.target.value);
        extrudeDepthInput.value = e.target.value;
        createText(InflatableText.currentText);
    });
    extrudeDepthInput.addEventListener('input', (e) => {
        InflatableText.settings.extrudeDepth = parseFloat(e.target.value);
        extrudeDepth.value = e.target.value;
        createText(InflatableText.currentText);
    });

    const curveSegments = document.getElementById('curve-segments');
    const curveSegmentsInput = document.getElementById('curve-segments-input');
    curveSegments.addEventListener('input', (e) => {
        InflatableText.settings.curveSegments = parseInt(e.target.value);
        curveSegmentsInput.value = e.target.value;
        createText(InflatableText.currentText);
    });
    curveSegmentsInput.addEventListener('input', (e) => {
        InflatableText.settings.curveSegments = parseInt(e.target.value);
        curveSegments.value = e.target.value;
        createText(InflatableText.currentText);
    });

    const bevelThickness = document.getElementById('bevel-thickness');
    const bevelThicknessInput = document.getElementById('bevel-thickness-input');
    bevelThickness.addEventListener('input', (e) => {
        InflatableText.settings.bevelThickness = parseFloat(e.target.value);
        bevelThicknessInput.value = e.target.value;
        createText(InflatableText.currentText);
    });
    bevelThicknessInput.addEventListener('input', (e) => {
        InflatableText.settings.bevelThickness = parseFloat(e.target.value);
        bevelThickness.value = e.target.value;
        createText(InflatableText.currentText);
    });

    const bevelSize = document.getElementById('bevel-size');
    const bevelSizeInput = document.getElementById('bevel-size-input');
    bevelSize.addEventListener('input', (e) => {
        InflatableText.settings.bevelSize = parseFloat(e.target.value);
        bevelSizeInput.value = e.target.value;
        createText(InflatableText.currentText);
    });
    bevelSizeInput.addEventListener('input', (e) => {
        InflatableText.settings.bevelSize = parseFloat(e.target.value);
        bevelSize.value = e.target.value;
        createText(InflatableText.currentText);
    });

    const bevelSegments = document.getElementById('bevel-segments');
    const bevelSegmentsInput = document.getElementById('bevel-segments-input');
    bevelSegments.addEventListener('input', (e) => {
        InflatableText.settings.bevelSegments = parseInt(e.target.value);
        bevelSegmentsInput.value = e.target.value;
        createText(InflatableText.currentText);
    });
    bevelSegmentsInput.addEventListener('input', (e) => {
        InflatableText.settings.bevelSegments = parseInt(e.target.value);
        bevelSegments.value = e.target.value;
        createText(InflatableText.currentText);
    });

    // Reset button - resets text to default
    const resetBtn = document.getElementById('reset-btn');
    resetBtn.addEventListener('click', () => {
        InflatableText.currentText = "HELLO";
        createText(InflatableText.currentText);
        textInput.value = InflatableText.currentText;
    });
}

// ========== REMOVED: updateAllMaterials and updateAllInflation (no longer using letter arrays) ==========

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
    ctx.drawImage(InflatableText.renderer.domElement, 0, 0);

    // Restore original size
    InflatableText.renderer.setSize(originalWidth, originalHeight, false);
    InflatableText.camera.aspect = originalWidth / originalHeight;
    InflatableText.camera.updateProjectionMatrix();

    console.log(`High-res export completed at ${scale}x resolution`);
};

// ========== START THE TOOL ==========
window.addEventListener('DOMContentLoaded', init);
