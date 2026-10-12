import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { createHtlLogo, COLORS } from './logo.js';

const statusEl = document.getElementById('status');

// --- Grundsetup ---------------------------------------------------------
const scene = new THREE.Scene();
const background = new THREE.Color(0xe9ecef);
scene.background = background;

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 100);
camera.position.set(0, 1.05, -0.05);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// Desktop-Vorschau: mit der Maus um den Tisch drehen
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 0.84, -0.6);
orbit.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(1, 3, 1);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 6;
sun.shadow.radius = 4;
scene.add(sun);
scene.add(sun.target);

// --- Virtuelle Umgebung (nur VR / Desktop) -------------------------------
const environment = new THREE.Group();
scene.add(environment);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(5, 48),
  new THREE.MeshStandardMaterial({ color: 0xcfd4da })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
environment.add(floor);

// Tisch: 1.2 × 0.7 m, 75 cm hoch
const TABLE_H = 0.75;
const tableTop = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 0.04, 0.7),
  new THREE.MeshStandardMaterial({ color: 0x8b6a4e, roughness: 0.7 })
);
tableTop.position.set(0, TABLE_H - 0.02, -0.6);
tableTop.castShadow = tableTop.receiveShadow = true;
environment.add(tableTop);
for (const [x, z] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) {
  const leg = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, TABLE_H - 0.04, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  leg.position.set(x, (TABLE_H - 0.04) / 2, -0.6 + z);
  leg.castShadow = true;
  environment.add(leg);
}
// Flächen, auf die man im VR-Modus das Logo stellen kann
const placeableSurfaces = [tableTop, floor];

// --- Logo --------------------------------------------------------------
const logo = createHtlLogo(0.35);
logo.position.set(0, TABLE_H, -0.6);
scene.add(logo);

// Schatten auf echten Tisch im AR-Modus (unsichtbare Fläche, zeigt nur Schatten)
const shadowCatcher = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.ShadowMaterial({ opacity: 0.3 })
);
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = 0.001;
shadowCatcher.receiveShadow = true;
shadowCatcher.visible = false;
logo.add(shadowCatcher);

let popStart = -1; // Startzeit der "Aufploppen"-Animation

function placeLogo(position) {
  logo.position.copy(position);
  // Logo zum Benutzer drehen (nur um die Hochachse)
  const eye = new THREE.Vector3();
  camera.getWorldPosition(eye);
  logo.rotation.set(0, Math.atan2(eye.x - position.x, eye.z - position.z), 0);
  logo.visible = true;
  popStart = clock.elapsedTime;
  // Licht mitbewegen, damit der Schatten scharf bleibt
  sun.target.position.copy(position);
  sun.position.copy(position).add(new THREE.Vector3(1, 3, 1));
}

// --- Reticle (Ring, zeigt wo das Logo hinkommt) --------------------------
function createReticle() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.075, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COLORS.red })
  );
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.012, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COLORS.red })
  );
  ring.add(dot);
  ring.matrixAutoUpdate = false;
  ring.visible = false;
  scene.add(ring);
  return ring;
}

// --- Controller & Hände --------------------------------------------------
const controllerModelFactory = new XRControllerModelFactory();
const handModelFactory = new XRHandModelFactory();
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();

const rayGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -1),
]);

const controllers = [];
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  controller.userData.reticle = createReticle();
  controller.addEventListener('select', onSelect);
  controller.addEventListener('squeezestart', onSqueeze);
  controller.addEventListener('connected', (e) => onConnected(controller, e.data));
  controller.addEventListener('disconnected', () => onDisconnected(controller));

  const line = new THREE.Line(rayGeometry, new THREE.LineBasicMaterial({ color: COLORS.red }));
  line.scale.z = 3;
  controller.add(line);
  controller.userData.line = line;
  scene.add(controller);
  controllers.push(controller);

  const grip = renderer.xr.getControllerGrip(i);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);

  const hand = renderer.xr.getHand(i);
  hand.add(handModelFactory.createHandModel(hand, 'mesh'));
  scene.add(hand);
}

async function onConnected(controller, inputSource) {
  controller.userData.inputSource = inputSource;
  // Hit-Test entlang des Controller-Strahls → trifft echte Flächen (Tisch, Boden)
  const session = renderer.xr.getSession();
  if (session?.requestHitTestSource) {
    try {
      controller.userData.hitTestSource = await session.requestHitTestSource({
        space: inputSource.targetRaySpace,
      });
    } catch (err) {
      console.warn('Hit-Test nicht verfügbar:', err);
    }
  }
}

function onDisconnected(controller) {
  controller.userData.hitTestSource?.cancel();
  controller.userData.hitTestSource = undefined;
  controller.userData.inputSource = undefined;
  controller.userData.reticle.visible = false;
}

// Trigger / Pinch: Logo an der Ring-Position abstellen
function onSelect(event) {
  const reticle = event.target.userData.reticle;
  if (!reticle.visible) return;
  placeLogo(new THREE.Vector3().setFromMatrixPosition(reticle.matrix));
  vibrate(event.target, 0.5, 50);
}

// Grip-Taste: Logo um 45° drehen
function onSqueeze(event) {
  if (!logo.visible) return;
  logo.rotation.y += Math.PI / 4;
  vibrate(event.target, 0.3, 30);
}

function vibrate(controller, intensity, ms) {
  controller.userData.inputSource?.gamepad?.hapticActuators?.[0]?.pulse?.(intensity, ms);
}

// Ermittelt pro Frame, wohin der Controller auf eine Fläche zeigt
function updateReticle(controller, frame, refSpace) {
  const { reticle, hitTestSource, line } = controller.userData;
  reticle.visible = false;
  line.scale.z = 3;
  if (!controller.userData.inputSource) return;

  // 1) Echte Welt (AR): WebXR Hit-Test
  if (hitTestSource && frame) {
    const hit = frame.getHitTestResults(hitTestSource)[0];
    const pose = hit?.getPose(refSpace);
    // Nur waagrechte Flächen (Tisch, Boden) – keine Wände
    const m = pose?.transform.matrix;
    if (m && m[5] > 0.7) {
      reticle.matrix.fromArray(m);
      reticle.visible = true;
      line.scale.z = controller.position.distanceTo(
        new THREE.Vector3().setFromMatrixPosition(reticle.matrix)
      );
      return;
    }
  }

  // 2) Virtuelle Welt (VR): Strahl gegen Tisch/Boden
  if (!environment.visible) return;
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  const hit = raycaster.intersectObjects(placeableSurfaces, false)[0];
  if (hit && hit.face.normal.y > 0.5) {
    reticle.matrix.makeTranslation(hit.point.x, hit.point.y + 0.001, hit.point.z);
    reticle.visible = true;
    line.scale.z = hit.distance;
  }
}

// --- XR-Buttons ---------------------------------------------------------
const vrButton = VRButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'hand-tracking'],
});
const arButton = ARButton.createButton(renderer, {
  requiredFeatures: ['hit-test'],
  optionalFeatures: ['local-floor', 'hand-tracking'],
});
vrButton.style.left = 'calc(50% - 140px)';
arButton.style.left = 'calc(50% + 10px)';
vrButton.style.width = arButton.style.width = '130px';
document.body.append(vrButton, arButton);

renderer.xr.addEventListener('sessionstart', () => {
  const isAR = renderer.xr.getSession().environmentBlendMode !== 'opaque';
  scene.background = isAR ? null : background;
  environment.visible = !isAR;
  shadowCatcher.visible = isAR;
  // Im AR-Modus erst anzeigen, wenn es auf einen echten Tisch gestellt wurde
  logo.visible = !isAR;
});
renderer.xr.addEventListener('sessionend', () => {
  scene.background = background;
  environment.visible = true;
  shadowCatcher.visible = false;
  logo.visible = true;
  logo.position.set(0, TABLE_H, -0.6);
  logo.rotation.set(0, 0, 0);
});

// --- Status-Anzeige -----------------------------------------------------
function log(msg) {
  console.log(msg);
  statusEl.textContent = msg;
}

if (!window.isSecureContext) {
  log('⚠ Kein sicherer Kontext! WebXR braucht HTTPS oder localhost.');
} else if (!navigator.xr) {
  log('Kein WebXR – Desktop-Vorschau (mit Maus drehen).');
} else {
  Promise.all([
    navigator.xr.isSessionSupported('immersive-vr'),
    navigator.xr.isSessionSupported('immersive-ar'),
  ]).then(([vr, ar]) => log(`immersive-vr: ${vr ? '✔' : '✘'} · immersive-ar: ${ar ? '✔' : '✘'}`));
}

// --- Render-Loop --------------------------------------------------------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

const clock = new THREE.Clock();
renderer.setAnimationLoop((time, frame) => {
  clock.getDelta();

  if (renderer.xr.isPresenting) {
    const refSpace = renderer.xr.getReferenceSpace();
    for (const c of controllers) updateReticle(c, frame, refSpace);
  }

  // Aufploppen beim Platzieren
  if (popStart >= 0) {
    const t = Math.min((clock.elapsedTime - popStart) / 0.45, 1);
    logo.scale.setScalar(Math.max(easeOutBack(t), 0.001));
    if (t >= 1) popStart = -1;
  }

  renderer.render(scene, camera);
});
