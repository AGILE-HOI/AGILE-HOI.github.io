// demo.js
import * as THREE from 'three';
// demo.js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Modular Viewer State ---
let scene, camera, renderer, controls, raycaster, mouse, ambientLight, directionalLight, axesGroup, ground, gridHelper;
let loader = new GLTFLoader();
let currentModel = null;
let currentImage = null;
let cameraFrustums = [];
let currentHoveredFrustum = null;
let currentHoveredMesh = null;
let imageOpacity = 1.0; // Global image opacity state
// Token to identify the latest requested load; incrementing cancels prior loads logically
let _currentLoadToken = 0;

// --- HOI Variables ---
let objectPoses = null;
let currentFrameIndex = 0;
let lastPoseUpdateTime = 0;
let poseUpdateInterval = 1000 / 12; // 12 FPS
let initObjectPosition = null;
let handMeshes = [];
let currentHandMesh = null;
let handMeshesDir = null;

let videoFramesDir = null;
let videoFrames = [];
let currentVideoFrameIndex = 0;

const global_scale = 10.0;

// --- Control Panel Functions ---
function createControlPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Create control panel
    const controlPanel = document.createElement('div');
    controlPanel.id = 'controlPanel';
    // Floating, collapsible control panel inserted into the viewer container (absolute positioning)
    // so it will be subject to the viewer's layout and the viewer CSS exception in rerun-viewer.css.
    // Presentation for #controlPanel is handled in static/css/rerun-viewer.css
    controlPanel.className = 'control-panel';

    controlPanel.innerHTML = `
        <div class="control-header">
            <h3>🎮 Control</h3>
            <button id="controlPanelToggle" class="control-toggle" title="Expand">+</button>
        </div>

        <div class="control-section">
            <h4>🖱️ Mouse</h4>
            <div class="control-note">Rotate • Pan • Zoom • Spin (Key: R)</div>
            <div class="control-note">Double-click → reset view</div>
        </div>

        <div class="control-section">
            <h4>🔘 Buttons</h4>
            <div class="actions-row actions-row-two" style="display:flex; flex-direction:column; gap:6px;">
                <div class="actions-row-top" style="display:flex; gap:8px; align-items:center;">
                    <button id="resetViewBtn" class="action-button" aria-label="Reset view">🏠 <span class="action-text">Reset</span></button>
                </div>
                <div class="actions-row-bottom" style="display:flex; gap:8px; align-items:center;">
                    <button id="toggleAutoRotateBtn" class="action-button" title="Toggle auto-rotate" aria-label="Toggle auto-rotate">🔁 <span class="action-text">Spin</span></button>
                    <button id="toggleFullscreenBtn" class="action-button" title="Toggle fullscreen" aria-label="Toggle fullscreen" style="color: #2b6fb3;">⤢ <span class="action-text">Full</span></button>
                </div>
            </div>
        </div>

        <div class="control-section">
            <h4>🎨 Image</h4>
            <div class="control-label">Opacity: <span id="opacityValue">100%</span></div>
            <input type="range" id="imageOpacitySlider" min="0" max="100" value="100" class="control-range">
        </div>
    `;
    // Insert panel into the viewer container so it participates in the viewer's local stacking/layout
    // and is not affected by global forcing rules. Container is positioned relative in initDemoViewer.
    container.appendChild(controlPanel);

    // Positioning helper: place panel at a small offset inside the container (local coordinates)
    function positionPanel() {
        try {
            const spacing = 8;
            controlPanel.style.left = `${spacing}px`;
            controlPanel.style.top = `${spacing}px`;
            controlPanel.style.opacity = '1';
        } catch (e) {
            controlPanel.style.left = '6px';
            controlPanel.style.top = '6px';
            controlPanel.style.opacity = '1';
        }
    }

    // keep panel aligned on resize/scroll
    const ro = new ResizeObserver(positionPanel);
    try { ro.observe(container); } catch (e) { /* ignore */ }
    window.addEventListener('resize', positionPanel);
    // Do NOT reposition on every scroll; keeping the panel fixed in viewport is preferred so it
    // doesn't follow page scroll. If you want it to stick to the viewer while scrolling, we can
    // re-enable a scroll handler or implement intersection-based visibility.

    // small state for collapsed/expanded — start collapsed by default
    controlPanel.dataset.collapsed = 'true';
    // use CSS collapsed class to hide details
    controlPanel.classList.add('collapsed');
    // mark slider as aria-hidden initially
    const initSlider = document.getElementById('imageOpacitySlider');
    const initSliderLabel = document.getElementById('opacityValue');
    if (initSlider) initSlider.setAttribute('aria-hidden', 'true');

    setupControlPanelEvents();
    // initial position
    positionPanel();
}

function setupControlPanelEvents() {
    // Camera View Button
    // const cameraViewBtn = document.getElementById('cameraViewBtn');
    // if (cameraViewBtn) {
    //     cameraViewBtn.addEventListener('click', () => {
    //         if (cameraFrustums.length > 0) {
    //             controls.autoRotate = false;
    //             const frustum = cameraFrustums[0]; // Go to first camera
    //             if (frustum.userData.isClickable) {
    //                 const startPos = camera.position.clone();
    //                 const startQuat = camera.quaternion.clone();
    //                 const startFov = camera.fov;
    //                 const endPos = frustum.userData.cameraPosition;
    //                 const endQuat = frustum.userData.cameraQuaternion;
    //                 const endFov = frustum.userData.cameraFov;
    //                 animateClientCamera(startPos, startQuat, startFov, endPos, endQuat, endFov, 0.8, frustum);
    //             }
    //         }
    //     });
    // }

    // Reset View Button
    const resetViewBtn = document.getElementById('resetViewBtn');
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => {
            controls.autoRotate = false;
            const startPos = camera.position.clone();
            const startQuat = camera.quaternion.clone();
            const startFov = camera.fov;
            // const endPos = new THREE.Vector3(3, 3, 3);
            const endPos = new THREE.Vector3(0, 0, 0);

            // let targetCenter = new THREE.Vector3(0, 1, 0);
            // if (currentModel) {
            //     let bbox = new THREE.Box3().setFromObject(currentModel);
            //     targetCenter = bbox.getCenter(new THREE.Vector3());
            // }
            let targetCenter = initObjectPosition.clone();

            const tempCam = new THREE.PerspectiveCamera(75, camera.aspect, camera.near, camera.far);
            tempCam.position.copy(endPos);
            tempCam.up.set(0, 1, 0);
            // tempCam.lookAt(targetCenter);
            tempCam.lookAt(0, 0, -1);
            controls.target.copy(targetCenter);
            const endQuat = tempCam.quaternion.clone();
            const endFov = 75;
            
            animateClientCamera(startPos, startQuat, startFov, endPos, endQuat, endFov);

            setTimeout(() => {
                camera.position.copy(endPos);
                camera.quaternion.copy(endQuat);
                camera.fov = endFov;
                camera.up.set(0, 1, 0);
                camera.updateProjectionMatrix();
                controls.target.copy(targetCenter);
                controls.object.up.set(0, 1, 0);
                controls.update();
            }, 850);
        });
    }

    // Axes Toggle (emoji button)
    const toggleAxesBtn = document.getElementById('toggleAxesBtn');
    if (toggleAxesBtn) {
        const updateAxesButton = () => {
            if (!axesGroup) return;
            const on = !!axesGroup.visible;
            toggleAxesBtn.classList.toggle('active', on);
            toggleAxesBtn.classList.toggle('inactive', !on);
            toggleAxesBtn.title = on ? 'Hide axes' : 'Show axes';
        };
        toggleAxesBtn.addEventListener('click', () => {
            if (!axesGroup) return;
            axesGroup.visible = !axesGroup.visible;
            updateAxesButton();
        });
        // initialize state
        updateAxesButton();
    }

    // Auto-rotate Toggle (emoji button)
    const toggleAutoRotateBtn = document.getElementById('toggleAutoRotateBtn');
    if (toggleAutoRotateBtn) {
        const updateAutoRotateButton = () => {
            if (!controls) return;
            const on = !!controls.autoRotate;
            toggleAutoRotateBtn.classList.toggle('active', on);
            toggleAutoRotateBtn.classList.toggle('inactive', !on);
            toggleAutoRotateBtn.title = on ? 'Disable auto-rotate' : 'Enable auto-rotate';
        };
        toggleAutoRotateBtn.addEventListener('click', () => {
            if (!controls) return;
            controls.autoRotate = !controls.autoRotate;
            updateAutoRotateButton();
        });
        // initialize state
        updateAutoRotateButton();
    }

    // Fullscreen Toggle (use the control panel's parent as the viewer container)
    const toggleFullscreenBtn = document.getElementById('toggleFullscreenBtn');
    if (toggleFullscreenBtn) {
        const updateFullscreenButton = () => {
            const controlPanel = document.getElementById('controlPanel');
            const container = controlPanel ? controlPanel.parentElement : document.getElementById('viewer');
            const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
            toggleFullscreenBtn.classList.toggle('active', isFs);
            toggleFullscreenBtn.title = isFs ? 'Exit fullscreen' : 'Enter fullscreen';
            const label = toggleFullscreenBtn.querySelector('.action-text');
            if (label) label.textContent = isFs ? 'Exit' : 'Full';
        };

        toggleFullscreenBtn.addEventListener('click', () => {
            const controlPanel = document.getElementById('controlPanel');
            const container = controlPanel ? controlPanel.parentElement : document.getElementById('viewer');
            if (!container) return;
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (container.requestFullscreen) container.requestFullscreen();
                else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
            // actual button label/state will update on fullscreenchange event
        });

        // init button state
        updateFullscreenButton();
    }

    // Add hover/focus affordance for action buttons (scale + shadow)
    function addButtonAffordance(btn) {
        if (!btn) return;
        // CSS handles transitions and hover/focus states; toggle a helper class for non-CSS states
        const enter = () => btn.classList.add('btn-hover');
        const leave = () => btn.classList.remove('btn-hover');
        btn.addEventListener('mouseenter', enter);
        btn.addEventListener('focus', enter);
        btn.addEventListener('mouseleave', leave);
        btn.addEventListener('blur', leave);
    }

    // Apply affordance to the action buttons
    addButtonAffordance(document.getElementById('resetViewBtn'));
    addButtonAffordance(document.getElementById('cameraViewBtn'));
    addButtonAffordance(document.getElementById('toggleAxesBtn'));
    addButtonAffordance(document.getElementById('toggleAutoRotateBtn'));
    addButtonAffordance(document.getElementById('toggleFullscreenBtn'));

    // Image Opacity Slider
    const imageOpacitySlider = document.getElementById('imageOpacitySlider');
    const opacityValue = document.getElementById('opacityValue');
    if (imageOpacitySlider && opacityValue) {
        imageOpacitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            imageOpacity = value / 100;
            opacityValue.textContent = `${value}%`;
            
            // Update all camera image planes
            scene.traverse(obj => {
                if (obj.userData && obj.userData.isImagePlane && obj.material) {
                    obj.material.opacity = imageOpacity;
                    obj.material.needsUpdate = true;
                }
            });
        });
    }

    // Collapse toggle (panel is appended to body, toggle by changing transform/height)
    const panelToggle = document.getElementById('controlPanelToggle');
    const controlPanel = document.getElementById('controlPanel');
    if (panelToggle && controlPanel) {
        panelToggle.addEventListener('click', () => {
            const collapsed = controlPanel.dataset.collapsed === 'true';
            // helper to hide/show the image opacity slider and other controls
            const slider = document.getElementById('imageOpacitySlider');
            const sliderLabel = document.getElementById('opacityValue');
            if (collapsed) {
                        // expand (use CSS class)
                        controlPanel.classList.remove('collapsed');
                        controlPanel.dataset.collapsed = 'false';
                        panelToggle.textContent = '—';
                        panelToggle.title = 'Collapse';
                        if (slider) slider.removeAttribute('aria-hidden');
                        if (sliderLabel) sliderLabel.removeAttribute('aria-hidden');
            } else {
                        // collapse to header-only: rely on CSS collapsed class
                        controlPanel.classList.add('collapsed');
                        controlPanel.dataset.collapsed = 'true';
                        panelToggle.textContent = '+';
                        panelToggle.title = 'Expand';
                        // mark slider aria-hidden
                        if (slider) slider.setAttribute('aria-hidden', 'true');
                        if (sliderLabel) sliderLabel.setAttribute('aria-hidden', 'true');
            }
        });
    }
}

function updateControlPanelInfo() {
    // Camera and Scene info removed; nothing to update here
}

// Helper: find the viewer container element (parent of control panel) or fallback to #viewer
function getViewerContainer() {
    const controlPanel = document.getElementById('controlPanel');
    if (controlPanel && controlPanel.parentElement) return controlPanel.parentElement;
    return document.getElementById('viewer');
}

// Centralized renderer sizing so canvas resolution matches container or fullscreen
function updateRendererSize() {
    try {
        const container = getViewerContainer() || document.body;
        if (!container || !renderer || !camera) return;
        const rect = container.getBoundingClientRect();
        const w = rect.width > 0 ? rect.width : window.innerWidth;
        const h = rect.height > 0 ? rect.height : window.innerHeight;
        // clamp DPR for performance on very high-DPI displays if desired
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
        // Use integer sizes for the renderer to avoid half-pixel issues
        renderer.setSize(Math.round(w), Math.round(h), false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
    } catch (e) {
        // ignore sizing errors
    }
}

// Ensure renderer resizes when entering/exiting fullscreen
document.addEventListener('fullscreenchange', () => {
    updateRendererSize();
    const btn = document.getElementById('toggleFullscreenBtn');
    if (btn) {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        btn.classList.toggle('active', isFs);
        btn.title = isFs ? 'Exit fullscreen' : 'Enter fullscreen';
        const label = btn.querySelector('.action-text');
        if (label) label.textContent = isFs ? 'Exit' : 'Full';
    }
});
document.addEventListener('webkitfullscreenchange', () => {
    updateRendererSize();
    const btn = document.getElementById('toggleFullscreenBtn');
    if (btn) {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        btn.classList.toggle('active', isFs);
        btn.title = isFs ? 'Exit fullscreen' : 'Enter fullscreen';
        const label = btn.querySelector('.action-text');
        if (label) label.textContent = isFs ? 'Exit' : 'Full';
    }
});

// --- Modular Initialization ---
// 这里是整个 demo 的初始化函数，会被 index.html 调用
export function initDemoViewer({ containerId = 'viewer', galleryId = 'thumbnailGallery', thumbnailList = [] } = {}) {
    // Setup scene, camera, renderer
    // 基础的 three.js 场景初始化
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // 初始化容器
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    container.style.position = 'relative'; // Ensure container is positioned for absolute children
    container.appendChild(renderer.domElement);
    
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.objectFit = 'cover';
    renderer.domElement.style.display = 'block';
    
    // Make renderer match the container size (and handle DPR). This will also be used on
    // window resize and fullscreen changes via updateRendererSize().
    // 初始化渲染器尺寸，确保和容器大小匹配
    updateRendererSize();

    // 相机控制器，默认启用自动旋转
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 100;
    // Enable auto-rotate by default so the scene gently spins on load. Can be toggled in the UI.
    controls.autoRotate = false;
    controls.autoRotateSpeed = 2.5;

        window.addEventListener('keydown', function(e) {
            // R: toggle auto-rotate (replaces Space behavior)
            // R键切换自动旋转
            if (e.code === 'KeyR') {
                if (controls) {
                    controls.autoRotate = !controls.autoRotate;
                    // reflect new state on the UI button if present
                    const toggleAutoRotateBtn = document.getElementById('toggleAutoRotateBtn');
                    if (toggleAutoRotateBtn) {
                        toggleAutoRotateBtn.classList.toggle('active', !!controls.autoRotate);
                        toggleAutoRotateBtn.classList.toggle('inactive', !controls.autoRotate);
                        toggleAutoRotateBtn.title = controls.autoRotate ? 'Disable auto-rotate' : 'Enable auto-rotate';
                    }
                }
            }
        });

    // 初始化射线投射器和鼠标向量
    raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.1;
    mouse = new THREE.Vector2();

    ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    // ambientLight = new THREE.AmbientLight(0xffffff, 8.0);
    scene.add(ambientLight);
    directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    // directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
    // directionalLight.position.set(5, 10, 5);
    directionalLight.position.set(0, 1, 0);
    directionalLight.target.position.set(0, 0, 1);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    axesGroup = createGlobalAxes(0.1);
    axesGroup.visible = false;
    scene.add(axesGroup);

    // camera.position.set(-2, 2, -2);
    // controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 0);  // ← 位置在原点
    camera.up.set(0, 1, 0);        // ← Y 轴向上
    camera.lookAt(0, 0, -1);       // ← 朝向 -Z 方向
    controls.target.set(0, 0, -1); // ← 控制器目标点

    controls.update();

    // Ground plane
    // ground = new THREE.Mesh(
    //     new THREE.PlaneGeometry(10, 10),
    //     new THREE.MeshPhongMaterial({ color: 0xffffff, side: THREE.DoubleSide, shininess: 10, transparent: true, opacity: 0.5 })
    // );
    // ground.rotation.x = -Math.PI / 2;
    // ground.position.y = -0.50;
    // ground.receiveShadow = true;
    // ground.userData.isGround = true;
    // ground.visible = false;
    // scene.add(ground);

    // gridHelper = new THREE.GridHelper(10, 10, 0xd0d0e0, 0xe0e0f0);
    // gridHelper.position.y = -0.49;
    // gridHelper.visible = false;
    // scene.add(gridHelper);

    // Gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const angle = 115 * Math.PI / 180;
    const x1 = 0;
    const y1 = 512;
    const x2 = 512 * Math.cos(angle);
    const y2 = 512 - 512 * Math.sin(angle);
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, '#265073');
    gradient.addColorStop(0.35, 'rgb(59,130,177)');
    gradient.addColorStop(0.65, 'rgb(187,158,166)');
    gradient.addColorStop(0.85, 'rgb(184,108,130)');
    gradient.addColorStop(1, 'rgb(184,108,130)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    const bgTexture = new THREE.CanvasTexture(canvas);
    bgTexture.colorSpace = THREE.SRGBColorSpace;
    bgTexture.minFilter = THREE.LinearFilter;
    bgTexture.magFilter = THREE.LinearFilter;
    // Use a plain, neutral light-gray background for the viewer
    // Use a very light, perceptually neutral gray for the background (5% gray)
    const neutralGray = new THREE.Color(0xf2f2f2); // sRGB ~95% gray
    renderer.setClearColor(neutralGray, 1);
    scene.background = null;
    // scene.background = bgTexture;

    // Create control panel
    createControlPanel(containerId);

    // Animation loop
    // 渲染循环，更新控制器和控制面板信息
    animate();

    window.addEventListener('resize', function() {
        // Recompute sizes based on viewer container / fullscreen state
        updateRendererSize();
    });

    // Double-click camera animation
    // 双击相机动画，通过 raycaster 检测双击位置，
    // 如果是相机视锥体则切换到对应相机位置，否则切换到默认位置
    renderer.domElement.addEventListener('dblclick', function(event) {
       controls.autoRotate = false;
    
        // 始终执行重置相机行为
        const startPos = camera.position.clone();
        const startQuat = camera.quaternion.clone();
        const startFov = camera.fov;
        const endPos = new THREE.Vector3(0, 0, 0);

        let targetCenter = initObjectPosition.clone();

        const tempCam = new THREE.PerspectiveCamera(75, camera.aspect, camera.near, camera.far);
        tempCam.position.copy(endPos);
        tempCam.up.set(0, 1, 0);
        tempCam.lookAt(targetCenter);
        controls.target.copy(targetCenter);
        const endQuat = tempCam.quaternion.clone();
        const endFov = 75;
        
        animateClientCamera(startPos, startQuat, startFov, endPos, endQuat, endFov);

        setTimeout(() => {
            camera.position.copy(endPos);
            camera.quaternion.copy(endQuat);
            camera.fov = endFov;
            camera.up.set(0, 1, 0);
            camera.updateProjectionMatrix();
            controls.target.copy(targetCenter);
            controls.object.up.set(0, 1, 0);
            controls.update();
        }, 850);
    });

    // Pointer move hover effects
    // 指针移动悬停效果，hover 相机视锥体或模型时高亮显示
    raycaster.params.Line.threshold = 0.1;
    renderer.domElement.addEventListener('pointermove', function(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cameraFrustums, true);
        if (intersects.length > 0) {
            let fr = intersects[0].object;
            while (fr.parent && !fr.userData.isFrustum) fr = fr.parent;
            if (fr && fr.userData && fr.userData.isFrustum) {
                if (currentHoveredFrustum !== fr) {
                    if (currentHoveredFrustum) restoreFrustumHover(currentHoveredFrustum);
                    applyFrustumHover(fr);
                    currentHoveredFrustum = fr;
                }
                if (currentHoveredMesh) {
                    restoreMeshHover(currentHoveredMesh);
                    currentHoveredMesh = null;
                }
                return;
            }
        }
        if (currentHoveredFrustum) {
            restoreFrustumHover(currentHoveredFrustum);
            currentHoveredFrustum = null;
        }
        const meshCandidates = [];
        scene.traverse(obj => {
            if (obj.isMesh && !obj.userData.isImagePlane && !obj.userData.isGround) meshCandidates.push(obj);
        });
        const meshIntersects = raycaster.intersectObjects(meshCandidates, true);
        if (meshIntersects.length > 0) {
            const m = meshIntersects[0].object;
            if (currentHoveredMesh !== m) {
                if (currentHoveredMesh) restoreMeshHover(currentHoveredMesh);
                if (!m.userData.isGround) {
                    applyMeshHover(m);
                    currentHoveredMesh = m;
                } else {
                    currentHoveredMesh = null;
                }
            }
            return;
        }
        if (currentHoveredMesh) {
            restoreMeshHover(currentHoveredMesh);
            currentHoveredMesh = null;
        }
    });

    // 清除悬停状态
    renderer.domElement.addEventListener('pointerout', function() {
        if (currentHoveredFrustum) {
            restoreFrustumHover(currentHoveredFrustum);
            currentHoveredFrustum = null;
        }
        if (currentHoveredMesh) {
            restoreMeshHover(currentHoveredMesh);
            currentHoveredMesh = null;
        }
    });

    setupThumbnails(thumbnailList, galleryId);

        if (thumbnailList.length > 0) {
            // After a short delay, mark the first thumbnail active and trigger its click handler
            // using the same DOM event path as a real user click so all handlers run consistently.
            setTimeout(() => {
                const gallery = document.getElementById(galleryId);
                if (gallery) {
                    const first = gallery.querySelector('.rerun-thumbnail');
                    if (first) {
                        // mark active for visual consistency
                        first.classList.add('active');
                        // dispatch a real click event so existing listeners handle loading the scene
                        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
                        first.dispatchEvent(ev);
                    }
                }
            }, 100);
        }
}

// --- Rest of the helper functions remain the same ---
function createGlobalAxes(size = 1.5) {
    const axesGroupLocal = new THREE.Group();
    axesGroupLocal.name = 'globalAxesGroup';
    function addAxisLocal(dir, colorHex, labelText, s = 1.0) {
        const dirVec = new THREE.Vector3(dir[0], dir[1], dir[2]).clone().normalize();
        const arrow = new THREE.ArrowHelper(dirVec, new THREE.Vector3(0, 0, 0), s, colorHex, 0.2 * s, 0.12 * s);
        axesGroupLocal.add(arrow);
        const label = makeLabelSprite(labelText, (colorHex === 0xff0000) ? '#ff0000' : (colorHex === 0x00ff00) ? '#00ff00' : '#00a0ff');
        label.scale.set(0.25 * s, 0.25 * s, 0.25 * s);
        label.position.copy(dirVec.clone().multiplyScalar(s * 1.15));
        axesGroupLocal.add(label);
    }
    addAxisLocal([1, 0, 0], 0xff0000, 'X', size);
    addAxisLocal([0, 1, 0], 0x00ff00, 'Y', size);
    addAxisLocal([0, 0, 1], 0x0066ff, 'Z', size);
    return axesGroupLocal;
}

function makeLabelSprite(text, color = '#ffffff') {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, size, size);
    ctx.font = 'bold 140px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, size / 2, size / 2 + 10);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    return sprite;
}

async function loadGLB(glbPath, transformMatrix = null, scale = 1.0, group = null, entityName = null, loadToken = null) {
    return await new Promise((resolve, reject) => {
        loader.load(
            glbPath,
            function (gltf) {
                let model = gltf.scene;
                model.traverse(function (child) {
                    if (child.isMesh) {
                        child.castShadow = true;
                        if (child.geometry) {
                            const hasNormals = child.geometry.attributes.normal !== undefined;
                            const normalCount = hasNormals ? child.geometry.attributes.normal.count : 0;
                            const vertexCount = child.geometry.attributes.position ? child.geometry.attributes.position.count : 0;
                            
                            // console.log(`  📐 Geometry Info:`, {
                            //     hasNormals: hasNormals,
                            //     normalCount: normalCount,
                            //     vertexCount: vertexCount,
                            //     normalsMatchVertices: hasNormals && normalCount === vertexCount
                            // });
                            
                            // ✅ 如果有法线，打印前3个法线向量作为示例
                            if (hasNormals && normalCount > 0) {
                                const normals = child.geometry.attributes.normal;
                            } else {
                                console.warn(`  ⚠️ No normals found! Computing vertex normals...`);
                                child.geometry.computeVertexNormals();
                                console.log(`  ✅ Vertex normals computed:`, {
                                    normalCount: child.geometry.attributes.normal.count
                                });
                            }
                        }

                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            const newMaterials = materials.map(material => {
                                const newMaterial = new THREE.MeshPhongMaterial({
                                    color: 0xffffff,
                                    specular: 0x111111,
                                    shininess: 30,
                                    emissive: 0x000000,
                                    map: material.map || null,
                                    side: THREE.DoubleSide,
                                });
                                // console.log(`    ✅ New Material (MeshPhongMaterial):`, {
                                //     color: newMaterial.color.getHexString(),
                                //     map: newMaterial.map ? 'yes' : 'no',
                                //     transparent: newMaterial.transparent,
                                //     opacity: newMaterial.opacity,
                                //     side: newMaterial.side === THREE.FrontSide ? 'FrontSide' : 
                                //           newMaterial.side === THREE.BackSide ? 'BackSide' : 
                                //           newMaterial.side === THREE.DoubleSide ? 'DoubleSide' : newMaterial.side,
                                // });
                                return newMaterial;
                            });
                            child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                        }
                    }
                });
                if (transformMatrix) {
                    model.matrixAutoUpdate = false;
                    model.matrix.copy(transformMatrix);
                }
                if (scale !== undefined && scale !== 1.0) {
                    model.scale.set(scale, scale, scale);
                }
                // If a load token is provided and it no longer matches the current token,
                // this load was superseded — dispose model and resolve(null).
                if (loadToken !== null && loadToken !== undefined && loadToken !== _currentLoadToken) {
                    try {
                        model.traverse(c => {
                            if (c.isMesh) {
                                if (c.geometry) c.geometry.dispose();
                                if (c.material) {
                                    if (Array.isArray(c.material)) c.material.forEach(m => { if (m.map) m.map.dispose(); if (m.dispose) m.dispose(); });
                                    else { if (c.material.map) c.material.map.dispose(); if (c.material.dispose) c.material.dispose(); }
                                }
                            }
                        });
                    } catch (e) { /* ignore disposal errors */ }
                    resolve(null);
                    return;
                }

                if (group) {
                    group.add(model);
                } else {
                    scene.add(model);
                    currentModel = model;
                }
                controls.update();
                resolve(model);
            },
            // onProgress
            function (xhr) {
                try {
                    if (xhr && xhr.lengthComputable) {
                        const pct = Math.round((xhr.loaded / xhr.total) * 100);
                        setLoadingProgress(pct, `Loading model (${pct}%)`);
                    } else {
                        // indeterminate progress
                        setLoadingProgress(null, `Loading model…`);
                    }
                } catch (e) {
                    // ignore
                }
            },
            function (error) {
                console.error('Error loading GLB:', error);
                // hideLoadingOverlay();
                reject(error);
            }
        );
    });
}

// Simple loading overlay helpers
let _loadingOverlay = null;
function ensureLoadingOverlay() {
    if (_loadingOverlay) return;
    const wrap = document.createElement('div');
    wrap.id = 'glbLoadingOverlay';

    // If control panel exists, place overlay inside the same container so CSS rules for the viewer apply.
    const controlPanel = document.getElementById('controlPanel');
    let parentEl = document.body;
    let zIndexBase = 2000;
    if (controlPanel && controlPanel.parentElement) {
        parentEl = controlPanel.parentElement; // should be the viewer container
        const z = window.getComputedStyle(controlPanel).zIndex;
        zIndexBase = z && !isNaN(parseInt(z)) ? parseInt(z) : zIndexBase;
    }

    // Positioning and layout handled in CSS (#glbLoadingOverlay).
    // Keep only dynamic z-index so the overlay stacks correctly relative to the control panel.
    wrap.style.zIndex = (zIndexBase - 10).toString();

    const inner = document.createElement('div');
    // Use CSS classes (defined in static/css/rerun-viewer.css) for appearance/positioning
    inner.className = 'glb-loading-inner';
    inner.innerHTML = `
        <div id="glbLoadingText">Loading...</div>
        <div class="glb-loading-track"><div id="glbLoadingBar"></div></div>
    `;

    wrap.appendChild(inner);
    parentEl.appendChild(wrap);
    _loadingOverlay = wrap;
}

function setLoadingProgress(percent, text) {
    ensureLoadingOverlay();
    const txt = document.getElementById('glbLoadingText');
    const bar = document.getElementById('glbLoadingBar');
    if (txt && text) txt.textContent = text;
    if (bar) {
        if (percent === null || percent === undefined) {
            // indeterminate animation
            bar.style.width = '60%';
            bar.style.transition = 'none';
            bar.style.transform = 'translateX(-20%)';
            bar.style.animation = 'glb-indeterminate 1.2s infinite linear';
            if (!document.getElementById('glb-indeterminate-style')) {
                const s = document.createElement('style');
                s.id = 'glb-indeterminate-style';
                s.textContent = `@keyframes glb-indeterminate { 0% { transform: translateX(-40%); } 100% { transform: translateX(200%); } } #glbLoadingBar { will-change: transform; }`;
                // Append style to the parent element when possible so viewer-local CSS can override if needed
                document.head.appendChild(s);
            }
        } else {
            // determinate
            bar.style.animation = '';
            bar.style.transition = 'width 220ms linear';
            bar.style.width = `${Math.max(3, percent)}%`;
        }
    }
}

function hideLoadingOverlay() {
    if (!_loadingOverlay) return;
    try {
        if (_loadingOverlay.parentElement) _loadingOverlay.parentElement.removeChild(_loadingOverlay);
        else _loadingOverlay.remove();
    } catch (e) {}
    _loadingOverlay = null;
    const s = document.getElementById('glb-indeterminate-style');
    if (s) s.remove();
}

async function loadHOIDataFromMetadata(metadata, parentDir, loadToken = null) {
    const object_mesh_path = parentDir + '/object_mesh_scaled.glb';
    const object_poses_path = parentDir + '/object_poses.json';
    const hand_meshes_dir = parentDir + '/hand_meshes';
    const intrinsics_path = parentDir + '/cam_K.json';
    videoFramesDir = parentDir + '/rgb_images';
    handMeshesDir = hand_meshes_dir;

    console.log(`📦 Loading HOI object mesh from ${object_mesh_path}`);
    ensureLoadingOverlay();
    setLoadingProgress(0, `Loading model`);
        
    const loadedModel = await loadGLB(object_mesh_path, null, 1.0, null, null, loadToken);
    if (loadToken !== null && loadToken !== undefined && loadToken !== _currentLoadToken) return;
    // if loadGLB returned null it was superseded
    if (!loadedModel) return;
    currentModel = loadedModel;
    if (loadToken !== null && loadToken !== undefined && loadToken !== _currentLoadToken) return;
    if (!loadedModel) return;

    try {
        const num_frames = metadata['num_frames'];
        console.info(`Total frames to load hand meshes: ${num_frames}`);

        // 清空之前的视频帧
        videoFrames.forEach(tex => {
            if (tex) tex.dispose();
        });
        videoFrames = [];
        
        for (let i = 0; i < num_frames; ++i) {
            const imgPath = `${videoFramesDir}/frame_${String(i).padStart(4, '0')}.png`;
            try {
                const tex = await loadTexture(imgPath);
                // 检查是否被取消
                if (loadToken !== null && loadToken !== undefined && loadToken !== _currentLoadToken) {
                    tex.dispose();
                    return;
                }
                videoFrames.push(tex);
            } catch (err) {
                console.warn(`Failed to load video frame ${i} from ${imgPath}:`, err);
                videoFrames.push(null);
            }
        }
        currentVideoFrameIndex = 0;

        // 清空之前的手部网格
        handMeshes.forEach(hand => {
            if (hand && hand.parent) {
                scene.remove(hand);
                hand.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => {
                                if (m.map) m.map.dispose();
                                if (m.dispose) m.dispose();
                            });
                        } else {
                            if (child.material.map) child.material.map.dispose();
                            if (child.material.dispose) child.material.dispose();
                        }
                    }
                });
            }
        });
        handMeshes = [];
        currentHandMesh = null;

        const res = await fetch(object_poses_path);
        if (res.ok) {
            const poseData = await res.json();
            objectPoses = poseData.object_poses; // [n_frames][4][4]
            currentFrameIndex = 0;

            // ✅ 提取第一帧位置并设置为相机目标
            if (objectPoses.length > 0) {
                const firstPose = objectPoses[0];
                
                // 处理嵌套数组格式
                const flatPose = firstPose.map(row => {
                    if (Array.isArray(row)) {
                        if (row.length === 1) return [row[0], 0, 0, 0];
                        if (row.length === 0) return [0, 0, 0, 1];
                        return row;
                    }
                    return [row, 0, 0, 0];
                });
                
                // 构建 OpenCV 姿态矩阵
                const poseGL = new THREE.Matrix4().set(
                    flatPose[0][0], flatPose[0][1], flatPose[0][2], flatPose[0][3] * global_scale,
                    flatPose[1][0], flatPose[1][1], flatPose[1][2], flatPose[1][3] * global_scale,
                    flatPose[2][0], flatPose[2][1], flatPose[2][2], flatPose[2][3] * global_scale,
                    flatPose[3][0], flatPose[3][1], flatPose[3][2], flatPose[3][3]
                );
                
                // 坐标系转换
                
                // const poseGL = new THREE.Matrix4().multiplyMatrices(world_opencv2gl, poseCV);
                
                // 分解矩阵获取位置
                const scale = new THREE.Vector3();
                const position = new THREE.Vector3();
                const quaternion = new THREE.Quaternion();
                poseGL.decompose(position, quaternion, scale);
                
                const firstPosition = position.clone();
                initObjectPosition = firstPosition.clone();
                
                // ✅ 设置相机控制目标为第一帧位置
                // controls.target.copy(firstPosition);
                controls.update();
            }

            console.log(`🤖 Loaded HOI object poses for ${objectPoses.length} frames from ${object_poses_path}`);
        }
        
        // 并行加载所有手部网格
        const loadPromises = [];
        for (let i = 0; i < num_frames; ++i) {
            const handMeshPath = `${hand_meshes_dir}/hand_${String(i).padStart(4, '0')}.glb`;
            
            // ✅ 每个手部网格使用独立的 group
            const individualGroup = new THREE.Group();
            individualGroup.name = `hand_group_${i}`;
            
            const promise = loadGLB(handMeshPath, null, 1.0, individualGroup, `hand_${i}`, loadToken)
                .then(handMesh => {
                    // 检查是否被取消
                    if (loadToken !== null && loadToken !== undefined && loadToken !== _currentLoadToken) {
                        return null;
                    }
                    
                    if (!handMesh) return null;
                    
                    individualGroup.traverse(child => {
                        if (child.isMesh && child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                mat.side = THREE.DoubleSide;
                                mat.needsUpdate = true;
                            });
                        }
                    });

                    // ✅ 应用变换到 group（不是 mesh）
                    individualGroup.scale.set(global_scale, global_scale, global_scale);
                    const new_position = new THREE.Vector3(
                        individualGroup.position.x * global_scale,
                        individualGroup.position.y * global_scale,
                        individualGroup.position.z * global_scale
                    );
                    individualGroup.position.copy(new_position);
                    individualGroup.visible = false;
                    
                    // ✅ 添加到场景
                    scene.add(individualGroup);
                    
                    return individualGroup;  // ← 返回 group 而不是 mesh
                })
                .catch(err => {
                    console.warn(`Failed to load hand ${i}:`, err);
                    return null;
                });
            
            loadPromises.push(promise);
        }
        
        // 等待所有加载完成
        const loadedHands = await Promise.all(loadPromises);
        
        // 再次检查是否被取消
        if (loadToken !== null && loadToken !== undefined && loadToken !== _currentLoadToken) {
            // 清理已加载的网格
            loadedHands.forEach(hand => {
                if (hand && hand.parent) {
                    scene.remove(hand);
                    hand.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => {
                                    if (m.map) m.map.dispose();
                                    if (m.dispose) m.dispose();
                                });
                            } else {
                                if (child.material.map) child.material.map.dispose();
                                if (child.material.dispose) child.material.dispose();
                            }
                        }
                    });
                }
            });
            return;
        }

        handMeshes = loadedHands.filter(h => h !== null);
        console.log(`✅ Loaded ${handMeshes.length}/${num_frames} hand meshes`);

        const intrinsicRes = await fetch(intrinsics_path);
        if (intrinsicRes.ok) {
            const intrinsicData = await intrinsicRes.json();
            const intrinsic = intrinsicData['intrinsic_matrix']; // [3][3]
            
            // ✅ 从内参计算 FOV 并更新全局相机
            // 假设图像尺寸，如果有具体尺寸可以从 metadata 读取
            const imageWidth = metadata.image_width || 640;
            const imageHeight = metadata.image_height || 480;
            
            const fx = intrinsic[0][0];
            const fy = intrinsic[1][1];
            const cx = intrinsic[0][2];
            const cy = intrinsic[1][2];
            
            // 计算 FOV（垂直视场角）
            const fov = 2 * Math.atan(0.5 * imageHeight / fy) * 180 / Math.PI;
            
            // 更新全局相机的 FOV
            camera.fov = fov;
            camera.aspect = imageWidth / imageHeight;
            
            // 计算主点偏移（像素单位）
            const offsetX = cx - imageWidth / 2;
            const offsetY = cy - imageHeight / 2;
            
            // console.log(`Calculated camera intrinsics: fx=${fx.toFixed(2)}px, fy=${fy.toFixed(2)}px, cx=${cx.toFixed(2)}px, cy=${cy.toFixed(2)}px`);
            // console.log(`Setting camera FOV=${fov.toFixed(2)}°, aspect=${(imageWidth / imageHeight).toFixed(3)}, offsetX=${offsetX.toFixed(2)}px, offsetY=${offsetY.toFixed(2)}px`);

            // 设置 view offset
            camera.setViewOffset(
                imageWidth, 
                imageHeight, 
                -offsetX, 
                -offsetY, 
                imageWidth, 
                imageHeight
            );
            
            // 设置 view offset
            camera.setViewOffset(
                imageWidth, 
                imageHeight, 
                -offsetX, 
                -offsetY, 
                imageWidth, 
                imageHeight
            );
            
            camera.updateProjectionMatrix();
            controls.update();
            
            console.log(`📐 Updated global camera with intrinsics:`, {
                fov: fov.toFixed(2) + '°',
                aspect: (imageWidth / imageHeight).toFixed(3),
                fx: fx.toFixed(2) + 'px',
                fy: fy.toFixed(2) + 'px',
                cx: cx.toFixed(2) + 'px',
                cy: cy.toFixed(2) + 'px'
            });

            // ✅ 添加相机视锥体（不传图片路径，会使用 videoFrames[0]）
            if (intrinsic) {
                console.log('✅ Loaded camera intrinsics from', intrinsics_path);
                await addCameraFrustum(null, null, null);
            }
        }
        
        
    } catch (e) {
        console.warn('Failed to load HOI object poses:', e);
        objectPoses = null;
    }
    hideLoadingOverlay();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateControlPanelInfo();
    
    // 更新物体姿态（应用坐标系转换和缩放）
    if (objectPoses && currentModel && handMeshes.length > 0 && videoFrames.length > 0 && cameraFrustums.length > 0) {
        const currentTime = performance.now();
        if (currentTime - lastPoseUpdateTime >= poseUpdateInterval) {
            lastPoseUpdateTime = currentTime;
            
            // 获取当前帧的变换矩阵
            const poseMatrix = objectPoses[currentFrameIndex];
            
            // 处理嵌套数组格式 [[x], [y], [z], []] → [x, y, z, w]
            const flatPose = poseMatrix.map(row => {
                if (Array.isArray(row)) {
                    if (row.length === 1) return [row[0], 0, 0, 0];  // [[x]] → [x, 0, 0, 0]
                    if (row.length === 0) return [0, 0, 0, 1];       // [] → [0, 0, 0, 1]
                    return row;
                }
                return [row, 0, 0, 0];
            });
            
            // 构建 4x4 姿态矩阵（OpenCV 坐标系）
            const poseGL = new THREE.Matrix4().set(
                flatPose[0][0], flatPose[0][1], flatPose[0][2], flatPose[0][3] * global_scale,
                flatPose[1][0], flatPose[1][1], flatPose[1][2], flatPose[1][3] * global_scale,
                flatPose[2][0], flatPose[2][1], flatPose[2][2], flatPose[2][3] * global_scale,
                flatPose[3][0], flatPose[3][1], flatPose[3][2], flatPose[3][3]
            );

            // 分解矩阵为 position, rotation, scale
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            poseGL.decompose(position, quaternion, scale);
            
            currentModel.scale.set(global_scale, global_scale, global_scale);
            currentModel.position.copy(position);
            currentModel.quaternion.copy(quaternion);
            
            if (handMeshesDir && handMeshes.length > 0) {
                // 隐藏旧的手部网格
                if (currentHandMesh) {
                    currentHandMesh.visible = false;
                }
                currentHandMesh = handMeshes[currentFrameIndex];
                currentHandMesh.visible = true;
            } else {
                console.warn('No hand meshes directory specified or no hand meshes loaded.');
            }

            // ✅ 更新相机视锥体上的图片纹理
            if (videoFrames.length > 0 && cameraFrustums.length > 0) {
                const currentTexture = videoFrames[currentFrameIndex];
                if (currentTexture) {
                    // 遍历所有相机视锥体
                    cameraFrustums.forEach(frustum => {
                        const cam = frustum.userData.camera;
                        if (cam && cam.children && cam.children.length > 0) {
                            // 找到图像平面
                            const imagePlane = cam.children.find(child => 
                                child.userData && child.userData.isImagePlane && child.isMesh
                            );
                            if (imagePlane && imagePlane.material) {
                                // 更新纹理
                                imagePlane.material.map = currentTexture;
                                imagePlane.material.needsUpdate = true;
                            }
                        }
                    });
                }
            }
            
            // 循环播放
            currentFrameIndex = (currentFrameIndex + 1) % objectPoses.length;
        }
    }
    
    renderer.render(scene, camera);
}

async function loadTexture(url) {
    return await new Promise((resolve, reject) => {
        const texLoader = new THREE.TextureLoader();
        texLoader.load(url, (tex) => {
            try {
                if (tex && 'colorSpace' in tex) {
                    tex.colorSpace = THREE.SRGBColorSpace;
                } else if (tex && 'encoding' in tex) {
                    tex.encoding = THREE.sRGBEncoding;
                }
                tex.minFilter = tex.minFilter || THREE.LinearFilter;
                tex.magFilter = tex.magFilter || THREE.LinearFilter;
                tex.needsUpdate = true;
            } catch (e) {
                // ignore and resolve with original texture
            }
            resolve(tex);
        }, undefined, (err) => reject(err));
    });
}

export async function addCameraFrustum(intrinsic, camera_c2w, imagePath) {
    let texture = null;
    let imageWidth = null;
    let imageHeight = null;
    
    // 如果没有提供 intrinsic，从全局 camera 提取参数
    let fx, fy, cx, cy, imgW, imgH;
    
    if (!intrinsic) {
        // 从全局相机的 view offset 反推内参
        const view = camera.view || {
            fullWidth: renderer.domElement.width,
            fullHeight: renderer.domElement.height,
            offsetX: 0,
            offsetY: 0,
            width: renderer.domElement.width,
            height: renderer.domElement.height
        };
        
        imgW = view.fullWidth;
        imgH = view.fullHeight;
        
        // 从 FOV 计算焦距
        const fovRad = (camera.fov * Math.PI) / 180;
        fy = (imgH / 2) / Math.tan(fovRad / 2);
        fx = fy; // 假设像素是正方形的
        
        // 从 view offset 计算主点
        cx = imgW / 2 - view.offsetX;
        cy = imgH / 2 - view.offsetY;
        
        console.log('📷 Using global camera parameters:', {
            fov: camera.fov.toFixed(2) + '°',
            fx: fx.toFixed(2) + 'px',
            fy: fy.toFixed(2) + 'px',
            cx: cx.toFixed(2) + 'px',
            cy: cy.toFixed(2) + 'px',
            size: `${imgW}x${imgH}`
        });
    } else {
        // 使用提供的 intrinsic
        fx = intrinsic[0][0];
        fy = intrinsic[1][1];
        cx = intrinsic[0][2];
        cy = intrinsic[1][2];
    }
    
    if (imagePath) {
        try {
            texture = await loadTexture(imagePath);
            imageWidth = texture.image.width;
            imageHeight = texture.image.height;
        } catch (err) {
            console.warn('Failed to load image, using placeholder size', err);
            imageWidth = imgW || 1024;
            imageHeight = imgH || 1024;
        }
    } else {
        texture = videoFrames.length > 0 ? videoFrames[0] : null;
        if (texture) {
            imageWidth = texture.image.width;
            imageHeight = texture.image.height;
            console.log('Using first video frame as texture for camera frustum');
            console.log(`Image size: ${imageWidth}x${imageHeight}`);
        } else {
            console.warn('No image path or video frames available, using placeholder size');
            imageWidth = imgW || 1024;
            imageHeight = imgH || 1024;
        }
    }
    
    imgW = imageWidth || imgW || 1024;
    imgH = imageHeight || imgH || 1024;
    
    // 后续代码保持不变，使用提取的 fx, fy, cx, cy
    const focal_length_x = fx;
    const focal_length_y = fy;
    const principal_point_x_px = cx;  // 已经是相对于图像的像素坐标
    const principal_point_y_px = cy;  // 已经是相对于图像的像素坐标

    const fov = 2 * Math.atan(0.5 * imgH / focal_length_y) * 180 / Math.PI;
    const aspect = imgW / imgH;
    const near = 0.5;
    const far = 0.500001;
    const cam = new THREE.PerspectiveCamera(fov, aspect, near, far);

    const fullWidth = imgW;
    const fullHeight = imgH;
    const viewWidth = imgW;
    const viewHeight = imgH;

    // 计算偏移：主点相对于图像中心的偏移
    const offsetX = principal_point_x_px - imgW / 2;
    const offsetY = principal_point_y_px - imgH / 2;

    cam.setViewOffset(fullWidth, fullHeight, -offsetX, -offsetY, viewWidth, viewHeight);
    
    if (camera_c2w) {
        cam.matrixAutoUpdate = false;
        cam.matrix.copy(camera_c2w);
        cam.matrix.decompose(cam.position, cam.quaternion, cam.scale);
    } else {
        // 从全局相机复制位置、旋转和朝向
        cam.position.copy(camera.position);
        cam.lookAt(0, 0, -1);
        cam.up.copy(camera.up);
        
        console.log('📷 Camera frustum using global camera pose:', {
            position: `(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`,
            up: `(${camera.up.x.toFixed(2)}, ${camera.up.y.toFixed(2)}, ${camera.up.z.toFixed(2)})`
        });
    }
    
    if (texture) {
        const height_near = 2 * Math.tan((fov * Math.PI / 180) / 2) * near;
        const width_near = height_near * aspect;
        const planeGeometry = new THREE.PlaneGeometry(width_near, height_near);
        const planeMaterial = new THREE.MeshBasicMaterial({ 
            map: texture, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: imageOpacity // Use global opacity
        });
        const imagePlane = new THREE.Mesh(planeGeometry, planeMaterial);
        imagePlane.userData.isImagePlane = true;
        imagePlane.position.z = -near + 0.0001;
        const dx = (principal_point_x_px - imgW / 2) * (width_near / imgW);
        const dy = (principal_point_y_px - imgH / 2) * (height_near / imgH);
        imagePlane.position.x = -dx;
        imagePlane.position.y = dy;
        cam.add(imagePlane);
    }
    
    const camHelper = new THREE.CameraHelper(cam);

    const colorFrustum = new THREE.Color(0x444444);
    const colorCone = new THREE.Color(0x444444);
    const colorUp = new THREE.Color(0x4444ff);
    const colorCross = new THREE.Color(0x888888);
    const colorTarget = new THREE.Color(0x888888);
    camHelper.setColors(
        colorFrustum,
        colorCone,
        colorUp,
        colorCross,
        colorTarget,
    );

    cam.updateMatrixWorld(true);
    camHelper.userData.isClickable = true;
    camHelper.userData.isFrustum = true;
    camHelper.userData.cameraView = cam.view ? { 
        fullWidth: cam.view.fullWidth, 
        fullHeight: cam.view.fullHeight, 
        offsetX: cam.view.offsetX, 
        offsetY: cam.view.offsetY, 
        width: cam.view.width, 
        height: cam.view.height 
    } : null;
    
    const camWorldPos = new THREE.Vector3();
    cam.getWorldPosition(camWorldPos);
    const camWorldQuat = new THREE.Quaternion();
    cam.getWorldQuaternion(camWorldQuat);
    camHelper.userData.cameraPosition = camWorldPos.clone();
    camHelper.userData.cameraQuaternion = camWorldQuat.clone();
    camHelper.userData.cameraFov = cam.fov;
    camHelper.userData.camera = cam;
    
    scene.add(camHelper);
    scene.add(cam);
    cameraFrustums.push(camHelper);
}

// Hover effect functions remain the same
const _frustumOriginalMaterials = new WeakMap();
function applyFrustumHover(frustum) {
    if (!frustum) return;
    const saved = { materials: [], scale: null, imagePlane: null };
    frustum.traverse(obj => {
        if (obj.material) {
            const mat = obj.material;
            const entry = { obj: obj, color: mat.color ? mat.color.getHex() : null, opacity: mat.opacity !== undefined ? mat.opacity : null };
            saved.materials.push(entry);
            try {
                const shine = new THREE.Color(0x0000ff);
                if (mat.color) mat.color.set(shine);
                if (mat.emissive) {
                    mat.emissive.set(shine);
                    if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, 2.0);
                }
                mat.opacity = (entry.opacity !== null) ? Math.max(entry.opacity, 1.0) : 1.0;
                mat.needsUpdate = true;
            } catch (e) {
                // ignore
            }
        }
    });
    try {
        if (frustum.scale) saved.scale = frustum.scale.clone();
        if (frustum.scale) frustum.scale.multiplyScalar(1.06);
    } catch (e) {
        // ignore
    }

    try {
        const cam = frustum.userData && frustum.userData.camera;
        if (cam && cam.children && cam.children.length > 0) {
            const img = cam.children.find(c => c.userData && c.userData.isImagePlane && c.isMesh);
            if (img) {
                const mat = img.material;
                saved.imagePlane = {
                    obj: img,
                    materialProps: { color: mat.color ? mat.color.getHex() : null, opacity: mat.opacity !== undefined ? mat.opacity : null }
                };
                try {
                    if (mat.transparent === undefined) mat.transparent = true;
                    // mat.opacity = 1.0;
                    mat.needsUpdate = true;
                } catch (e) {
                    // ignore
                }
            }
        }
    } catch (e) {
        // ignore
    }

    _frustumOriginalMaterials.set(frustum, saved);
}

function restoreFrustumHover(frustum) {
    if (!frustum) return;
    const saved = _frustumOriginalMaterials.get(frustum);
    if (!saved) return;
    saved.materials.forEach(entry => {
        const mat = entry.obj.material;
        try {
            if (mat && entry.color !== null && mat.color) mat.color.setHex(entry.color);
            if (mat && entry.opacity !== null) mat.opacity = entry.opacity;
            mat.needsUpdate = true;
        } catch (e) {
            // ignore
        }
    });
    try {
        if (saved.scale && frustum.scale) frustum.scale.copy(saved.scale);
    } catch (e) {
        // ignore
    }
    try {
        if (saved.imagePlane && saved.imagePlane.obj) {
            const img = saved.imagePlane.obj;
            if (saved.imagePlane.scale && img.scale) img.scale.copy(saved.imagePlane.scale);
            const mat = img.material;
            if (mat && saved.imagePlane.materialProps) {
                if (saved.imagePlane.materialProps.color !== null && mat.color) mat.color.setHex(saved.imagePlane.materialProps.color);
                if (saved.imagePlane.materialProps.opacity !== null) mat.opacity = saved.imagePlane.materialProps.opacity;
                mat.needsUpdate = true;
            }
        }
    } catch (e) {
        // ignore
    }

    _frustumOriginalMaterials.delete(frustum);
}

const _meshOriginalState = new WeakMap();
function applyMeshHover(mesh) {
    if (!mesh || !mesh.material) return;
    const orig = {
        scale: mesh.scale.clone(),
        materialProps: null
    };
    const mat = mesh.material;
    orig.materialProps = {
        color: mat.color ? mat.color.getHex() : null,
        opacity: mat.opacity !== undefined ? mat.opacity : null,
        emissive: mat.emissive ? mat.emissive.getHex() : null,
        emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : null
    };
    _meshOriginalState.set(mesh, orig);

    mesh.scale.multiplyScalar(1.02);
    try {
        const shine = new THREE.Color(0xffff66);
        if (mat.color) mat.color.set(shine);
        if (mat.emissive) {
            mat.emissive.set(shine);
            if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, 1.5);
        }
        if (orig.materialProps.opacity !== null) mat.opacity = Math.max(orig.materialProps.opacity, 1.0);
        mat.needsUpdate = true;
    } catch (e) {
        // ignore
    }
}

function restoreMeshHover(mesh) {
    if (!mesh) return;
    const orig = _meshOriginalState.get(mesh);
    if (!orig) return;
    try {
        mesh.scale.copy(orig.scale);
        const mat = mesh.material;
        if (mat) {
            if (orig.materialProps.color !== null && mat.color) mat.color.setHex(orig.materialProps.color);
            if (orig.materialProps.opacity !== null) mat.opacity = orig.materialProps.opacity;
            if (orig.materialProps.emissive !== null && mat.emissive) mat.emissive.setHex(orig.materialProps.emissive);
            if (orig.materialProps.emissiveIntensity !== null && mat.emissiveIntensity !== undefined) mat.emissiveIntensity = orig.materialProps.emissiveIntensity;
            mat.needsUpdate = true;
        }
    } catch (e) {
        // ignore
    }
    _meshOriginalState.delete(mesh);
}

let animationTokens = new Map();
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(start, end, t) {
    return start + (end - start) * t;
}

function slerp(start, end, t) {
    return start.clone().slerp(end, t);
}

function animateClientCamera(startPos, startQuat, startFov, endPos, endQuat, endFov, duration = 0.8, targetCamera = null) {
    const token = Date.now();
    animationTokens.set('camera', token);
    const startTime = performance.now();
    const endTime = startTime + duration * 1000;

    const clientSize = new THREE.Vector2();
    renderer.getSize(clientSize);
    const clientFullW = Math.round(clientSize.x);
    const clientFullH = Math.round(clientSize.y);
    const clientViewW = clientFullW;
    const clientViewH = clientFullH;

    const originalViewOffset = camera.view ? {
        fullWidth: camera.view.fullWidth,
        fullHeight: camera.view.fullHeight,
        offsetX: camera.view.offsetX,
        offsetY: camera.view.offsetY,
        width: camera.view.width,
        height: camera.view.height
    } : {
        fullWidth: clientFullW,
        fullHeight: clientFullH,
        offsetX: 0,
        offsetY: 0,
        width: clientViewW,
        height: clientViewH
    };

    let mappedTargetView = null;
    if (targetCamera && targetCamera.userData && targetCamera.userData.cameraView) {
        const tv = targetCamera.userData.cameraView;
        if (tv && tv.fullWidth && tv.fullHeight) {
            const mappedOffsetX = (tv.offsetX / tv.fullWidth) * clientFullW;
            const mappedOffsetY = (tv.offsetY / tv.fullHeight) * clientFullH;
            mappedTargetView = {
                fullWidth: clientFullW,
                fullHeight: clientFullH,
                offsetX: mappedOffsetX,
                offsetY: mappedOffsetY,
                width: clientViewW,
                height: clientViewH
            };
        }
    }

    function frame(now) {
        if (animationTokens.get('camera') !== token) return;
        const tRaw = (now - startTime) / (endTime - startTime);
        const tClamped = Math.max(0, Math.min(1, tRaw));
        const te = easeInOutCubic(tClamped);

        const currentPos = new THREE.Vector3().lerpVectors(startPos, endPos, te);
        const currentQuat = slerp(startQuat, endQuat, te);
        const currentFov = lerp(startFov, endFov, te);
        camera.position.copy(currentPos);
        camera.quaternion.copy(currentQuat);
        camera.fov = currentFov;

        if (mappedTargetView) {
            const curOffsetX = lerp(originalViewOffset.offsetX, mappedTargetView.offsetX, te);
            const curOffsetY = lerp(originalViewOffset.offsetY, mappedTargetView.offsetY, te);
            try {
                camera.setViewOffset(clientFullW, clientFullH, Math.round(curOffsetX), Math.round(curOffsetY), clientViewW, clientViewH);
            } catch (e) {
                // ignore
            }
        }

        camera.updateProjectionMatrix();
        controls.object.up.copy(new THREE.Vector3(0, 1, 0).applyQuaternion(currentQuat).normalize());
        const forwardPoint = new THREE.Vector3(0, 0, -1).applyQuaternion(currentQuat).normalize();
        controls.target.copy(currentPos).add(forwardPoint);
        controls.update();

        if (tClamped < 1) {
            requestAnimationFrame(frame);
        } else {
            if (animationTokens.get('camera') === token) {
                camera.position.copy(endPos);
                camera.quaternion.copy(endQuat);
                camera.fov = endFov;
                if (mappedTargetView) {
                    try {
                        camera.setViewOffset(clientFullW, clientFullH, Math.round(mappedTargetView.offsetX), Math.round(mappedTargetView.offsetY), clientViewW, clientViewH);
                    } catch (e) {
                        // ignore
                    }
                } else {
                    if (originalViewOffset) {
                        try {
                            camera.setViewOffset(originalViewOffset.fullWidth, originalViewOffset.fullHeight, Math.round(originalViewOffset.offsetX), Math.round(originalViewOffset.offsetY), originalViewOffset.width, originalViewOffset.height);
                        } catch (e) {
                            // ignore
                        }
                    }
                }
                camera.updateProjectionMatrix();
                controls.update();
            }
        }
    }

    requestAnimationFrame(frame);
}

// Thumbnail gallery setup
// Each item in thumbnailList should be an object with:
export function setupThumbnails(thumbnailList, galleryId = 'thumbnailGallery') {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    gallery.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'rerun-thumbnails-wrapper compact';

    const thumbnailsDiv = document.createElement('div');
    thumbnailsDiv.className = 'rerun-thumbnails compact';

    thumbnailList.forEach((item, idx) => {
        // 创建每个缩略图的容器
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'rerun-thumbnail';
        thumbnailDiv.setAttribute('data-label', item.label || `Scene ${idx+1}`);
        thumbnailDiv.setAttribute('data-idx', idx);

        // 如果有缩略图URL，使用它；否则使用渐变背景和标签
        if (item.thumbnail) {
            const img = document.createElement('img');
            img.src = item.thumbnail;
            img.alt = item.label || `Scene ${idx+1}`;
            // Let CSS (.rerun-thumbnail img) control sizing and object-fit
            thumbnailDiv.appendChild(img);
        } else {
            thumbnailDiv.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
            const span = document.createElement('span');
            span.className = 'fallback-label';
            span.textContent = item.label || `Scene ${idx+1}`;
            thumbnailDiv.appendChild(span);
        }

        // cursor/presentation handled via CSS (.rerun-thumbnail)
        // 点击缩略图时加载对应的模型和相机视图
        thumbnailDiv.onclick = async () => {
            // each click starts a new logical load; bump token so prior loads are ignored
            // 生成唯一的加载 token，确保只处理最新的加载请求
            const myLoadToken = ++_currentLoadToken;

            // 高亮显示当前选中的缩略图
            thumbnailsDiv.querySelectorAll('.rerun-thumbnail').forEach(t => t.classList.remove('active'));
            thumbnailDiv.classList.add('active');

            // 移除当前场景中的模型和相机视锥体
            if (currentModel) {
                scene.remove(currentModel);
                currentModel = null;
            }
            // 移除多对象组（如果存在）
            if (scene.getObjectByName('multiObjectGroup')) {
                scene.remove(scene.getObjectByName('multiObjectGroup'));
            }
            // 移除所有相机视锥体和相关相机
            cameraFrustums.forEach(f => {
                scene.remove(f);
                if (f.parent && f.parent.type === 'Scene') {
                    f.parent.remove(f);
                }
                if (f.camera && f.camera.parent) {
                    f.camera.parent.remove(f.camera);
                }
            });
            // 移除相机上的图像平面
            scene.traverse(obj => {
                if (obj.type === 'PerspectiveCamera' && obj.children && obj.children.length > 0) {
                    obj.children.forEach(child => {
                        if (child.type === 'Mesh' && child.material && child.material.map) {
                            obj.remove(child);
                        }
                    });
                    scene.remove(obj);
                }
            });
            cameraFrustums = [];

            // 加载与缩略图对应的模型和相机视图
            let metadata = null;
            if (item.metadataPath) {
                try {
                    const res = await fetch(item.metadataPath);
                    if (res.ok) metadata = await res.json();
                } catch (err) {
                    console.warn('Failed to fetch metadata for thumbnail', err);
                }
            }
            // 如果有元数据，使用它来加载 GLB 模型
            if (metadata) {
                const parentDir = item.metadataPath.split('/').slice(0, -1).join('/');
                // await loadGLBFromMetadata(metadata, parentDir, myLoadToken);
                await loadHOIDataFromMetadata(metadata, parentDir, myLoadToken);
            }
        };

        thumbnailsDiv.appendChild(thumbnailDiv);
    });

    const prevButton = document.createElement('button');
    prevButton.className = 'carousel-button prev';
    prevButton.innerHTML = '‹';
    prevButton.setAttribute('aria-label', 'Previous');
    // presentation handled via CSS (.carousel-button)

    const nextButton = document.createElement('button');
    nextButton.className = 'carousel-button next';
    nextButton.innerHTML = '›';
    nextButton.setAttribute('aria-label', 'Next');
    // presentation handled via CSS (.carousel-button)

    prevButton.addEventListener('click', () => {
        const scrollLeft = thumbnailsDiv.scrollLeft;
        const maxScroll = thumbnailsDiv.scrollWidth - thumbnailsDiv.clientWidth;
        if (scrollLeft <= 0) {
            // wrap to rightmost
            thumbnailsDiv.scrollTo({ left: maxScroll, behavior: 'smooth' });
        } else {
            thumbnailsDiv.scrollBy({ left: -300, behavior: 'smooth' });
        }
    });
    nextButton.addEventListener('click', () => {
        const scrollLeft = thumbnailsDiv.scrollLeft;
        const maxScroll = thumbnailsDiv.scrollWidth - thumbnailsDiv.clientWidth;
        if (scrollLeft >= maxScroll - 1 || maxScroll <= 0) {
            // wrap to leftmost
            thumbnailsDiv.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            thumbnailsDiv.scrollBy({ left: 300, behavior: 'smooth' });
        }
    });

    const updateButtonStates = () => {
        const itemsCount = thumbnailsDiv.querySelectorAll('.rerun-thumbnail').length;
        const scrollLeft = thumbnailsDiv.scrollLeft;
        const maxScroll = thumbnailsDiv.scrollWidth - thumbnailsDiv.clientWidth;
        const hasItems = itemsCount > 0;
        // Keep buttons enabled when there are thumbnails so wrap-around can work.
        // Only disable when there are no items at all.
        prevButton.disabled = !hasItems;
        nextButton.disabled = !hasItems;
        // For accessibility, update aria-disabled when not active
        prevButton.setAttribute('aria-disabled', (!hasItems).toString());
        nextButton.setAttribute('aria-disabled', (!hasItems).toString());
    };

    thumbnailsDiv.addEventListener('scroll', updateButtonStates);

    const images = thumbnailsDiv.querySelectorAll('img');
    let loadedCount = 0;
    images.forEach(img => {
        if (img.complete) {
            loadedCount++;
        } else {
            img.addEventListener('load', () => {
                loadedCount++;
                if (loadedCount === images.length) updateButtonStates();
            });
        }
    });
    setTimeout(updateButtonStates, 100);

    wrapper.appendChild(prevButton);
    wrapper.appendChild(thumbnailsDiv);
    wrapper.appendChild(nextButton);

    gallery.appendChild(wrapper);

    const firstThumb = thumbnailsDiv.querySelector('.rerun-thumbnail');
    if (firstThumb) firstThumb.classList.add('active');
}

export default {
    addCameraFrustum,
    setupThumbnails,
    initDemoViewer
};