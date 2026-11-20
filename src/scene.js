import * as THREE from 'three';
import { TYPE_COLORS } from './creatures.js';
import { DEX, artUrl } from './data/dex.js';

// 3D 전투 씬. 캐릭터는 (1) 진짜 포켓몬 공식 이미지를 3D 무대에 세운 스프라이트,
// 또는 (2) 외부 리소스 없이 기본 도형으로 만든 절차적 모델(폴백)로 그린다.
// 무대·포켓볼·공격 이펙트·그림자는 항상 3D.
const USE_REAL_SPRITES = true;

const ENEMY_POS = new THREE.Vector3(-1.35, 0, -1.3);
const ALLY_POS  = new THREE.Vector3(1.55, 0, 0.6);

// 적 타입별 배경 팔레트 (하늘/안개/바닥)
const BACKDROPS = {
  normal:   { sky: 0x12203f, fog: 0x12203f, ground: 0x21407a },
  fire:     { sky: 0x3a1206, fog: 0x6a1f08, ground: 0x5a2410 },
  water:    { sky: 0x06203f, fog: 0x0a345e, ground: 0x123a6a },
  grass:    { sky: 0x0f3318, fog: 0x1a5028, ground: 0x1d5a2e },
  electric: { sky: 0x2a2440, fog: 0x4a3f12, ground: 0x3a3560 },
  ice:      { sky: 0x123148, fog: 0x1f4f68, ground: 0x265a73 },
  psychic:  { sky: 0x331033, fog: 0x5a1f5a, ground: 0x5a205a },
  dragon:   { sky: 0x171248, fog: 0x241e64, ground: 0x2a2470 },
  ground:   { sky: 0x3a2c0e, fog: 0x5a4516, ground: 0x5a4818 },
  rock:     { sky: 0x2c2216, fog: 0x463922, ground: 0x4e442c },
  flying:   { sky: 0x182a4a, fog: 0x2a4068, ground: 0x33508a },
  bug:      { sky: 0x223310, fog: 0x35501a, ground: 0x3e5a22 },
  poison:   { sky: 0x2a1235, fog: 0x451f52, ground: 0x4a2a5a },
  fighting: { sky: 0x3a1810, fog: 0x5a2818, ground: 0x5a3424 },
  ghost:    { sky: 0x1a1230, fog: 0x2a1f48, ground: 0x322a55 },
  dark:     { sky: 0x141420, fog: 0x222234, ground: 0x2c2c42 },
  steel:    { sky: 0x1e2630, fog: 0x33404e, ground: 0x3e4a5a },
  fairy:    { sky: 0x351830, fog: 0x55284a, ground: 0x5a3055 },
};
const _tmpCol = new THREE.Color();

export class BattleScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12203f);
    this.scene.fog = new THREE.Fog(0x12203f, 12, 26);
    // 적 타입별 배경 전환 목표색(부드럽게 lerp + 은은한 일렁임)
    this._bgTarget = this.scene.background.clone();
    this._fogTarget = this.scene.fog.color.clone();
    this._groundTarget = new THREE.Color(0x21407a);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    this.cameraBase = new THREE.Vector3(0, 3.7, 9.6);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(0, 1.1, 0);

    this._initLights();
    this._initGround();

    this.ally = null;
    this.enemy = null;
    this.effects = [];
    this.shake = { t: 0, dur: 0, mag: 0 };
    this.clock = new THREE.Clock();
    this._t = 0;

    // 진짜 이미지 스프라이트용 텍스처 로더/캐시
    this.texLoader = new THREE.TextureLoader();
    this.texLoader.setCrossOrigin('anonymous');
    this.texCache = new Map();
    this._shadowTexCache = null;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._loop();
  }

  _initLights() {
    const hemi = new THREE.HemisphereLight(0xbfd5ff, 0x33406a, 0.95);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(4, 8, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 30;
    dir.shadow.camera.left = -10; dir.shadow.camera.right = 10;
    dir.shadow.camera.top = 10; dir.shadow.camera.bottom = -10;
    this.scene.add(dir);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.6);
    rim.position.set(-5, 4, -5);
    this.scene.add(rim);
  }

  _initGround() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({ color: 0x21407a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundMat = ground.material; // 동적 배경에서 색 전환

    for (const pos of [ENEMY_POS, ALLY_POS]) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.7, 0.25, 32),
        new THREE.MeshStandardMaterial({ color: 0x3a5bb0, roughness: 0.8 })
      );
      pad.position.set(pos.x, 0.1, pos.z);
      pad.receiveShadow = true;
      this.scene.add(pad);
    }
  }

  // 적 타입에 맞춰 배경/안개/바닥 색을 바꾼다(부드러운 전환). _loop에서 lerp + 일렁임.
  setBackdrop(type) {
    const B = BACKDROPS[type] || BACKDROPS.normal;
    this._bgTarget.setHex(B.sky);
    this._fogTarget.setHex(B.fog);
    this._groundTarget.setHex(B.ground);
  }

  // ---- 캐릭터 생성 ---------------------------------------------------------
  buildCreature(def) {
    if (USE_REAL_SPRITES && (def.formArt != null || DEX[def.id])) return this._buildSprite(def);
    return this._buildProcedural(def);
  }

  // 절차적 도형 캐릭터(스프라이트 미지원 종 또는 이미지 로드 실패 시 폴백)
  _buildProcedural(def) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.colors.body, roughness: 0.55, metalness: 0.05 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: def.colors.belly, roughness: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({ color: def.colors.accent, roughness: 0.5 });
    const mats = [bodyMat];

    // 몸통
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 24), bodyMat);
    body.scale.set(1, 1.12, 0.95);
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);

    // 배 패치
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), bellyMat);
    belly.scale.set(0.85, 1.0, 0.5);
    belly.position.set(0, 0.92, 0.62);
    g.add(belly);

    // 발
    for (const sx of [-0.42, 0.42]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), bodyMat);
      foot.scale.set(1, 0.7, 1.2);
      foot.position.set(sx, 0.22, 0.18);
      foot.castShadow = true;
      g.add(foot);
    }
    // 팔
    const arms = [];
    for (const sx of [-0.86, 0.86]) {
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), bodyMat);
      arm.scale.set(0.8, 1.1, 0.8);
      arm.position.set(sx, 1.0, 0.18);
      g.add(arm);
      arms.push(arm);
    }

    // 눈
    const eyes = [];
    for (const sx of [-0.32, 0.32]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
      white.scale.set(1, 1.25, 0.6);
      white.position.set(sx, 1.28, 0.72);
      g.add(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0x16181f }));
      pupil.position.set(sx, 1.28, 0.86);
      g.add(pupil);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      shine.position.set(sx + 0.03, 1.34, 0.92);
      g.add(shine);
      eyes.push(white, pupil, shine);
    }

    // 볼터치
    for (const sx of [-0.55, 0.55]) {
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16),
        new THREE.MeshBasicMaterial({ color: 0xff7a9c }));
      cheek.position.set(sx, 1.06, 0.74);
      cheek.lookAt(sx * 2, 1.06, 3);
      g.add(cheek);
    }

    // 타입별 부속
    this._addFeatures(g, def, { bodyMat, accentMat, bellyMat, mats });

    g.traverse((o) => { if (o.isMesh) o.castShadow = o.castShadow || false; });
    g.userData = {
      def, eyes, arms, mats,
      baseY: 0, phase: Math.random() * Math.PI * 2,
      blink: 0, nextBlink: 2 + Math.random() * 3,
      flash: 0,
    };
    g.scale.setScalar(def.scale || 1);
    return g;
  }

  // 진짜 포켓몬 공식 이미지를 3D 무대에 세운 스프라이트 캐릭터.
  // 발을 바닥에 고정한 채 숨쉬기·살짝 흔들림. 카메라를 향하도록 빌보드.
  _buildSprite(def) {
    const g = new THREE.Group();
    const holder = new THREE.Group();             // 발(원점) 기준 피벗
    g.add(holder);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.0),
      new THREE.MeshBasicMaterial({ map: this._shadowTex(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.12;
    g.add(shadow);

    const planeMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), planeMat);
    plane.visible = false;                         // 텍스처 로드 후 표시
    holder.add(plane);

    g.userData = {
      def, isSprite: true, holder, plane, shadow,
      eyes: [], arms: [], mats: [planeMat],
      phase: Math.random() * Math.PI * 2, blink: 0, nextBlink: 99, flash: 0,
    };

    this._loadTex(def.formArt != null ? def.formArt : def.id).then((tex) => {
      const img = tex.image;
      const aspect = (img && img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 0.85;
      const H = Math.min(3.7, 2.5 * (def.scale || 1)); // 상한: 거다이맥스 등 큰 폼이 화면 밖으로 안 나가게
      const W = H * aspect;
      plane.geometry.dispose();
      plane.geometry = new THREE.PlaneGeometry(W, H);
      plane.position.set(0, H / 2 + 0.18, 0);      // 발이 바닥에 닿게
      planeMat.map = tex;
      planeMat.needsUpdate = true;
      plane.visible = true;
      shadow.scale.set(W * 0.5, W * 0.3, 1);
      if (def.tera) this._addTeraCrown(g, def.teraType || def.type, H + 0.18, plane, tex); // 테라스탈 결정 효과
    }).catch(() => {
      // 이미지 실패 → 같은(이미 배치된) 그룹에 절차적 모델 이식
      while (g.children.length) g.remove(g.children[0]);
      const p = this._buildProcedural(def);
      for (const c of [...p.children]) g.add(c);
      g.userData = p.userData;
      g.scale.copy(p.scale);
    });

    return g;
  }

  _loadTex(id) {
    if (this.texCache.has(id)) return this.texCache.get(id);
    const url = artUrl(id);
    const p = url
      ? new Promise((res, rej) => this.texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, rej))
      : Promise.reject(new Error('no dex'));
    this.texCache.set(id, p);
    return p;
  }

  _shadowTex() {
    if (this._shadowTexCache) return this._shadowTexCache;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.45)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.2)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    this._shadowTexCache = new THREE.CanvasTexture(c);
    return this._shadowTexCache;
  }

  // 스프라이트 이미지로부터 "결정화" 텍스처 생성: 밝은 유리 보석 질감 — 흰빛 베이스 + 타입색 색조 + 큰 결정면(facet).
  _makeCrystalTexture(image, colorNum) {
    const hex = '#' + ('000000' + (colorNum >>> 0).toString(16)).slice(-6);
    const iw = image.naturalWidth || 256, ih = image.naturalHeight || 256;
    const w = 320, h = Math.max(1, Math.round(320 * ih / iw));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-atop';   // 이후 그리기는 포켓몬 실루엣 안에만
    // 유리/보석 베이스: 흰빛으로 밝게(투명 보석 느낌) + 타입색 색조
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.3; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hex; ctx.globalAlpha = 0.32; ctx.fillRect(0, 0, w, h);
    // 큰 결정면: 밝은 흰 면 / 타입색 면 교차 (깎인 보석)
    for (let i = 0; i < 42; i++) {
      const x = Math.random() * w, y = Math.random() * h, s = 26 + Math.random() * 56;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.random() * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s, s * (Math.random() * 0.6 + 0.2));
      ctx.lineTo(s * (Math.random() * 0.6 + 0.2), s);
      ctx.closePath();
      if (Math.random() > 0.5) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.3 + Math.random() * 0.5; }   // 흰 하이라이트 면
      else { ctx.fillStyle = hex; ctx.globalAlpha = 0.12 + Math.random() * 0.3; }                            // 타입색 면
      ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 테라스탈(SV 기준): 머리 위 결정 왕관 + 몸 전체가 깎인 보석처럼 결정화 + 바닥 글로우 링.
  _addTeraCrown(g, type, topY, plane, tex) {
    const color = TYPE_COLORS[type] || 0x7fe3ff;
    const gemMat = () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.85, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.95 });

    // 테라 주얼 왕관: 밴드(머리 위 타원 띠) + 위로 솟은 결정 + 정면 육각 보석(화난 눈) — 카메라를 향함.
    const crown = new THREE.Group();
    crown.position.y = topY - (plane && plane.geometry ? plane.geometry.parameters.height * 0.12 : 0); // 머리에 더 가깝게
    crown.scale.setScalar(0.85);
    const metalMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.2 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.055, 8, 6), metalMat);
    band.rotation.x = -1.15; // 앞으로 기울여 타원(왕관 띠)으로 보이게
    crown.add(band);
    const top = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), gemMat());
    top.scale.set(1, 1.6, 0.65); top.position.set(0, 0.3, -0.02);
    crown.add(top);
    for (const sx of [-0.28, 0.28]) { // 양옆 작은 결정
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), gemMat());
      s.scale.set(1, 1.4, 0.6); s.position.set(sx, 0.17, 0.02);
      crown.add(s);
    }
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 6), gemMat()); // 정면 육각 결정
    hex.rotation.x = Math.PI / 2; hex.position.set(0, 0.02, 0.4);
    crown.add(hex);
    for (const sx of [-0.05, 0.05]) { // 화난 눈 두 개(상징)
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0x141414 }));
      eye.scale.set(1, 1.5, 1);
      eye.position.set(sx, 0.03, 0.45);
      eye.rotation.z = sx > 0 ? -0.5 : 0.5;
      crown.add(eye);
    }
    g.add(crown);

    // 바닥 타입색 글로우 링
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.95, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.16;
    g.add(ring);

    // 몸 보석화(테라스탈의 핵심): 스프라이트로부터 "결정화 텍스처"(타입색 틴트 + 무작위 결정면)를
    // 만들어 몸 위에 덮어 깎인 보석처럼 보이게 + 가산 광택 + 반짝이는 패싯.
    let glowMat = null;
    const sparkles = [];
    if (plane && tex && tex.image) {
      const pw = plane.geometry.parameters.width, ph = plane.geometry.parameters.height;
      const crystalTex = this._makeCrystalTexture(tex.image, color);
      const crystal = new THREE.Mesh(plane.geometry, new THREE.MeshBasicMaterial({ map: crystalTex, transparent: true, alphaTest: 0.5, opacity: 0.9, depthWrite: false }));
      crystal.position.copy(plane.position); crystal.position.z += 0.006; plane.parent.add(crystal); // 결정 표면
      glowMat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, alphaTest: 0.5, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
      const glow = new THREE.Mesh(plane.geometry, glowMat);
      glow.position.copy(plane.position); glow.position.z += 0.014; plane.parent.add(glow);          // 광택(luster)
      for (let i = 0; i < 5; i++) {                                                                   // 반짝이는 패싯 glint
        const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.075),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending }));
        sp.position.set((Math.random() - 0.5) * pw * 0.45, plane.position.y + (Math.random() - 0.5) * ph * 0.5, 0.03);
        sp.userData.ph = Math.random() * Math.PI * 2;
        plane.parent.add(sp); sparkles.push(sp);
      }
    }

    g.userData.teraCrown = crown;
    g.userData.teraCrownBaseY = crown.position.y;
    g.userData.teraRing = ring;
    g.userData.teraGlow = glowMat;
    g.userData.teraSparkles = sparkles;
  }

  // 스프라이트 아이들 애니메이션: 카메라 향하기 + 발 고정 숨쉬기 + 피격 틴트
  _animateSprite(g, u, dt) {
    const dx = this.camera.position.x - g.position.x;
    const dz = this.camera.position.z - g.position.z;
    g.rotation.y = Math.atan2(dx, dz);
    const br = Math.sin(this._t * 2.6 + u.phase);
    if (u.holder) {
      u.holder.scale.set(1 - br * 0.025, 1 + br * 0.04, 1);
      u.holder.rotation.z = Math.sin(this._t * 1.6 + u.phase) * 0.03;
    }
    const mat = u.plane && u.plane.material;
    if (u.flash > 0) {
      u.flash -= dt;
      const f = Math.max(0, u.flash) / 0.3;
      if (mat) mat.color.setRGB(1, 1 - f * 0.5, 1 - f * 0.5);
    } else if (mat) {
      mat.color.setRGB(1, 1, 1);
    }
    if (u.teraCrown) u.teraCrown.position.y = u.teraCrownBaseY + Math.sin(this._t * 1.6) * 0.05;  // 왕관 둥실
    if (u.teraRing) u.teraRing.material.opacity = 0.3 + Math.sin(this._t * 3) * 0.15;             // 링 맥동
    if (u.teraGlow) u.teraGlow.opacity = 0.2 + (Math.sin(this._t * 2.4) * 0.5 + 0.5) * 0.22;      // 몸 광택 명멸
    if (u.teraSparkles) {                                                                          // 패싯 반짝임
      for (const sp of u.teraSparkles) {
        const tw = Math.sin(this._t * 4 + sp.userData.ph) * 0.5 + 0.5;
        sp.material.opacity = 0.12 + tw * 0.85;
        sp.scale.setScalar(0.45 + tw * 0.85);
        sp.rotation.y += dt * 2.2; sp.rotation.x += dt * 1.3;
      }
    }
  }

  _addFeatures(g, def, { bodyMat, accentMat, mats }) {
    const F = def.features || [];
    const acc = accentMat;
    if (F.includes('boltEars')) {
      for (const sx of [-0.45, 0.45]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 4), acc);
        ear.position.set(sx, 2.0, 0);
        ear.rotation.z = sx > 0 ? -0.3 : 0.3;
        ear.rotation.y = Math.PI / 4;
        ear.castShadow = true;
        g.add(ear);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4),
          new THREE.MeshStandardMaterial({ color: 0x2b2b2b }));
        tip.position.set(sx, 2.45, 0);
        tip.rotation.copy(ear.rotation);
        g.add(tip);
      }
    }
    if (F.includes('roundEars')) {
      for (const sx of [-0.55, 0.55]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), bodyMat);
        ear.position.set(sx, 1.85, 0);
        ear.castShadow = true;
        g.add(ear);
      }
    }
    if (F.includes('flameTail')) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 12),
        new THREE.MeshStandardMaterial({ color: TYPE_COLORS.fire, emissive: 0xff5500, emissiveIntensity: 0.8 }));
      flame.position.set(0, 1.0, -0.85);
      flame.rotation.x = -0.5;
      g.add(flame);
      g.userData && (g.userData.flame = flame);
    }
    if (F.includes('finBack')) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 3), acc);
      fin.position.set(0, 1.7, -0.45);
      fin.rotation.x = 0.2;
      g.add(fin);
    }
    if (F.includes('leafHead')) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), acc);
      stem.position.set(0, 2.0, 0);
      g.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x7be05a }));
      leaf.scale.set(0.4, 0.1, 1.0);
      leaf.position.set(0, 2.25, 0.1);
      leaf.rotation.x = -0.4;
      g.add(leaf);
    }
    if (F.includes('spikeBack')) {
      for (const z of [-0.3, 0.1, 0.5]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8), acc);
        spike.position.set(0, 1.75 - Math.abs(z) * 0.3, z - 0.3);
        spike.castShadow = true;
        g.add(spike);
      }
    }
    if (F.includes('hornSmall')) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), acc);
      horn.position.set(0, 2.0, 0.1);
      g.add(horn);
    }
    if (F.includes('bubbleCheek')) {
      for (const sx of [-0.7, 0.7]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        b.position.set(sx, 1.0, 0.5);
        g.add(b);
      }
    }
    if (F.includes('cheeks')) {
      for (const sx of [-0.62, 0.62]) {
        const c = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16),
          new THREE.MeshBasicMaterial({ color: 0xff5060 }));
        c.position.set(sx, 0.98, 0.72);
        c.lookAt(sx * 2, 0.98, 3);
        g.add(c);
      }
    }
  }

  // ---- 배치 ---------------------------------------------------------------
  spawnAlly(def) {
    if (this.ally) this.scene.remove(this.ally);
    this.ally = this.buildCreature(def);
    this.ally.position.copy(ALLY_POS);
    this.ally.rotation.y = -0.5;
    this.scene.add(this.ally);
    this._appearAnim(this.ally);
    return this.ally;
  }

  spawnEnemy(def) {
    this.setBackdrop(def.type); // 적 타입에 맞춰 배경 전환
    if (this.enemy) this.scene.remove(this.enemy);
    this.enemy = this.buildCreature(def);
    this.enemy.position.copy(ENEMY_POS);
    this.enemy.rotation.y = 0.6;
    this.scene.add(this.enemy);
    this._appearAnim(this.enemy);
    return this.enemy;
  }

  removeEnemy() {
    if (this.enemy) { this.scene.remove(this.enemy); this.enemy = null; }
  }

  // 도망 연출: 적이 옆으로 깡총깡총 뛰며 사라진다 → 제거 후 콜백.
  fleeEnemy(done) {
    const g = this.enemy;
    if (!g) { done && done(); return; }
    const baseX = g.position.x, baseY = g.position.y;
    this.effects.push(this._tween(0.75, (p) => {
      g.position.x = baseX + p * 7;                                  // 화면 밖으로 이동
      g.position.y = baseY + Math.abs(Math.sin(p * Math.PI * 4)) * 0.45; // 깡총깡총
      g.rotation.y = 0.6 + p * 2.0;
      g.traverse((o) => { if (o.isMesh && o.material) { o.material.transparent = true; o.material.opacity = Math.max(0, 1 - p * 1.2); } });
    }, () => { this.removeEnemy(); done && done(); }));
  }

  // 진화 연출: 현재 아군이 빛나며 정지 → 새 형태로 교체 → 등장 연출.
  evolveAlly(newDef, done) {
    const old = this.ally;
    if (!old) { this.spawnAlly(newDef); done && done(); return; }
    this.screenShake(0.12, 1.0);
    const baseScale = old.scale.x;
    this.effects.push(this._tween(1.1, (p) => {
      const f = (Math.sin(p * Math.PI * 8) * 0.5 + 0.5) * Math.min(1, p * 1.5); // 점점 빨라지는 깜빡임
      old.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setRGB(f, f, f); });
      old.scale.setScalar(baseScale * (1 + p * 0.06));
    }, () => {
      const pos = old.position.clone();
      this._burst(pos.clone().add(new THREE.Vector3(0, 1.0, 0)), 'electric');
      this.screenShake(0.3, 0.4);
      this.spawnAlly(newDef);       // 진화형으로 교체 + 등장 트윈
      done && done();
    }));
  }

  // 실제 포켓몬 모델(.glb) 슬롯: models/<id>.glb 가 있으면 절차적 모델 대신 사용.
  // 파일이 등록되기 전까지는 항상 절차적 모델로 폴백한다.
  static modelUrl(id) { return `models/${id}.glb`; }

  _appearAnim(g) {
    const target = g.scale.x;
    g.scale.setScalar(0.01);
    this.effects.push(this._tween(0.45, (p) => {
      const s = target * (1 + Math.sin(p * Math.PI) * 0.15) * easeOutBack(p);
      g.scale.setScalar(Math.max(0.01, s));
    }, () => g.scale.setScalar(target)));
  }

  // ---- 공격 이펙트 --------------------------------------------------------
  // 타입(캐릭터 특성)별로 다른 공격. opts.finisher=true면 기절시키는 마지막 일격 → 더 강력한 연출.
  attack(fromSide, type, onImpact, opts = {}) {
    const finisher = !!(opts && opts.finisher);
    const attacker = fromSide === 'ally' ? this.ally : this.enemy;
    const target = fromSide === 'ally' ? this.enemy : this.ally;
    if (!attacker || !target) { onImpact && onImpact(); return; }

    const color = TYPE_COLORS[type] || 0xffffff;
    const from = attacker.position.clone(); from.y += 1.1;
    const to = target.position.clone(); to.y += 1.0;

    this._lunge(attacker, target, finisher);
    if (finisher) this._charge(from, color);

    let impactDelay;
    if (opts && opts.move) {
      impactDelay = this._playMove(from, to, opts.move, finisher, target); // 명명된 기술(2~3종 랜덤)
    } else {
      const fn = this[`_move_${type}`] ? `_move_${type}` : '_move_default';
      impactDelay = this[fn](from, to, color, finisher, target, type);
    }

    const power = (finisher ? 2.4 : 1) * (opts.power || 1); // 피니쉬 + 타입 상성
    let fired = false;
    const fire = () => { if (fired) return; fired = true; onImpact && onImpact(); };
    setTimeout(() => {
      this._burst(to, type, power);
      this.hitFlash(target);
      this.screenShake(Math.min(0.85, 0.28 + power * 0.22), finisher ? 0.55 : 0.35);
      if (finisher) this._finisherFlash(color);
      fire();
    }, impactDelay);
    setTimeout(fire, impactDelay + 500); // 임팩트 누락 보정
  }

  _lunge(attacker, target, fin) {
    const start = attacker.position.clone();
    const lunge = start.clone().lerp(target.position, fin ? 0.32 : 0.22);
    this.effects.push(this._tween(fin ? 0.42 : 0.32, (p) => {
      const k = p < 0.5 ? p * 2 : (1 - p) * 2;
      attacker.position.lerpVectors(start, lunge, easeOutQuad(k));
    }, () => attacker.position.copy(start)));
  }

  // 피니쉬 차지: 시전 지점에 빛이 모이는 링
  _charge(pos, color) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.5, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    ring.position.copy(pos); ring.lookAt(this.camera.position);
    this.scene.add(ring);
    this.effects.push(this._tween(0.35, (p) => {
      ring.scale.setScalar(2.2 * (1 - p) + 0.3);
      ring.material.opacity = p < 0.8 ? p : (1 - p) * 5;
    }, () => { this.scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); }));
  }

  // 공통 투사체 스트림. 반환: 임팩트 지연(ms).
  _stream(from, to, o) {
    const color = o.color, type = o.type || 'normal';
    const count = o.count || 16, dur = o.dur || 0.45;
    const arc = o.arc == null ? 0.8 : o.arc, spin = o.spin == null ? 6 : o.spin;
    const scaleK = o.scale || 1, straight = !!o.straight, swirl = !!o.swirl;
    const particles = [];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this._particleGeo(type),
        new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending }));
      mesh.position.copy(from);
      const sp = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(straight ? 0.35 : 0.85);
      mesh.userData = { sp, delay: (i / count) * dur * 0.5, rot: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(spin), sw: Math.random() * Math.PI * 2 };
      this.scene.add(mesh); particles.push(mesh);
    }
    this.effects.push({
      time: 0, parent: this,
      update(dt) {
        this.time += dt; const p = Math.min(this.time / dur, 1);
        for (const m of particles) {
          const pp = Math.min(Math.max((this.time - m.userData.delay) / (dur - 0.1), 0), 1);
          m.position.lerpVectors(from, to, pp);
          m.position.add(m.userData.sp.clone().multiplyScalar(1 - pp));
          if (!straight) m.position.y += Math.sin(pp * Math.PI) * arc;
          if (swirl) { m.position.x += Math.cos(m.userData.sw + pp * 10) * 0.3 * (1 - pp); m.position.z += Math.sin(m.userData.sw + pp * 10) * 0.3 * (1 - pp); }
          m.rotation.x += m.userData.rot.x * dt; m.rotation.y += m.userData.rot.y * dt;
          m.material.opacity = pp < 1 ? 1 : Math.max(0, 1 - (pp - 1));
          m.scale.setScalar((0.6 + pp * 0.6) * scaleK);
        }
        if (p >= 1) { for (const m of particles) { this.parent.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } return false; }
        return true;
      },
    });
    return dur * 1000 * 0.85;
  }

  _move_default(from, to, color, fin, target, type) {
    return this._stream(from, to, { color, type, count: fin ? 30 : 16, arc: 0.8, spin: 6, scale: fin ? 1.7 : 1 });
  }
  _move_fire(from, to, color, fin) {
    this._stream(from, to, { color, type: 'fire', count: fin ? 40 : 26, arc: 0.45, spin: 3, scale: fin ? 1.8 : 1.1 });
    return this._stream(from, to, { color: 0xffd24a, type: 'fire', count: fin ? 18 : 10, arc: 0.3, spin: 2, scale: fin ? 1.4 : 0.9 });
  }
  _move_water(from, to, color, fin) {
    return this._stream(from, to, { color, type: 'water', count: fin ? 40 : 26, straight: true, spin: 4, scale: fin ? 1.5 : 1 });
  }
  _move_grass(from, to, color, fin) {
    return this._stream(from, to, { color, type: 'grass', count: fin ? 34 : 22, arc: 0.9, spin: 12, scale: fin ? 1.5 : 1, swirl: true });
  }
  _move_ice(from, to, color, fin) {
    return this._stream(from, to, { color, type: 'ice', count: fin ? 30 : 18, arc: 0.4, spin: 5, scale: fin ? 1.5 : 1 });
  }
  // 전기: 즉발 지그재그 번개 + 흰 글로우
  _move_electric(from, to, color, fin) {
    const seg = 9, pts = [];
    for (let i = 0; i <= seg; i++) {
      const v = from.clone().lerp(to, i / seg);
      if (i > 0 && i < seg) { v.x += (Math.random() - 0.5) * 0.8; v.y += (Math.random() - 0.5) * 0.8; v.z += (Math.random() - 0.5) * 0.4; }
      pts.push(v);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, seg * 3, fin ? 0.13 : 0.07, 6, false);
    const bolt = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending }));
    const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending }));
    this.scene.add(bolt); this.scene.add(glow);
    this.effects.push({
      time: 0, parent: this,
      update(dt) {
        this.time += dt; const p = this.time / (fin ? 0.4 : 0.3);
        const fl = p < 0.65 ? (Math.random() * 0.5 + 0.5) : Math.max(0, 1 - (p - 0.65) / 0.35);
        bolt.material.opacity = fl; glow.material.opacity = fl * 0.4;
        if (p >= 1) { this.parent.scene.remove(bolt); this.parent.scene.remove(glow); geo.dispose(); bolt.material.dispose(); glow.material.dispose(); return false; }
        return true;
      },
    });
    return fin ? 240 : 150;
  }
  // 에스퍼: 대상을 살짝 띄우고 보라빛 오브가 휘감음
  _move_psychic(from, to, color, fin, target) {
    if (target) {
      const baseY = target.position.y;
      this.effects.push(this._tween(0.55, (p) => { target.position.y = baseY + Math.sin(p * Math.PI) * (fin ? 0.7 : 0.4); }, () => { target.position.y = baseY; }));
    }
    const n = fin ? 12 : 7, orbs = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(fin ? 0.17 : 0.12, 10, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending }));
      this.scene.add(m); orbs.push(m);
    }
    const c = to.clone();
    this.effects.push({
      time: 0, parent: this,
      update(dt) {
        this.time += dt; const p = Math.min(this.time / 0.6, 1);
        orbs.forEach((m, i) => {
          const a = this.time * 7 + (i / orbs.length) * Math.PI * 2;
          const r = (1 - p) * 1.3 + 0.2;
          m.position.set(c.x + Math.cos(a) * r, c.y + Math.sin(a * 1.3) * r * 0.6 + (1 - p) * 0.4, c.z + Math.sin(a) * r);
          m.material.opacity = 1 - p;
        });
        if (p >= 1) { for (const m of orbs) { this.parent.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } return false; }
        return true;
      },
    });
    return 360;
  }
  // 굵은 빔(드래곤/솔라빔/냉동빔 등 공용)
  _beam(from, to, color, fin) {
    const dir = to.clone().sub(from); const len = dir.length();
    const geo = new THREE.CylinderGeometry(fin ? 0.34 : 0.2, fin ? 0.22 : 0.12, len, 14, 1, true);
    const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.copy(from.clone().add(to).multiplyScalar(0.5));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    beam.scale.set(0.1, 1, 0.1); this.scene.add(beam);
    this.effects.push({
      time: 0, parent: this,
      update(dt) {
        this.time += dt; const p = this.time / 0.42;
        const g = Math.min(1, p * 3.5); beam.scale.set(g, 1, g);
        beam.material.opacity = p < 0.5 ? 1 : Math.max(0, 1 - (p - 0.5) / 0.5);
        if (p >= 1) { this.parent.scene.remove(beam); geo.dispose(); beam.material.dispose(); return false; }
        return true;
      },
    });
    return 230;
  }
  // 드래곤: 굵은 빔 + 직진 코어
  _move_dragon(from, to, color, fin) {
    this._beam(from, to, color, fin);
    this._stream(from, to, { color, type: 'default', count: fin ? 16 : 8, arc: 0.2, spin: 5, scale: fin ? 1.5 : 1, straight: true });
    return 230;
  }

  // 한자(大/雷 등)가 불·전기 모양으로 천천히 앞으로 날아가는 시그니처 연출.
  _fx_kanji(from, to, glyph, color, fin, type) {
    const hex = '#' + ('000000' + (color >>> 0).toString(16)).slice(-6);
    const cnv = document.createElement('canvas'); cnv.width = cnv.height = 256;
    const c = cnv.getContext('2d');
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 190px "Apple SD Gothic Neo", serif';
    c.shadowColor = hex; c.shadowBlur = 46; c.fillStyle = hex; c.fillText(glyph, 128, 140);
    c.shadowBlur = 22; c.fillText(glyph, 128, 140);
    c.shadowBlur = 10; c.fillStyle = '#ffffff'; c.fillText(glyph, 128, 140);
    const tex = new THREE.CanvasTexture(cnv);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    const base = fin ? 2.6 : 2.0;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(base, base), mat);
    plane.position.copy(from); plane.renderOrder = 999; this.scene.add(plane);
    // 불·전기 잔불 입자도 같이 직진
    this._stream(from, to, { color, type: type || 'fire', count: fin ? 22 : 13, arc: 0.15, spin: 3, scale: fin ? 1.3 : 0.95, straight: true, dur: 0.85 });
    const dur = fin ? 1.05 : 0.85;
    this.effects.push({
      time: 0, parent: this,
      update(dt) {
        this.time += dt; const p = Math.min(this.time / dur, 1);
        plane.position.lerpVectors(from, to, p < 0.85 ? p / 0.85 : 1);
        plane.quaternion.copy(this.parent.camera.quaternion);
        plane.scale.setScalar((0.55 + p * 0.85) * (fin ? 1.25 : 1));
        mat.opacity = (p < 0.82 ? 1 : Math.max(0, 1 - (p - 0.82) / 0.18)) * (0.82 + Math.random() * 0.18);
        if (p >= 1) { this.parent.scene.remove(plane); plane.geometry.dispose(); mat.dispose(); tex.dispose(); return false; }
        return true;
      },
    });
    return dur * 1000 * 0.82;
  }

  // 두 줄기 물대포가 나란히 천천히 적에게 뻗는 연출.
  _fx_twin(from, to, color, type, fin) {
    const dur = 0.8;
    for (const oy of [0.3, -0.3]) {
      const f = from.clone(); f.y += oy; const t = to.clone(); t.y += oy * 0.4;
      this._stream(f, t, { color, type: type || 'water', count: fin ? 28 : 18, arc: 0.04, spin: 2, scale: fin ? 1.5 : 1.1, straight: true, dur });
    }
    return dur * 1000 * 0.85;
  }

  // 기술 스펙(타입별 2~3종)에 따라 연출 실행. 반환: 임팩트 지연(ms).
  _playMove(from, to, move, fin, target) {
    const color = TYPE_COLORS[move.geo] || 0xffffff;
    if (move.fx === 'kanji') return this._fx_kanji(from, to, move.glyph || '大', color, fin, move.geo);
    if (move.fx === 'twin') return this._fx_twin(from, to, color, move.geo, fin);
    switch (move.style) {
      case 'lightning': return this._move_electric(from, to, color, fin);
      case 'beam':
        this._stream(from, to, { color, type: move.geo, count: fin ? 14 : 8, arc: 0.15, spin: 4, scale: fin ? 1.4 : 1, straight: true });
        return this._beam(from, to, color, fin);
      case 'orbs': return this._move_psychic(from, to, color, fin, target);
      case 'tackle':
        this._stream(from, to, { color, type: move.geo, count: fin ? 10 : 5, arc: 0.2, spin: 6, scale: fin ? 1.4 : 0.9, straight: true });
        return 210;
      case 'burst':
        return this._stream(from, to, { color, type: move.geo, count: fin ? Math.round((move.count || 24) * 1.5) : (move.count || 24), arc: 0.15, spin: 6, scale: fin ? 1.7 : 1.15, straight: true });
      case 'stream':
      default:
        return this._stream(from, to, { color, type: move.geo, count: fin ? Math.round((move.count || 16) * 1.6) : (move.count || 16), arc: move.arc == null ? 0.8 : move.arc, spin: move.spin == null ? 6 : move.spin, scale: (move.scale || 1) * (fin ? 1.5 : 1), straight: !!move.straight, swirl: !!move.swirl });
    }
  }

  // 피니쉬: 화면 전체 섬광
  _finisherFlash(color) {
    const hex = '#' + ('000000' + (color >>> 0).toString(16)).slice(-6);
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:60;opacity:0.85;transition:opacity .5s ease-out;background:radial-gradient(circle at 50% 45%, ${hex}, #ffffffcc 35%, transparent 72%);`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 650);
  }

  _burst(pos, type, power = 1) {
    const color = TYPE_COLORS[type] || 0xffffff;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.35, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    ring.position.copy(pos);
    ring.lookAt(this.camera.position);
    this.scene.add(ring);
    this.effects.push(this._tween(0.4 + 0.15 * (power - 1), (p) => {
      ring.scale.setScalar(1 + p * 5 * power);
      ring.material.opacity = 1 - p;
    }, () => { this.scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); }));

    const shards = [];
    const nShards = Math.round(18 * power);
    for (let i = 0; i < nShards; i++) {
      const m = new THREE.Mesh(this._particleGeo(type),
        new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending }));
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8 + 0.2, (Math.random() - 0.5)).normalize().multiplyScalar((3 + Math.random() * 3) * power);
      m.userData.v = v; m.scale.setScalar(power);
      this.scene.add(m);
      shards.push(m);
    }
    this.effects.push({
      time: 0,
      update(dt) {
        this.time += dt;
        const p = Math.min(this.time / 0.6, 1);
        for (const m of shards) {
          m.userData.v.y -= 9 * dt;
          m.position.addScaledVector(m.userData.v, dt);
          m.material.opacity = 1 - p;
          m.rotation.x += dt * 8; m.rotation.y += dt * 6;
        }
        if (p >= 1) { for (const m of shards) { this.parent.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } return false; }
        return true;
      },
      parent: this,
    });
  }

  _particleGeo(type) {
    switch (type) {
      case 'ice': return new THREE.TetrahedronGeometry(0.16);
      case 'rock': return new THREE.DodecahedronGeometry(0.15);
      case 'grass': return new THREE.BoxGeometry(0.22, 0.05, 0.12);
      case 'electric': return new THREE.OctahedronGeometry(0.15);
      default: return new THREE.SphereGeometry(0.13, 8, 8);
    }
  }

  hitFlash(g) {
    if (!g) return;
    g.userData.flash = 0.3;
    // 피격 흔들림
    const base = g.position.clone();
    this.effects.push(this._tween(0.3, (p) => {
      g.position.x = base.x + Math.sin(p * 40) * 0.12 * (1 - p);
    }, () => { g.position.copy(base); }));
  }

  faint(g, done) {
    if (!g) { done && done(); return; }
    const baseY = g.position.y;
    this.effects.push(this._tween(0.6, (p) => {
      g.rotation.z = p * 1.2;
      g.position.y = baseY - p * 0.3;
      for (const m of g.userData.mats) m.opacity = 1 - p, m.transparent = true;
      g.traverse((o) => { if (o.isMesh && o.material) { o.material.transparent = true; o.material.opacity = 1 - p; } });
    }, () => done && done()));
  }

  screenShake(mag, dur) {
    this.shake = { t: 0, dur, mag };
  }

  // ---- 포켓볼 ------------------------------------------------------------
  // ballType: 던질 볼 종류(몬스터/슈퍼/하이퍼/마스터) — 색·연출 반영
  throwPokeball(onShake, onResult, success, ballType) {
    const target = this.enemy;
    if (!target) { onResult && onResult(false); return; }
    const ball = this._makePokeball(ballType);
    const start = ALLY_POS.clone(); start.y = 1.4;
    const apex = new THREE.Vector3((start.x + target.position.x) / 2, 3.5, (start.z + target.position.z) / 2);
    const end = target.position.clone(); end.y = 1.0;
    ball.position.copy(start);
    this.scene.add(ball);

    // 1) 던지기 (포물선)
    this.effects.push(this._tween(0.6, (p) => {
      const a = start.clone().lerp(apex, p);
      const b = apex.clone().lerp(end, p);
      ball.position.lerpVectors(a, b, p);
      ball.rotation.z -= 0.4;
    }, () => {
      // 2) 몬스터를 볼 안으로 흡수
      this._burst(end, 'normal');
      this.screenShake(0.2, 0.2);
      const tScale = target.scale.x;
      this.effects.push(this._tween(0.4, (p) => {
        target.scale.setScalar(tScale * (1 - p));
        target.position.lerp(end, p * 0.4);
      }, () => {
        target.visible = false;
        // 3) 볼 떨어지고 흔들림 (받침대 윗면 y≈0.225 + 볼 반지름 0.4 → 0.62에 안착해 원판에 안 묻히게)
        const REST_Y = 0.62;
        ball.position.copy(end); ball.position.y = 1.0;
        this.effects.push(this._tween(0.3, (p) => { ball.position.y = 1.0 - p * (1.0 - REST_Y); }, () => {
          this._wobble(ball, 0, onShake, () => {
            if (success) {
              this._burst(ball.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 'electric');
              this.screenShake(0.3, 0.3);
              this.effects.push(this._tween(0.6, () => {}, () => {
                this.scene.remove(ball);
                onResult && onResult(true);
              }));
            } else {
              // 탈출
              target.visible = true; target.scale.setScalar(tScale);
              this._burst(end, 'normal');
              this.scene.remove(ball);
              onResult && onResult(false);
            }
          });
        }));
      }));
    }));
  }

  _wobble(ball, n, onShake, done) {
    if (n >= 3) { done && done(); return; }
    onShake && onShake(n + 1);
    this.effects.push(this._tween(0.5, (p) => {
      ball.rotation.z = Math.sin(p * Math.PI * 2) * 0.5 * (n % 2 === 0 ? 1 : -1);
    }, () => {
      ball.rotation.z = 0;
      this.effects.push(this._tween(0.25, () => {}, () => this._wobble(ball, n + 1, onShake, done)));
    }));
  }

  _makePokeball(ballType) {
    const topColor = (ballType && ballType.top) != null ? ballType.top : 0xee3b3b;
    const btnEmis = (ballType && ballType.accent) != null ? ballType.accent : 0x888888;
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.3 }));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.3 }));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: btnEmis }));
    btn.rotation.x = Math.PI / 2; btn.position.z = 0.4;
    g.add(top, bot, band, btn);
    g.castShadow = true;
    return g;
  }

  // ---- 유틸 ---------------------------------------------------------------
  _tween(dur, onUpdate, onDone) {
    return {
      time: 0,
      update(dt) {
        this.time += dt;
        const p = Math.min(this.time / dur, 1);
        onUpdate(p);
        if (p >= 1) { onDone && onDone(); return false; }
        return true;
      },
    };
  }

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // 두 캐릭터(가로 ±2.7)가 어떤 화면 비율에서도 보이도록 fov 보정
    const targetHalfWidth = 2.7;
    const dist = this.cameraBase.z;
    const hHalfTan = targetHalfWidth / dist;
    const vHalfTan = hHalfTan / aspect;
    this.camera.fov = Math.min(74, Math.max(40, (2 * Math.atan(vHalfTan) * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this._t += dt;

    // 이펙트 업데이트.
    // 주의: 이펙트의 onDone이 후속 이펙트를 push할 수 있으므로(연쇄 트윈),
    // filter로 통째로 재할당하면 그 사이 추가된 이펙트가 사라진다.
    // 새 버킷으로 옮기면서 갱신해 중간에 push된 이펙트도 보존한다.
    const active = this.effects;
    this.effects = [];
    for (let i = 0; i < active.length; i++) {
      const e = active[i];
      let keep = false;
      try { keep = e.update(dt) !== false; } catch (err) { console.error('effect error', err); }
      if (keep) this.effects.push(e);
    }

    // 아이들 애니메이션
    for (const g of [this.ally, this.enemy]) {
      if (!g || !g.userData) continue;
      const u = g.userData;
      if (u.isSprite) { this._animateSprite(g, u, dt); continue; }
      const bob = Math.sin(this._t * 2 + u.phase) * 0.06;
      // baseY는 비활성; 위치 y는 피격 트윈이 건드리므로 메쉬 내부 흔들림만
      if (g.children[0]) g.children[0].position.y = 1.0 + bob;
      // 깜빡임
      u.blink -= dt;
      if (u.blink <= 0) {
        u.nextBlink -= dt;
        if (u.nextBlink <= 0) { u.blink = 0.12; u.nextBlink = 2 + Math.random() * 3; }
      }
      const eyeScale = u.blink > 0 ? 0.1 : 1;
      for (const e of u.eyes) e.scale.y = e.scale.y * 0.6 + (e === u.eyes[0] || e === u.eyes[3] ? 1.25 : 1) * eyeScale * 0.4;
      // 피격 플래시
      if (u.flash > 0) {
        u.flash -= dt;
        const f = Math.max(0, u.flash) / 0.3;
        u.mats[0].emissive = u.mats[0].emissive || new THREE.Color();
        u.mats[0].emissive.setRGB(f, f, f);
      }
      // 불꼬리 깜빡임
      if (u.flame) u.flame.scale.y = 1 + Math.sin(this._t * 12) * 0.15;
    }

    // 카메라 흔들림
    if (this.shake.dur > 0) {
      this.shake.t += dt;
      const k = 1 - this.shake.t / this.shake.dur;
      if (k <= 0) { this.shake.dur = 0; this.camera.position.copy(this.cameraBase); }
      else {
        this.camera.position.set(
          this.cameraBase.x + (Math.random() - 0.5) * this.shake.mag * k,
          this.cameraBase.y + (Math.random() - 0.5) * this.shake.mag * k,
          this.cameraBase.z
        );
      }
      this.camera.lookAt(0, 1.1, 0);
    }

    // 동적 배경: 목표색으로 부드럽게 전환 + 밝기 일렁임(지속 변화)
    if (this._bgTarget) {
      const k = 1 - Math.pow(0.02, dt);            // 프레임레이트 독립 전환 속도
      const osc = 0.93 + Math.sin(this._t * 0.6) * 0.07;
      _tmpCol.copy(this._bgTarget).multiplyScalar(osc);
      this.scene.background.lerp(_tmpCol, k);
      _tmpCol.copy(this._fogTarget).multiplyScalar(osc);
      this.scene.fog.color.lerp(_tmpCol, k);
      if (this.groundMat) this.groundMat.color.lerp(this._groundTarget, k);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

function easeOutBack(p) { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
function easeOutQuad(p) { return 1 - (1 - p) * (1 - p); }
