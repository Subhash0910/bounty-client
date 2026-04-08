import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky }   from 'three/examples/jsm/objects/Sky.js';
import EventBus  from './EventBus.js';

// ─────────────────────────────────────────────────────────────────────────────
//  ThreeWorld  —  Procedural 3D pirate ships + full physics simulation
//  Ships are 100% code-generated geometry — NO GLTFs required.
// ─────────────────────────────────────────────────────────────────────────────

const MAT = {
  playerHull:  mat(0x2a5a3a, 0.8, 0.3),
  playerDeck:  mat(0x4a2e18, 0.9, 0.2),
  playerSail:  mat(0xd8c898, 0.95, 0.0),
  playerRope:  mat(0xaa9966, 0.9,  0.1),
  playerMetal: mat(0x334455, 0.4,  0.7),
  enemyHull:   mat(0x7a1a1a, 0.8, 0.3),
  enemyDeck:   mat(0x3a1a0a, 0.9, 0.2),
  enemySail:   mat(0xc8b088, 0.95, 0.0),
  enemyRope:   mat(0x998844, 0.9,  0.1),
  enemyMetal:  mat(0x443322, 0.4,  0.7),
  cannon:      mat(0x1a1a1a, 0.3,  0.8),
  cannonBand:  mat(0x444444, 0.3,  0.9),
  gold:        mat(0xcc9900, 0.5,  0.6),
  foam:        mat(0xaaccdd, 0.5,  0.0),
};
function mat(color, roughness=0.8, metalness=0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export default class ThreeWorld {
  constructor(canvas) {
    this.canvas     = canvas;
    this.ships      = {};
    this._raf       = null;
    this._clock     = new THREE.Clock();
    this._destroyed = false;
    this._init();
  }

  // ── INIT ─────────────────────────────────────────────────────────────────
  _init() {
    const W = window.innerWidth, H = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.60;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04080f, 0.016);

    this.camera = new THREE.PerspectiveCamera(55, W/H, 0.1, 2000);
    this.camera.position.set(0, 22, 52);
    this.camera.lookAt(0, 0, 0);

    this._buildLights();
    this._buildSky();
    this._buildOcean();
    this._buildRain();
    this._buildShips();
    this._bindEvents();
    this._loop();

    this._resizeHandler = () => this._onResize();
    window.addEventListener('resize', this._resizeHandler);
  }

  // ── LIGHTS ───────────────────────────────────────────────────────────────
  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0x0a1628, 3.0));

    this.sun = new THREE.DirectionalLight(0xff6633, 1.8);
    this.sun.position.set(-60, 80, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near   = 0.5;
    this.sun.shadow.camera.far    = 400;
    this.sun.shadow.camera.left   = this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.camera.right  = this.sun.shadow.camera.top    =  80;
    this.scene.add(this.sun);

    // FIX: never use Object.assign on Three.js objects — position is a readonly getter.
    // Always construct then call .position.set() separately.
    const horizonLight = new THREE.PointLight(0xff2200, 4, 220);
    horizonLight.position.set(0, 3, -70);
    this.scene.add(horizonLight);

    this._flashLight = new THREE.PointLight(0xff8822, 0, 140);
    this._flashLight.position.set(0, 10, 0);
    this.scene.add(this._flashLight);

    this._lanternLights = [];
  }

  // ── SKY ──────────────────────────────────────────────────────────────────
  _buildSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(1600);
    this.scene.add(this.sky);
    const u = this.sky.material.uniforms;
    const sun = new THREE.Vector3();
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(93), THREE.MathUtils.degToRad(200));
    u['sunPosition'].value.copy(sun);
    u['turbidity'].value       = 14;
    u['rayleigh'].value        = 3.2;
    u['mieCoefficient'].value  = 0.009;
    u['mieDirectionalG'].value = 0.84;
  }

  // ── OCEAN ────────────────────────────────────────────────────────────────
  _buildOcean() {
    const normals = this._makeWaterNormals();
    this.water = new Water(new THREE.PlaneGeometry(1000, 1000, 160, 160), {
      textureWidth: 512, textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(-1, 0.4, -1).normalize(),
      sunColor: 0xff3300, waterColor: 0x010c1c,
      distortionScale: 5.5, alpha: 1.0, fog: true,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.5;
    this.scene.add(this.water);
    this._waveTime = 0;
  }

  _makeWaterNormals() {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7f7fff'; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nx = (Math.sin(x*0.19 + y*0.07)*0.5 + 0.5)*255|0;
      const ny = (Math.sin(y*0.19 + x*0.05)*0.5 + 0.5)*255|0;
      ctx.fillStyle = `rgb(${nx},${ny},218)`; ctx.fillRect(x, y, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  _waveH(x, z, t) {
    return  Math.sin(x*0.22 + t*0.9)  * 0.55
          + Math.sin(z*0.18 + t*1.1)  * 0.40
          + Math.sin((x+z)*0.12 + t*0.6) * 0.25
          + Math.sin(x*0.35 - t*1.4)  * 0.18;
  }

  // ── RAIN ─────────────────────────────────────────────────────────────────
  _buildRain() {
    const N = 3200;
    const pos = new Float32Array(N*3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random()-0.5)*220;
      pos[i*3+1] = Math.random()*90;
      pos[i*3+2] = (Math.random()-0.5)*220;
      vel[i]     = 0.45 + Math.random()*0.55;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._rainPos = pos; this._rainVel = vel; this._rainGeo = geo;
    this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
      color:0x8899bb, size:0.13, transparent:true, opacity:0.32, sizeAttenuation:true,
    }));
    this.scene.add(this.rain);
  }

  _updateRain(dt) {
    const N = this._rainPos.length / 3;
    for (let i = 0; i < N; i++) {
      this._rainPos[i*3+1] -= this._rainVel[i] * dt * 62;
      if (this._rainPos[i*3+1] < -1) this._rainPos[i*3+1] = 88;
    }
    this._rainGeo.attributes.position.needsUpdate = true;
  }

  // ── PROCEDURAL SHIPS ─────────────────────────────────────────────────────
  _buildShips() {
    this.ships.player = this._createShip(false, -19, 0);
    this.ships.enemy  = this._createShip(true,   19, Math.PI);

    [-19, 19].forEach((x, i) => {
      const ll = new THREE.PointLight(0xffcc66, 1.4, 18);
      ll.position.set(x + 3.2*(i===0?1:-1), 5.5, 0);
      this.scene.add(ll);
      this._lanternLights.push(ll);
    });
  }

  _createShip(isEnemy, worldX, worldRotY) {
    const root = new THREE.Group();
    root.position.set(worldX, 0, 0);
    root.rotation.y = worldRotY;
    this.scene.add(root);
    const p = isEnemy ? 'enemy' : 'player';

    // Hull — LatheGeometry profile, squashed on Z axis
    const profile = [
      new THREE.Vector2(0.0, -3.8),
      new THREE.Vector2(1.2, -3.5),
      new THREE.Vector2(2.8, -2.8),
      new THREE.Vector2(4.2, -1.2),
      new THREE.Vector2(4.6,  0.2),
      new THREE.Vector2(4.4,  1.5),
      new THREE.Vector2(4.2,  2.8),
      new THREE.Vector2(3.8,  3.5),
    ];
    const hullGeo = new THREE.LatheGeometry(profile, 24);
    this._scaleGeoAxis(hullGeo, 1.0, 1.0, 0.45);
    const hull = new THREE.Mesh(hullGeo, MAT[`${p}Hull`]);
    hull.rotation.y = Math.PI/2;
    hull.castShadow = hull.receiveShadow = true;
    root.add(hull);

    const innerGeo = hullGeo.clone();
    this._scaleGeoAxis(innerGeo, 0.94, 0.94, 0.94);
    const inner = new THREE.Mesh(innerGeo, mat(isEnemy?0x1a0808:0x0a1808, 1, 0));
    inner.rotation.y = Math.PI/2;
    root.add(inner);

    // Deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.32, 4.0), MAT[`${p}Deck`]);
    deck.position.y = 3.7; deck.castShadow = deck.receiveShadow = true;
    root.add(deck);
    for (let i = -4; i <= 4; i++) {
      const pm = new THREE.Mesh(new THREE.BoxGeometry(9.0,0.04,0.06), mat(isEnemy?0x2a1008:0x2a1408,1,0));
      pm.position.set(0, 3.87, i*0.44); root.add(pm);
    }

    // Stern castle
    const stern = new THREE.Mesh(new THREE.BoxGeometry(2.6,2.0,4.2), MAT[`${p}Deck`]);
    stern.position.set(4.0, 4.8, 0); stern.castShadow = true; root.add(stern);
    [[0.5,5.5,0.9],[0.5,5.5,-0.9]].forEach(([x,y,z]) => {
      root.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.12,0.55,0.55), mat(0xffe090,0.3,0.2)), {}));
      const wm = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.55,0.55), mat(0xffe090,0.3,0.2));
      wm.position.set(x, y, z); root.add(wm);
      const wl = new THREE.PointLight(0xffcc44, 0.6, 4);
      wl.position.set(x+0.4, y, z); root.add(wl);
    });

    // Bow
    const bowGeo = new THREE.ConeGeometry(1.1, 2.5, 8);
    bowGeo.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI/2));
    const bow = new THREE.Mesh(bowGeo, MAT[`${p}Hull`]);
    bow.position.set(-5.8, 3.5, 0); bow.castShadow = true; root.add(bow);

    // Bowsprit
    const bsGeo = new THREE.CylinderGeometry(0.10, 0.16, 6, 8);
    bsGeo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI/5));
    const bs = new THREE.Mesh(bsGeo, MAT[`${p}Deck`]);
    bs.position.set(-7.2, 5.5, 0); bs.castShadow = true; root.add(bs);

    // Cannons + masts
    this._buildCannons(root, p);
    this._buildMastSystem(root, p, isEnemy);

    // Figurehead
    const fh = new THREE.Mesh(new THREE.SphereGeometry(0.32,8,8), MAT.gold);
    fh.position.set(-6.8, 4.2, 0); root.add(fh);

    // Anchor chain
    for (let i = 0; i < 5; i++) {
      const cm = new THREE.Mesh(new THREE.TorusGeometry(0.15,0.04,4,8), MAT[`${p}Metal`]);
      cm.position.set(-4.2, -2.0+i*0.4, 1.8); cm.rotation.y = i*0.6; root.add(cm);
    }

    // Wake foam
    const wake = new THREE.Mesh(
      new THREE.PlaneGeometry(2,12,1,8),
      new THREE.MeshStandardMaterial({color:0x88aacc, transparent:true, opacity:0.18, roughness:1})
    );
    wake.rotation.x = -Math.PI/2;
    wake.position.set(isEnemy?3:-3, -0.42, 0);
    root.add(wake);

    return {
      root, baseX: worldX,
      y:0, vy:0, pitch:0, vpitch:0, roll:0, vroll:0,
      yaw:0, vyaw:0, surgeZ:0, vsurgeZ:0, swayX:0, vswayX:0,
      hpPct:1, isEnemy, worldRotY,
    };
  }

  _buildCannons(root, p) {
    [-2.8, -0.9, 0.9, 2.8].forEach(bz => {
      const cg = new THREE.CylinderGeometry(0.18, 0.22, 1.4, 10);
      cg.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI/2));
      const cannon = new THREE.Mesh(cg, MAT.cannon);
      cannon.position.set(-2.2, 3.4, bz); cannon.castShadow = true; root.add(cannon);
      [0.28,-0.28].forEach(bx => {
        const bg = new THREE.TorusGeometry(0.22, 0.04, 6, 10);
        bg.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI/2));
        const bm = new THREE.Mesh(bg, MAT.cannonBand);
        bm.position.set(-2.2+bx, 3.4, bz); root.add(bm);
      });
    });
  }

  _buildMastSystem(root, p, isEnemy) {
    const mastDefs = [
      { x:-1.0, height:16, yards:[{y:7,hw:4.2},{y:11,hw:3.2},{y:14.5,hw:2.2}] },
      { x: 1.4, height:19, yards:[{y:8,hw:5.0},{y:12,hw:3.8},{y:16,hw:2.6}]  },
      { x: 4.2, height:11, yards:[{y:5,hw:2.8},{y:8,hw:2.0}]                 },
    ];

    mastDefs.forEach(md => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.19,md.height,10), MAT[`${p}Deck`]);
      mast.position.set(md.x, 3.56+md.height/2, 0); mast.castShadow = true; root.add(mast);

      if (md.height === 19) {
        const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.7,0.6,12,1,true), MAT[`${p}Deck`]);
        nest.position.set(md.x, 3.56+md.height-3.5, 0); root.add(nest);
        root.add(this._crewFigure(md.x, 3.56+md.height-3.0, 0, p));
      }

      md.yards.forEach((yd, yi) => {
        const yg = new THREE.CylinderGeometry(0.06,0.09,yd.hw*2,8);
        yg.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI/2));
        const yard = new THREE.Mesh(yg, MAT[`${p}Deck`]);
        yard.position.set(md.x, 3.56+yd.y, 0); root.add(yard);

        const nextY = md.yards[yi+1]?.y ?? yd.y+3.8;
        const sail  = this._buildSail(yd.hw, nextY-yd.y-0.4, MAT[`${p}Sail`], isEnemy);
        sail.position.set(md.x, 3.56+yd.y+0.2, 0); root.add(sail);

        [-yd.hw*0.9, yd.hw*0.9].forEach(tz => {
          this._addRope(root, MAT[`${p}Rope`],
            new THREE.Vector3(md.x, 3.56+yd.y, tz),
            new THREE.Vector3(md.x+(isEnemy?-1:1)*1.5, 3.7, tz*1.1)
          );
        });
      });

      this._addRope(root, MAT[`${p}Rope`],
        new THREE.Vector3(md.x, 3.56+md.height-0.5, 0),
        new THREE.Vector3(-7.8, 6.8, 0)
      );
    });

    [[-3.0,3.88,-0.8],[-1.2,3.88,0.9],[0.8,3.88,-0.5],[2.5,3.88,0.7]].forEach(([x,y,z]) => {
      root.add(this._crewFigure(x, y, z, p));
    });

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.1),
      new THREE.MeshStandardMaterial({color:isEnemy?0xcc2222:0x009944, side:THREE.DoubleSide, roughness:0.9})
    );
    flag.position.set(1.4, 3.56+19.4, 0.9); root.add(flag);
  }

  _buildSail(halfWidth, height, material, isEnemy) {
    const W=8, H=6, verts=[], uvs=[], indices=[];
    for (let j=0; j<=H; j++) for (let i=0; i<=W; i++) {
      const u=i/W, v=j/H;
      const x=(u-0.5)*halfWidth*2, y=v*height;
      const bulge=(1-(u*2-1)**2)*(1-(v*2-1)**2)*1.8;
      verts.push(x, y, bulge*(isEnemy?-1:1));
      uvs.push(u, v);
    }
    for (let j=0; j<H; j++) for (let i=0; i<W; i++) {
      const a=j*(W+1)+i, b=a+1, c=a+(W+1), d=c+1;
      indices.push(a,b,d, a,d,c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs),   2));
    geo.setIndex(indices); geo.computeVertexNormals();
    const m = material.clone(); m.side = THREE.DoubleSide;
    return new THREE.Mesh(geo, m);
  }

  _addRope(root, material, from, to) {
    const mid = new THREE.Vector3().addVectors(from,to).multiplyScalar(0.5);
    mid.y -= 0.6;
    const geo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from,mid,to), 12, 0.025, 4, false);
    root.add(new THREE.Mesh(geo, material));
  }

  _crewFigure(x, y, z, p) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const body  = new THREE.Mesh(new THREE.CapsuleGeometry(0.18,0.55,4,8), MAT[`${p}Deck`]);  body.position.y=0.42;
    const head  = new THREE.Mesh(new THREE.SphereGeometry(0.19,8,8),        mat(0xddccaa,0.9,0)); head.position.y=1.05;
    const hat   = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.22,0.3,8), mat(0x111111,1,0)); hat.position.y=1.32;
    const brim  = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.06,8), mat(0x111111,1,0)); brim.position.y=1.20;
    [body,head,hat,brim].forEach(m => { m.castShadow=true; g.add(m); });
    return g;
  }

  _scaleGeoAxis(geo, sx, sy, sz) {
    const pos = geo.attributes.position;
    for (let i=0; i<pos.count; i++) {
      pos.setX(i, pos.getX(i)*sx);
      pos.setY(i, pos.getY(i)*sy);
      pos.setZ(i, pos.getZ(i)*sz);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
  }

  // ── PHYSICS ──────────────────────────────────────────────────────────────
  _updatePhysics(phys, dt) {
    const t=this._waveTime, bx=phys.baseX;
    const hC  = this._waveH(bx,      0, t);
    const hB  = this._waveH(bx-4.5,  0, t);
    const hSt = this._waveH(bx+4.5,  0, t);
    const hP  = this._waveH(bx,     -2, t);
    const hSb = this._waveH(bx,      2, t);

    phys.vy     += ((hC - phys.y)*9.0  - phys.vy*2.8)  * dt;  phys.y      += phys.vy     * dt;
    phys.vpitch += ((hSt-hB)*3.2 - phys.pitch*4.5 - phys.vpitch*3.8) * dt; phys.pitch  += phys.vpitch * dt;
    phys.vroll  += ((hSb-hP)*2.8 - phys.roll*5.0  - phys.vroll*4.2)  * dt; phys.roll   += phys.vroll  * dt;

    const yawDrift = Math.sin(t*0.14 + (phys.isEnemy?1.8:0))*0.004;
    phys.vyaw   += (yawDrift - phys.yaw*0.8  - phys.vyaw*1.6)  * dt; phys.yaw    += phys.vyaw   * dt;
    phys.yaw     = THREE.MathUtils.clamp(phys.yaw, -0.12, 0.12);

    phys.vswayX += (-phys.swayX*6.0 - phys.vswayX*4.5) * dt;  phys.swayX  += phys.vswayX * dt;
    phys.vsurgeZ+= (-phys.surgeZ*1.2- phys.vsurgeZ*1.0) * dt;  phys.surgeZ += phys.vsurgeZ* dt;

    phys.root.position.x = bx + phys.swayX;
    phys.root.position.y = phys.y;
    phys.root.position.z = phys.surgeZ;
    phys.root.rotation.x = phys.pitch;
    phys.root.rotation.z = phys.roll;
    phys.root.rotation.y = phys.worldRotY + phys.yaw;
  }

  applyImpact(key, opts={}) {
    const p = this.ships[key]; if(!p) return;
    p.vswayX += opts.sway  ?? 0;
    p.vy     += opts.heave ?? 0;
    p.vpitch += opts.pitch ?? 0;
    p.vroll  += opts.roll  ?? 0;
  }

  flashCannonLight(x, z, color=0xff8822) {
    if(!this._flashLight) return;
    this._flashLight.color.setHex(color);
    this._flashLight.position.set(x, 10, z);
    this._flashLight.intensity = 22;
    const decay=()=>{ if(this._destroyed)return; this._flashLight.intensity*=0.76; if(this._flashLight.intensity>0.15) requestAnimationFrame(decay); else this._flashLight.intensity=0; };
    decay();
  }

  shakeCamera(intensity=0.4, duration=400) {
    const origin=this.camera.position.clone(), t0=performance.now();
    const shake=()=>{ if(this._destroyed)return; const el=performance.now()-t0; if(el>duration){this.camera.position.copy(origin);return;} const f=1-el/duration; this.camera.position.set(origin.x+(Math.random()-0.5)*intensity*f, origin.y+(Math.random()-0.5)*intensity*0.4*f, origin.z+(Math.random()-0.5)*intensity*0.3*f); requestAnimationFrame(shake); };
    shake();
  }

  zoomCamera(targetZ, duration=800) {
    const startZ=this.camera.position.z, t0=performance.now();
    const anim=()=>{ if(this._destroyed)return; const t=Math.min((performance.now()-t0)/duration,1); const e=t<0.5?2*t*t:-1+(4-2*t)*t; this.camera.position.z=startZ+(targetZ-startZ)*e; if(t<1)requestAnimationFrame(anim); };
    anim();
  }

  _updateLanterns(t) {
    this._lanternLights.forEach((ll,i) => {
      ll.intensity = 1.2 + Math.sin(t*4.8+i*2.1)*0.4 + Math.sin(t*11.2+i)*0.18;
    });
  }

  _bindEvents() {
    EventBus.on('cannonFired',   ({x,z,color})           => this.flashCannonLight(x,z,color));
    EventBus.on('cameraShake',   ({intensity,duration})   => this.shakeCamera(intensity,duration));
    EventBus.on('cameraZoom',    ({z,duration})           => this.zoomCamera(z,duration));
    EventBus.on('impactImpulse', ({who,sway,heave,pitch,roll}) => this.applyImpact(who,{sway,heave,pitch,roll}));
    EventBus.on('cannonRecoil',  ({who})                  => { const s=(who==='player')?1:-1; this.applyImpact(who,{pitch:s*0.018,heave:0.12}); });
  }

  _loop() {
    if(this._destroyed) return;
    this._raf = requestAnimationFrame(() => this._loop());
    const dt = Math.min(this._clock.getDelta(), 0.05);
    this._waveTime += dt;
    if(this.water) this.water.material.uniforms['time'].value += dt*0.7;
    this._updateRain(dt);
    this._updateLanterns(this._waveTime);
    Object.values(this.ships).forEach(p => this._updatePhysics(p, dt));
    this.renderer.render(this.scene, this.camera);
  }

  loadShip() {}  // no-op — ships are procedural

  _onResize() {
    const W=window.innerWidth, H=window.innerHeight;
    this.camera.aspect=W/H; this.camera.updateProjectionMatrix(); this.renderer.setSize(W,H);
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resizeHandler);
    this.renderer?.dispose();
    EventBus.clear();
  }
}
