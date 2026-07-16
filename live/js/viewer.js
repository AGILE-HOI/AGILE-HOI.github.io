// viewer.js — AgileViewer
// A self-contained Three.js engine for AGILE hand-object-interaction sequences.
// Ported from the original static/js/demo.js (pose/loading/frustum math is kept
// verbatim — it is correct and subtle); reshaped into a class with a clean public
// API + events, and re-themed dark. The camera sits at the origin looking down -Z,
// mimicking the capture camera, so the reconstruction overlays the source video.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const GLOBAL_SCALE = 4.0;
const HAND_COLOR = 0x9690f8;        // signature violet
const HAND_EMISSIVE = 0x241d55;     // subtle self-glow on dark
const FRUSTUM_COLOR = 0x38e0ff;     // neon cyan lines (visible on dark)
const FRUSTUM_UP_COLOR = 0x7a5cff;  // violet "up" indicator

export class AgileViewer {
  constructor(container, opts = {}) {
    this.container = container;
    this.fps = opts.fps || 12;
    this.overlayOpacity = opts.overlayOpacity ?? 0.35;
    this.autoRotateSpeed = opts.autoRotateSpeed ?? 0.6;

    this._listeners = {};
    this._loadToken = 0;
    this._resetToken = 0;

    // HOI state
    this.objectPoses = null;
    this.currentModel = null;
    this.handMeshes = [];
    this.currentHandMesh = null;
    this.videoFrames = [];
    this.cameraFrustums = [];
    this.initObjectPosition = new THREE.Vector3(0, 0, -1.5);
    this.currentFrameIndex = 0;
    this.isPaused = false;
    this._lastPoseTime = 0;
    this._poseInterval = 1000 / this.fps;

    // attract-mode dolly
    this._dolly = false;
    this._dollyBaseRadius = null;
    this._dollyClock = 0;

    // fps telemetry
    this._frames = 0;
    this._fpsLast = 0;

    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this._initThree();
    this._animate = this._animate.bind(this);
    this._raf = requestAnimationFrame(this._animate);
  }

  // ---- events ------------------------------------------------------------
  on(evt, cb) { (this._listeners[evt] ||= []).push(cb); return this; }
  _emit(evt, data) { (this._listeners[evt] || []).forEach(cb => { try { cb(data); } catch (e) { console.warn(e); } }); }

  // ---- three.js scaffolding ---------------------------------------------
  _initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 4 / 3, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);           // transparent → CSS backdrop shows through
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
    this._resize();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 30;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = this.autoRotateSpeed;

    // Lighting: bright ambient keeps textures true; hemisphere adds a cool tech rim.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const hemi = new THREE.HemisphereLight(0x8fd8ff, 0x2a2350, 0.55);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(0.4, 1.0, 0.2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6ea8ff, 0.8);
    rim.position.set(-0.6, -0.2, -1.0);
    this.scene.add(rim);

    // Camera at origin, looking -Z (matches capture camera).
    this.camera.position.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, -1);
    this.controls.target.set(0, 0, -1);
    this.controls.update();

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.container);
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);

    // Double-click / double-tap resets the view.
    this.renderer.domElement.addEventListener('dblclick', () => this.resetView());
    // If the user grabs the controls mid-reset, abort the reset so it never fights the drag.
    this.controls.addEventListener('start', () => { this._resetToken++; });
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : this.container.clientWidth || 800;
    const h = rect.height > 0 ? rect.height : this.container.clientHeight || 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(Math.round(w), Math.round(h), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- public control API -----------------------------------------------
  get frameCount() { return this.objectPoses ? this.objectPoses.length : 0; }

  play() { this.isPaused = false; this._emit('playstate', { paused: false }); }
  pause() { this.isPaused = true; this._emit('playstate', { paused: true }); }
  toggle() { this.isPaused ? this.play() : this.pause(); }

  seek(index) {
    if (!this.objectPoses) return;
    this.currentFrameIndex = Math.max(0, Math.min(this.objectPoses.length - 1, index | 0));
    this._updateFrame();
    this._emit('frame', { index: this.currentFrameIndex, total: this.objectPoses.length });
  }
  nextFrame() { this.seek(this.currentFrameIndex + 1); }
  prevFrame() { this.seek(this.currentFrameIndex - 1); }
  firstFrame() { this.seek(0); }
  lastFrame() { this.seek(this.frameCount - 1); }

  setOverlayOpacity(v) {
    this.overlayOpacity = Math.max(0, Math.min(1, v));
    this.scene.traverse(obj => {
      if (obj.userData && obj.userData.isImagePlane && obj.material) {
        obj.material.opacity = this.overlayOpacity;
        obj.material.needsUpdate = true;
      }
    });
  }

  get autoRotate() { return this.controls.autoRotate; }
  setAutoRotate(on) { this.controls.autoRotate = !!on; this._emit('autorotate', { on: !!on }); }

  setDolly(on) {
    this._dolly = !!on;
    if (on) this._dollyBaseRadius = this.camera.position.distanceTo(this.controls.target);
  }

  toggleFrustum() {
    if (!this.cameraFrustums.length) return;
    const vis = !this.cameraFrustums[0].visible;
    this.setFrustumVisible(vis);
    return vis;
  }
  setFrustumVisible(vis) {
    this.cameraFrustums.forEach(f => {
      f.visible = vis;
      if (f.userData.camera) f.userData.camera.visible = vis;
    });
    this._emit('frustum', { on: vis });
  }
  get frustumVisible() { return this.cameraFrustums.length ? this.cameraFrustums[0].visible : false; }

  // Smoothly return the camera to the canonical capture pose (origin, looking -Z),
  // which re-aligns the reconstruction with the source-video overlay.
  resetView() {
    this.setAutoRotate(false);   // via setter so the HUD spin button stays in sync
    this._dolly = false;
    const startPos = this.camera.position.clone();
    const startQuat = this.camera.quaternion.clone();
    const startTarget = this.controls.target.clone();
    const endPos = new THREE.Vector3(0, 0, 0);
    const tempCam = new THREE.PerspectiveCamera(75, this.camera.aspect, this.camera.near, this.camera.far);
    tempCam.up.set(0, 1, 0); tempCam.position.copy(endPos); tempCam.lookAt(0, 0, -1);
    const endQuat = tempCam.quaternion.clone();
    const endTarget = new THREE.Vector3(0, 0, this.initObjectPosition.z);

    const myToken = ++this._resetToken;
    const dur = 600; let start = null;
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      if (myToken !== this._resetToken) return;           // cancelled by a newer reset/interaction
      if (start === null) start = now;
      const e = ease(Math.min(1, (now - start) / dur));
      this.camera.position.lerpVectors(startPos, endPos, e);
      this.camera.quaternion.copy(startQuat).slerp(endQuat, e);
      this.camera.up.set(0, 1, 0);
      this.controls.target.lerpVectors(startTarget, endTarget, e);
      this.controls.update();
      if (e < 1) requestAnimationFrame(step);
      else {
        this.camera.position.copy(endPos);
        this.camera.quaternion.copy(endQuat);
        this.controls.target.copy(endTarget);
        this.controls.update();
      }
    };
    requestAnimationFrame(step);
  }

  // ---- loading -----------------------------------------------------------
  async loadSequence(seq) {
    const token = ++this._loadToken;
    this._emit('loadstart', { seq });
    this._emit('progress', { pct: 0, text: 'Initializing…' });
    this.isPaused = false;

    this._clearScene();

    let metadata;
    try {
      const res = await fetch(`${seq.dir}/metadata.json`);
      metadata = await res.json();
    } catch (e) {
      this._emit('error', { seq, error: e });
      return false;
    }
    if (token !== this._loadToken) return false;

    const ok = await this._loadHOI(metadata, seq.dir, token);
    if (token !== this._loadToken) return false;
    if (!ok) { this._emit('error', { seq }); return false; }

    this.currentFrameIndex = 0;
    this._updateFrame();
    const aspect = (metadata.image_width || 640) / (metadata.image_height || 480);
    this._emit('progress', { pct: 100, text: 'Ready' });
    this._emit('loaded', { seq, total: this.frameCount, aspect });
    this._emit('frame', { index: 0, total: this.frameCount });
    return true;
  }

  _clearScene() {
    if (this.currentModel) { this.scene.remove(this.currentModel); this._disposeObject(this.currentModel); this.currentModel = null; }
    this.handMeshes.forEach(h => { if (h) { this.scene.remove(h); this._disposeObject(h); } });
    this.handMeshes = []; this.currentHandMesh = null;
    this.videoFrames.forEach(t => t && t.dispose());
    this.videoFrames = [];
    this.cameraFrustums.forEach(f => {
      this.scene.remove(f);
      if (f.userData.camera) { this.scene.remove(f.userData.camera); this._disposeObject(f.userData.camera); }
      this._disposeObject(f);            // dispose CameraHelper line geometry/material
      if (f.dispose) f.dispose();
    });
    this.cameraFrustums = [];
    this.objectPoses = null;
  }

  _disposeObject(obj) {
    obj.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); if (m.dispose) m.dispose(); });
      }
    });
  }

  _loadGLB(path, group, token) {
    return new Promise((resolve, reject) => {
      this.loader.load(path, (gltf) => {
        const model = gltf.scene;
        model.traverse(child => {
          if (!child.isMesh) return;
          if (child.geometry && child.geometry.attributes.normal === undefined) child.geometry.computeVertexNormals();
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            const conv = mats.map(m => new THREE.MeshPhongMaterial({
              color: 0xffffff, specular: 0x111111, shininess: 28, emissive: 0x000000,
              map: m.map || null, side: THREE.DoubleSide,
            }));
            child.material = Array.isArray(child.material) ? conv : conv[0];
          }
        });
        if (token !== undefined && token !== this._loadToken) { this._disposeObject(model); resolve(null); return; }
        if (group) group.add(model); else { this.scene.add(model); this.currentModel = model; }
        resolve(model);
      }, undefined, (err) => reject(err));
    });
  }

  _loadTexture(url) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(url, (tex) => {
        try {
          if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
          tex.needsUpdate = true;
        } catch (e) { /* ignore */ }
        resolve(tex);
      }, undefined, (err) => reject(err));
    });
  }

  async _loadHOI(metadata, dir, token) {
    const numFrames = metadata.num_frames;
    try {
      // 1) object mesh
      this._emit('progress', { pct: 4, text: 'Loading object mesh…' });
      const model = await this._loadGLB(`${dir}/object_mesh_scaled.glb`, null, token);
      if (token !== this._loadToken) return false;
      if (!model) return false;
      this.currentModel = model;

      // 2) video frames (parallel)
      this._emit('progress', { pct: 8, text: `Loading frames 0/${numFrames}…` });
      let done = 0;
      const framePromises = Array.from({ length: numFrames }, (_, i) =>
        this._loadTexture(`${dir}/rgb_images/frame_${String(i).padStart(4, '0')}.png`)
          .catch(() => null)
          .then(tex => { done++; if (done % 10 === 0 || done === numFrames) this._emit('progress', { pct: 8 + (done / numFrames) * 22, text: `Loading frames ${done}/${numFrames}…` }); return tex; })
      );
      // commit to shared state only after confirming this load is still current,
      // so a superseded load can't clobber a newer one's frames (or leak them).
      const frames = await Promise.all(framePromises);
      if (token !== this._loadToken) { frames.forEach(t => t && t.dispose()); return false; }
      this.videoFrames = frames;

      // 3) object poses
      this._emit('progress', { pct: 32, text: 'Loading trajectories…' });
      const poseData = await (await fetch(`${dir}/object_poses.json`)).json();
      if (token !== this._loadToken) return false;
      const poses = poseData.object_poses;
      this.objectPoses = poses;
      if (poses.length > 0) {
        const { position } = this._decomposePose(poses[0]);
        this.initObjectPosition = position.clone();
        this.controls.target.set(0, 0, this.initObjectPosition.z);
        this.controls.update();
      }

      // 4) hand meshes (parallel, per-frame group)
      this._emit('progress', { pct: 36, text: `Loading hand meshes 0/${numFrames}…` });
      let hdone = 0;
      const handPromises = Array.from({ length: numFrames }, (_, i) => {
        const g = new THREE.Group(); g.name = `hand_${i}`;
        return this._loadGLB(`${dir}/hand_meshes/hand_${String(i).padStart(4, '0')}.glb`, g, token)
          .then(m => {
            if (!m || token !== this._loadToken) return null;
            g.traverse(child => {
              if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                  mat.side = THREE.DoubleSide;
                  if (mat.color) mat.color.setHex(HAND_COLOR);
                  if (mat.emissive) mat.emissive.setHex(HAND_EMISSIVE);
                  mat.shininess = 40;
                  mat.needsUpdate = true;
                });
              }
            });
            // Hand vertices are in metric camera space; scaling the group about the
            // origin places them to match the object's translation × GLOBAL_SCALE.
            g.scale.setScalar(GLOBAL_SCALE);
            g.visible = false;
            this.scene.add(g);
            return g;
          })
          .catch(() => null)
          .then(g => { hdone++; if (hdone % 10 === 0 || hdone === numFrames) this._emit('progress', { pct: 36 + (hdone / numFrames) * 54, text: `Loading hand meshes ${hdone}/${numFrames}…` }); return g; });
      });
      const hands = await Promise.all(handPromises);
      // superseded: remove any hands already added to the scene AND dispose them,
      // otherwise the orphaned groups leak in scene.children (never re-found by _clearScene).
      if (token !== this._loadToken) { hands.forEach(h => { if (h) { this.scene.remove(h); this._disposeObject(h); } }); return false; }
      // keep index-aligned with poses (nulls tolerated by _updateFrame); a failed
      // frame must not shift every later hand out of sync with its pose.
      this.handMeshes = hands;

      // 5) intrinsics → camera FOV + view offset, then frustum
      this._emit('progress', { pct: 92, text: 'Calibrating camera…' });
      const K = await (await fetch(`${dir}/cam_K.json`)).json();
      const intr = K.intrinsic_matrix;
      const imW = metadata.image_width || 640, imH = metadata.image_height || 480;
      const fy = intr[1][1], cx = intr[0][2], cy = intr[1][2];
      const fov = 2 * Math.atan(0.5 * imH / fy) * 180 / Math.PI;
      this.camera.fov = fov;
      this.camera.aspect = imW / imH;
      const offsetX = cx - imW / 2, offsetY = cy - imH / 2;
      this.camera.setViewOffset(imW, imH, -offsetX, -offsetY, imW, imH);
      this.camera.updateProjectionMatrix();
      this.controls.update();

      this._emit('progress', { pct: 96, text: 'Building camera view…' });
      await this._addCameraFrustum(intr, imW, imH);
      this._resize();
      return true;
    } catch (e) {
      console.warn('HOI load failed:', e);
      return false;
    }
  }

  _decomposePose(poseMatrix) {
    const f = poseMatrix.map(row => Array.isArray(row) ? (row.length === 1 ? [row[0], 0, 0, 0] : row.length === 0 ? [0, 0, 0, 1] : row) : [row, 0, 0, 0]);
    const m = new THREE.Matrix4().set(
      f[0][0], f[0][1], f[0][2], f[0][3] * GLOBAL_SCALE,
      f[1][0], f[1][1], f[1][2], f[1][3] * GLOBAL_SCALE,
      f[2][0], f[2][1], f[2][2], f[2][3] * GLOBAL_SCALE,
      f[3][0], f[3][1], f[3][2], f[3][3]
    );
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
    m.decompose(position, quaternion, scale);
    return { position, quaternion, scale };
  }

  _updateFrame() {
    if (!this.objectPoses || !this.currentModel || !this.handMeshes.length || !this.videoFrames.length) return;
    const i = this.currentFrameIndex;
    const { position, quaternion } = this._decomposePose(this.objectPoses[i]);
    this.currentModel.scale.setScalar(GLOBAL_SCALE);
    this.currentModel.position.copy(position);
    this.currentModel.quaternion.copy(quaternion);

    if (this.currentHandMesh) this.currentHandMesh.visible = false;
    this.currentHandMesh = this.handMeshes[i] || null;
    if (this.currentHandMesh) this.currentHandMesh.visible = true;

    const tex = this.videoFrames[i];
    if (tex && this.cameraFrustums.length) {
      this.cameraFrustums.forEach(fr => {
        const cam = fr.userData.camera;
        const plane = cam && cam.children.find(c => c.userData && c.userData.isImagePlane && c.isMesh);
        if (plane && plane.material) { plane.material.map = tex; plane.material.needsUpdate = true; }
      });
    }
  }

  async _addCameraFrustum(intr, imW, imH) {
    const fx = intr[0][0], fy = intr[1][1], cx = intr[0][2], cy = intr[1][2];
    const texture = this.videoFrames.length ? this.videoFrames[0] : null;
    const fov = 2 * Math.atan(0.5 * imH / fy) * 180 / Math.PI;
    const aspect = imW / imH;
    const near = 0.5, far = 0.500001;
    const cam = new THREE.PerspectiveCamera(fov, aspect, near, far);
    const offX = cx - imW / 2, offY = cy - imH / 2;
    cam.setViewOffset(imW, imH, -offX, -offY, imW, imH);
    // The capture camera lives at the world origin looking down -Z, regardless of
    // where the viewing camera currently is (important for attract-mode reloads).
    cam.position.set(0, 0, 0);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, -1);

    if (texture) {
      const hNear = 2 * Math.tan((fov * Math.PI / 180) / 2) * near;
      const wNear = hNear * aspect;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(wNear, hNear),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: this.overlayOpacity })
      );
      plane.userData.isImagePlane = true;
      plane.position.z = -near + 0.0001;
      plane.position.x = -(cx - imW / 2) * (wNear / imW);
      plane.position.y = (cy - imH / 2) * (hNear / imH);
      cam.add(plane);
    }

    const helper = new THREE.CameraHelper(cam);
    helper.setColors(
      new THREE.Color(FRUSTUM_COLOR), new THREE.Color(FRUSTUM_COLOR),
      new THREE.Color(FRUSTUM_UP_COLOR), new THREE.Color(0x2a6e88), new THREE.Color(0x2a6e88)
    );
    cam.updateMatrixWorld(true);
    helper.userData.isFrustum = true;
    helper.userData.camera = cam;
    this.scene.add(helper);
    this.scene.add(cam);
    this.cameraFrustums.push(helper);
  }

  // ---- render loop -------------------------------------------------------
  _animate(now) {
    this._raf = requestAnimationFrame(this._animate);

    // attract dolly: gently breathe the orbit radius
    if (this._dolly && this._dollyBaseRadius) {
      this._dollyClock = now;
      const amp = this._dollyBaseRadius * 0.16;
      const targetR = this._dollyBaseRadius + amp * Math.sin(now * 0.00035);
      const offset = this.camera.position.clone().sub(this.controls.target);
      const r = offset.length();
      if (r > 1e-4) { offset.multiplyScalar(targetR / r); this.camera.position.copy(this.controls.target).add(offset); }
    }

    this.controls.update();

    if (!this.isPaused && this.objectPoses && this.currentModel && this.handMeshes.length && this.videoFrames.length && this.cameraFrustums.length) {
      if (now - this._lastPoseTime >= this._poseInterval) {
        this._lastPoseTime = now;
        this._updateFrame();
        this._emit('frame', { index: this.currentFrameIndex, total: this.objectPoses.length });
        this.currentFrameIndex = (this.currentFrameIndex + 1) % this.objectPoses.length;
      }
    }

    // fps telemetry (~2 Hz)
    this._frames++;
    if (now - this._fpsLast >= 500) {
      const fps = Math.round((this._frames * 1000) / (now - this._fpsLast));
      this._frames = 0; this._fpsLast = now;
      this._emit('fps', { fps });
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this._clearScene();
    this.renderer.dispose();
  }
}
