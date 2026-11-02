// SC-8 stage: a pale engineering-sheet studio like the reference sheets (#f3f1ec paper, faint grid on the floor),
// soft PCF shadows, a prefiltered softbox environment, MSAA. frame(pose, cam) draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildRobot} from './robot.js';

const V3 = THREE.Vector3;
export const BG = '#f1efea';

const FLOOR_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FRAG = /* glsl */ `uniform vec3 uFloor; uniform vec3 uBg; uniform vec3 uLine; uniform vec3 uC; varying vec3 vW;
  float grid(vec2 p, float s, float w){ vec2 g = abs(fract(p / s - 0.5) - 0.5) * s; vec2 fw = fwidth(p) * 1.2; vec2 l = 1.0 - smoothstep(vec2(w), vec2(w) + fw, g); return max(l.x, l.y); }
  void main(){
    vec2 p = vW.xz;
    float g = max(grid(p, 0.25, 0.002) * 0.35, grid(p, 1.0, 0.004) * 0.75);
    vec3 col = mix(uFloor, uLine, g * 0.5);
    float d = length(p - uC.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(2.5, 7.5, d)), 1.0);
  }`;

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 7, 16);
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.05, 60);
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e6e4df');
    const sb = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.99, 0.97).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    sb(14, 6, new V3(-10, 10, 8), 2.6);
    sb(9, 9, new V3(10, 12, -6), 2.0);
    sb(18, 3, new V3(2, 4, 15), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#cfccc5', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -1;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.85;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#fff8ef', 2.3);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 20});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#fbfaf7', '#d9d5cc', 0.7));
  const SUN = new V3(-0.45, 0.8, 0.4).normalize();

  const floorMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    uniforms: {uFloor: {value: new THREE.Color('#e9e6df')}, uBg: {value: new THREE.Color(BG)}, uLine: {value: new THREE.Color('#9c968a')}, uC: {value: new V3()}},
    toneMapped: false,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({color: '#3b342b', opacity: 0.32, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}));
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const robot = buildRobot();
  scene.add(robot.root);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  /** cam: {tx, ty, tz, az, el (radians), d, sx, sy (px shift on screen)}; target given relative to the robot's X */
  const frame = (pose, cam) => {
    const L = robot.update(pose);
    const X = pose.X || 0;
    const tx = X + cam.tx;
    const {ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.cos(az), ty + d * Math.sin(el), tz - d * Math.cos(el) * Math.sin(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    floorMat.uniforms.uC.value.set(tx, 0, tz);
    floor.position.x = shade.position.x = Math.round(tx);
    sun.target.position.set(X, 0.4, 0);
    sun.position.copy(sun.target.position).addScaledVector(SUN, 8);
    sun.target.updateMatrixWorld();
    composer.render();
    return L;
  };
  const pv = new V3();
  const project = (p) => {
    if (!p) return null;
    pv.set(p[0], p[1], p[2]).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  return {renderer, scene, camera, composer, robot, resize, frame, project, size};
}
