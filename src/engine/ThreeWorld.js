import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky }   from 'three/examples/jsm/objects/Sky.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import EventBus from './EventBus.js';

/**
 * ThreeWorld — the living 3D ocean world.
 *
 * Renders:
 *  - Real-time PBR ocean (Water shader — same as Three.js Sea of Thieves demos)
 *  - Physically-based sky with sun/moon
 *  - Dynamic lighting — cannon fire flashes orange light on the water
 *  - Rain particles — 3000 drops with gravity, splash on surface
 *  - Volumetric fog
 *  - Optional: 3D ship/island GLTF models if placed in /public/models/
 *
 * GLTF MODEL SOURCES (free):
 *   Ships:   https://sketchfab.com/search?q=pirate+ship+low+poly&features=downloadable
 *   Islands: https://sketchfab.com/search?q=pirate+island&features=downloadable
 *   Save as: /public/models/player_ship.glb
 *            /public/models/enemy_ship.glb
 *            /public/models/island.glb
 */
export default class ThreeWorld {
  constructor(canvas) {
    this.canvas   = canvas;
    this.mixers   = [];
    this.ships    = {};
    this._raf    = null;
    this._clock  = new THREE.Clock();
    this._flashLight = null;
    this._rainGeo = null;
    this._init();
  }

  // ─── INIT ─────────────────────────────────────────────────────────────────
  _init() {
    const W = this.canvas.clientWidth  || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.55;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04080f, 0.018);

    // Camera — cinematic fixed angle like Clash Royale
    this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);
    this.camera.position.set(0, 28, 55);
    this.camera.lookAt(0, 0, 0);

    // Lights
    this._buildLights();

    // Sky
    this._buildSky();

    // Ocean
    this._buildOcean(W, H);

    // Rain
    this._buildRain();

    // EventBus listeners
    this._bindEvents();

    // Start loop
    this._loop();

    // Resize
    window.addEventListener('resize', () => this._onResize());
  }

  // ─── LIGHTS ──────────────────────────────────────────────────────────────
  _buildLights() {
    // Ambient — deep ocean blue
    const ambient = new THREE.AmbientLight(0x0a1628, 2.2);
    this.scene.add(ambient);

    // Moon — directional, soft white-blue
    this.moonLight = new THREE.DirectionalLight(0x8899cc, 1.4);
    this.moonLight.position.set(-40, 80, 30);
    this.scene.add(this.moonLight);

    // Horizon glow — orange-red ember on the water horizon
    const horizonLight = new THREE.PointLight(0xff2200, 3, 200);
    horizonLight.position.set(0, 2, -60);
    this.scene.add(horizonLight);

    // Cannon flash light — hidden, activated on each shot
    this._flashLight = new THREE.PointLight(0xff8822, 0, 120);
    this._flashLight.position.set(0, 8, 0);
    this.scene.add(this._flashLight);
  }

  // ─── SKY ─────────────────────────────────────────────────────────────────
  _buildSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(1400);
    this.scene.add(this.sky);

    const sun = new THREE.Vector3();
    const phi   = THREE.MathUtils.degToRad(92);   // just below horizon — night
    const theta = THREE.MathUtils.degToRad(200);
    sun.setFromSphericalCoords(1, phi, theta);

    this.sky.material.uniforms['sunPosition'].value.copy(sun);
    this.sky.material.uniforms['turbidity'].value    = 12;
    this.sky.material.uniforms['rayleigh'].value     = 3;
    this.sky.material.uniforms['mieCoefficient'].value    = 0.008;
    this.sky.material.uniforms['mieDirectionalG'].value   = 0.82;
  }

  // ─── OCEAN ───────────────────────────────────────────────────────────────
  _buildOcean(W, H) {
    // Water normal map — use Three.js built-in
    const waterNormals = new THREE.TextureLoader().load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
      tex => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
    );

    this.water = new Water(
      new THREE.PlaneGeometry(800, 800, 128, 128),
      {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals,
        sunDirection: new THREE.Vector3(-1, 0.5, -1).normalize(),
        sunColor: 0xff3300,
        waterColor: 0x020c18,
        distortionScale: 4.5,
        alpha: 1.0,
        fog: true,
      }
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -1;
    this.scene.add(this.water);
  }

  // ─── RAIN ────────────────────────────────────────────────────────────────
  _buildRain() {
    const count = 3000;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    const vel   = new Float32Array(count);   // fall speed per drop

    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 200;   // x
      pos[i * 3 + 1] = Math.random() * 80;            // y — starts high
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200;   // z
      vel[i]         = 0.4 + Math.random() * 0.6;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._rainVel  = vel;
    this._rainPos  = pos;
    this._rainGeo  = geo;

    const mat  = new THREE.PointsMaterial({
      color: 0x8899bb,
      size: 0.12,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
    });
    this.rain = new THREE.Points(geo, mat);
    this.scene.add(this.rain);
  }

  _updateRain(delta) {
    if (!this._rainPos) return;
    for (let i = 0; i < this._rainPos.length / 3; i++) {
      this._rainPos[i * 3 + 1] -= this._rainVel[i] * delta * 60;
      // Respawn at top when below water
      if (this._rainPos[i * 3 + 1] < -1) {
        this._rainPos[i * 3 + 1] = 80;
        // Splash ripple event at landing position
        EventBus.emit('rainSplash', {
          x: this._rainPos[i * 3],
          z: this._rainPos[i * 3 + 2],
        });
      }
    }
    this._rainGeo.attributes.position.needsUpdate = true;
  }

  // ─── GLTF SHIP LOADER ─────────────────────────────────────────────────────
  loadShip(key, url, position, isEnemy = false) {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const ship = gltf.scene;
        ship.position.set(position.x, position.y, position.z);
        if (isEnemy) ship.rotation.y = Math.PI;
        ship.scale.setScalar(position.scale || 1);
        this.scene.add(ship);
        this.ships[key] = ship;

        // Play all embedded animations (sails, flag, idle rock)
        if (gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(ship);
          gltf.animations.forEach(clip => mixer.clipAction(clip).play());
          this.mixers.push(mixer);
        }

        EventBus.emit('shipLoaded', { key });
      },
      undefined,
      () => {
        // GLTF not found — fall back gracefully, PixiJS sprite takes over
        EventBus.emit('shipLoadFailed', { key });
      }
    );
  }

  // ─── CANNON FLASH ─────────────────────────────────────────────────────────
  flashCannonLight(x, z, color = 0xff8822) {
    if (!this._flashLight) return;
    this._flashLight.color.setHex(color);
    this._flashLight.position.set(x, 10, z);
    this._flashLight.intensity = 18;
    // Decay over 300ms
    const decay = () => {
      this._flashLight.intensity *= 0.78;
      if (this._flashLight.intensity > 0.1)
        requestAnimationFrame(decay);
      else
        this._flashLight.intensity = 0;
    };
    decay();
  }

  // ─── CAMERA FX ────────────────────────────────────────────────────────────
  shakeCamera(intensity = 0.4, duration = 400) {
    const origin = this.camera.position.clone();
    const start  = performance.now();
    const shake  = () => {
      const elapsed = performance.now() - start;
      if (elapsed > duration) {
        this.camera.position.copy(origin);
        return;
      }
      const t = 1 - elapsed / duration;
      this.camera.position.set(
        origin.x + (Math.random() - 0.5) * intensity * t,
        origin.y + (Math.random() - 0.5) * intensity * 0.4 * t,
        origin.z + (Math.random() - 0.5) * intensity * 0.3 * t,
      );
      requestAnimationFrame(shake);
    };
    shake();
  }

  zoomCamera(targetZ, duration = 800) {
    const startZ = this.camera.position.z;
    const start  = performance.now();
    const anim   = () => {
      const t = Math.min((performance.now() - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.camera.position.z = startZ + (targetZ - startZ) * ease;
      if (t < 1) requestAnimationFrame(anim);
    };
    anim();
  }

  // ─── EVENT BINDINGS ───────────────────────────────────────────────────────
  _bindEvents() {
    EventBus.on('cannonFired',  ({ x, z, color }) => this.flashCannonLight(x, z, color));
    EventBus.on('cameraShake', ({ intensity, duration }) => this.shakeCamera(intensity, duration));
    EventBus.on('cameraZoom',  ({ z, duration }) => this.zoomCamera(z, duration));
  }

  // ─── RENDER LOOP ──────────────────────────────────────────────────────────
  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    const delta = this._clock.getDelta();

    // Animate water
    if (this.water) this.water.material.uniforms['time'].value += delta * 0.7;

    // Update GLTF animation mixers
    this.mixers.forEach(m => m.update(delta));

    // Update rain
    this._updateRain(delta);

    // Gentle ship bob if 3D ships present
    Object.values(this.ships).forEach((ship, i) => {
      ship.position.y = Math.sin(Date.now() * 0.001 + i) * 0.4;
      ship.rotation.z = Math.sin(Date.now() * 0.0007 + i) * 0.025;
    });

    this.renderer.render(this.scene, this.camera);
  }

  // ─── RESIZE ──────────────────────────────────────────────────────────────
  _onResize() {
    const W = window.innerWidth, H = window.innerHeight;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', () => this._onResize());
    this.renderer.dispose();
    EventBus.clear();
  }
}
