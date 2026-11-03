// SC-8 stage: the official sheet's ivory studio (#f5f2ec paper, no grid), a big soft key with VSM shadows, a
// prefiltered softbox environment, GTAO contact shading on the machine only (floor, ghosted and overlay parts kept
// out of the AO pass), optional ink edges, MSAA, bloom off. frame(pose, cam) poses the robot and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {buildRobot} from './robot.js';

const V3 = THREE.Vector3;
export const BG = '#f5f2ec';
// the paper goes through the same Neutral tone map as the machine; feed it the linear colour that comes out as the
// wanted sRGB value, so the sheet is the reference's ivory and not a grey one
const neutral = (c) => {
  const x = Math.min(c[0], c[1], c[2]);
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let v = c.map((y) => y - off);
  const peak = Math.max(...v);
  const sc = 0.76;
  if (peak < sc) return v;
  const d = 1 - sc;
  const np = 1 - (d * d) / (peak + d - sc);
  v = v.map((y) => (y * np) / peak);
  const g = 1 - 1 / (0.15 * (peak - np) + 1);
  return v.map((y) => y + (np - y) * g);
};
export function paper(hex, exposure = 1) {
  const want = new THREE.Color(hex);
  const w = [want.r, want.g, want.b];
  let lin = w.slice();
  for (let i = 0; i < 60; i++) {
    const o = neutral(lin.map((y) => y * exposure));
    lin = lin.map((y, k) => Math.max(0, y + (w[k] - o[k]) * 0.8));
  }
  return new THREE.Color().setRGB(lin[0], lin[1], lin[2], THREE.LinearSRGBColorSpace);
}
const EXPOSURE = 1.65;

const INK_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform sampler2D tNormal;
  uniform float uNear; uniform float uFar; uniform vec2 uPx; uniform vec3 uInk; uniform float uStrength;
  varying vec2 vUv;
  float lz(vec2 uv){ float d = texture2D(tDepth, uv).x; return uNear * uFar / (uFar - d * (uFar - uNear)); }
  vec3 nn(vec2 uv){ return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0); }
  void main(){
    vec4 c = texture2D(tDiffuse, vUv);
    float z0 = lz(vUv);
    float zl = lz(vUv - vec2(uPx.x, 0.0)), zr = lz(vUv + vec2(uPx.x, 0.0));
    float zd = lz(vUv - vec2(0.0, uPx.y)), zu = lz(vUv + vec2(0.0, uPx.y));
    float lap = (abs(zl + zr - 2.0 * z0) + abs(zu + zd - 2.0 * z0)) / max(z0, 1e-3);
    float eD = smoothstep(0.006, 0.02, lap);
    vec3 n0 = nn(vUv);
    float eN = max(max(1.0 - dot(n0, nn(vUv - vec2(uPx.x, 0.0))), 1.0 - dot(n0, nn(vUv + vec2(uPx.x, 0.0)))),
                   max(1.0 - dot(n0, nn(vUv - vec2(0.0, uPx.y))), 1.0 - dot(n0, nn(vUv + vec2(0.0, uPx.y)))));
    float e = max(eD, smoothstep(0.35, 0.7, eN));
    c.rgb = mix(c.rgb, uInk, e * uStrength);
    gl_FragColor = c;
  }`;

// the paper: unlit ivory that darkens a touch toward the horizon, so the floor and the backdrop are one sheet
const FLOOR_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FRAG = /* glsl */ `uniform vec3 uFloor; uniform vec3 uBg; uniform vec3 uC; varying vec3 vW;
  void main(){
    float d = length(vW.xz - uC.xz);
    vec3 col = mix(uFloor, uBg, smoothstep(2.0, 9.0, d));
    gl_FragColor = vec4(col, 1.0);
  }`;

export function createStage({canvas, ink = 0.0}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = paper('#fdfcf7', EXPOSURE);
  scene.fog = new THREE.Fog(scene.background.clone(), 10, 26);
  const camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.05, 80);
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.8;
  gtao.updateGtaoMaterial({radius: 0.08, distanceExponent: 1.5, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const robot = buildRobot();
  scene.add(robot.root);
  // what the AO pass must not see: the paper, the shadow catcher and every ghosted (see-through) part
  const hidden = [];
  const aoVis = (v) => () => {
    floor.visible = v;
    shade.visible = v;
    if (!v) {
      hidden.length = 0;
      for (const m of robot.parts) {
        const mat = m.material;
        if (m.visible && mat && mat.transparent && (mat.opacity ?? 1) < 0.7) {
          m.visible = false;
          hidden.push(m);
        }
      }
    } else for (const m of hidden) m.visible = true;
  };
  composer.addPass(new Toggle(aoVis(false)));
  let aoOn = true;
  const gtaoRender = gtao.render.bind(gtao);
  gtao.render = (r, w, rd, ...rest) => {
    if (aoOn) return gtaoRender(r, w, rd, ...rest);
    gtao._overrideVisibility();
    gtao._renderOverride(r, gtao.normalMaterial, gtao.normalRenderTarget, 0x7777ff, 1.0);
    gtao._restoreVisibility();
  };
  composer.addPass(gtao);
  composer.addPass(new Toggle(aoVis(true)));
  const inkPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: {value: null},
        tDepth: {value: gtao.depthTexture},
        tNormal: {value: gtao.normalTexture},
        uNear: {value: camera.near},
        uFar: {value: camera.far},
        uPx: {value: new THREE.Vector2(1 / 1920, 1 / 1080)},
        uInk: {value: new THREE.Color().setRGB(0.09, 0.09, 0.1, THREE.LinearSRGBColorSpace)},
        uStrength: {value: ink},
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: INK_FRAG,
    }),
  );
  inkPass.enabled = ink > 0;
  composer.addPass(inkPass);
  composer.addPass(new OutputPass());
  // a section plane on the robot needs the same planes on the AO pass's normal material (SKILL.md trap)
  const syncClip = () => {
    const planes = robot.clipPlanes || null;
    if (gtao.normalMaterial.clippingPlanes !== planes) {
      gtao.normalMaterial.clippingPlanes = planes;
      gtao.normalMaterial.needsUpdate = true;
    }
  };

  // studio environment: warm softboxes over a pale ground, prefiltered
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e9e6e0');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.99, 0.97).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(16, 7, new V3(-11, 11, 9), 2.8);
    box(10, 10, new V3(11, 13, -7), 2.0);
    box(20, 3, new V3(2, 5, 16), 1.6);
    box(8, 3, new V3(-6, 2, -14), 1.1);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#d4d0c8', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -1.2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.72;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.42, 0.82, 0.38).normalize();
  const sun = new THREE.DirectionalLight('#fff8ef', 2.9);
  sun.castShadow = true;
  const EXT = 2.6;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 22});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 8;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.004;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#fcfbf8', '#bdb6aa', 0.4));

  const floorMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    uniforms: {uFloor: {value: paper('#fcfaf2', EXPOSURE)}, uBg: {value: paper('#fdfcf7', EXPOSURE)}, uC: {value: new V3()}},
    toneMapped: false,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({color: '#3a3128', opacity: 0.24, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.0004;
  shade.receiveShadow = true;
  scene.add(shade);

  // overlay lines in the scene (gait traces etc.) live here; kept out of AO by being LineBasic
  const overlay = new THREE.Group();
  scene.add(overlay);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    gtao.setSize(Math.round(w * pr), Math.round(h * pr));
    inkPass.material.uniforms.uPx.value.set(1 / (w * pr), 1 / (h * pr));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // the shadow box follows the robot, snapped to texels so it never shimmers
  let texel = (2 * EXT) / 4096;
  const right = new V3().crossVectors(SUN_DIR, new V3(0, 1, 0)).normalize();
  const upL = new V3().crossVectors(right, SUN_DIR).normalize();
  const tmp = new V3();

  /** cam: {tx, ty, tz (target, x relative to the robot's X), az, el (rad), d, sx, sy (px)}; spin = turntable (rad) */
  const frame = (pose, cam, spin = 0) => {
    robot.root.rotation.y = spin;
    const L = robot.update(pose);
    robot.root.rotation.y = spin;
    robot.root.updateMatrixWorld(true);
    syncClip();
    const X = pose.X || 0;
    const tx = X + cam.tx;
    const {ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.cos(az), ty + d * Math.sin(el), tz - d * Math.cos(el) * Math.sin(az));
    camera.up.set(0, 1, 0);
    if (el > 1.45) camera.up.set(-Math.cos(az), 0, Math.sin(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    floorMat.uniforms.uC.value.set(tx, 0, tz);
    floor.position.x = shade.position.x = Math.round(tx);
    tmp.set(X, 0.6, 0);
    const rr = Math.round(tmp.dot(right) / texel) * texel;
    const uu = Math.round(tmp.dot(upL) / texel) * texel;
    sun.target.position.copy(right).multiplyScalar(rr).addScaledVector(upL, uu).addScaledVector(SUN_DIR, tmp.dot(SUN_DIR));
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 10);
    sun.target.updateMatrixWorld();
    composer.render();
    return L;
  };
  const pv = new V3();
  /** a world point [x,y,z] to CSS px, null behind the camera */
  const project = (p) => {
    if (!p) return null;
    pv.set(p[0], p[1], p[2]).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  /** a point in the robot's own frame (body frame, before X and spin) to world */
  const toWorld = (p) => {
    tmp.set(p[0], p[1], p[2]).applyMatrix4(robot.root.matrixWorld);
    return [tmp.x, tmp.y, tmp.z];
  };
  // the envelope of the outer shell (internal parts excluded), measured once at the rest pose by the caller
  const envelope = () => {
    const b = new THREE.Box3();
    const bb = new THREE.Box3();
    robot.root.updateMatrixWorld(true);
    for (const m of robot.parts) {
      if (!m.visible || m.userData.internal || !m.geometry) continue;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      bb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
      b.union(bb);
    }
    return b;
  };
  // the live page's quality knobs
  const setQuality = ({samples, shadow, blur, radius, ao, inkOn}) => {
    if (samples !== undefined) {
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    }
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      texel = (2 * EXT) / shadow;
    }
    if (blur !== undefined) sun.shadow.blurSamples = blur;
    if (radius !== undefined) sun.shadow.radius = radius;
    if (ao !== undefined) {
      aoOn = ao > 0;
      gtao.needsSwap = aoOn;
      if (aoOn) {
        gtao.updateGtaoMaterial({samples: ao});
        gtao.updatePdMaterial({samples: Math.max(4, ao)});
      }
    }
    if (inkOn !== undefined) inkPass.enabled = inkOn && inkPass.material.uniforms.uStrength.value > 0;
  };
  return {renderer, scene, camera, composer, gtao, robot, overlay, resize, frame, project, toWorld, envelope, size, setQuality};
}
