import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/droid/droid_sans_regular.typeface.json';

// Nachbau des HTL-Rennweg-Logos ("htl3 rennweg – IT & MECHATRONIK") als 3D-Modell.
// Gearbeitet wird in "Logo-Pixeln" (1 Einheit = 1 mm), am Ende wird auf Meter skaliert.

export const COLORS = {
  red: 0xe8412c,   // "htl"
  gray: 0xa7a9ac,  // "3" + Schwung
  dark: 0x2b2a29,  // "rennweg", "IT & MECHATRONIK"
  base: 0xf4f4f4,  // Sockel
};

const font = new FontLoader().parse(fontJson);

function text(str, { size, depth, color, italic = false }) {
  const geometry = new TextGeometry(str, {
    font,
    size,
    depth,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: depth * 0.15,
    bevelSize: size * 0.012,
    bevelSegments: 2,
  });
  if (italic) geometry.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0.22, 0, 0, 0));
  geometry.computeBoundingBox();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 })
  );
  mesh.castShadow = true;
  return mesh;
}

const width = (mesh) => mesh.geometry.boundingBox.max.x - mesh.geometry.boundingBox.min.x;

// Grauer Schwung unter "htl": dünn links, dick rechts (wie im Original)
function swoosh(fromX, toX, depth) {
  const shape = new THREE.Shape();
  const midX = fromX + (toX - fromX) * 0.55;
  shape.moveTo(fromX, -12);
  shape.quadraticCurveTo(midX, -78, toX, -38);   // Unterkante
  shape.lineTo(toX, -24);
  shape.quadraticCurveTo(midX, -62, fromX, -12); // Oberkante
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: COLORS.gray, roughness: 0.4 }));
  mesh.castShadow = true;
  return mesh;
}

/**
 * Erzeugt das Logo auf einem Sockel. Der Ursprung liegt mittig an der
 * Unterseite des Sockels → kann direkt auf eine Tischfläche gestellt werden.
 * @param {number} widthMeters gewünschte Gesamtbreite in Metern
 */
export function createHtlLogo(widthMeters = 0.35) {
  const logo = new THREE.Group();

  const htl = text('htl', { size: 100, depth: 16, color: COLORS.red });
  logo.add(htl);

  const three = text('3', { size: 150, depth: 10, color: COLORS.gray });
  three.position.set(width(htl) + 6, -38, -6);
  logo.add(three);

  const rennweg = text('rennweg', { size: 46, depth: 8, color: COLORS.dark, italic: true });
  rennweg.position.set(three.position.x + width(three) * 0.45, -30, 12);
  logo.add(rennweg);

  const rennwegEnd = rennweg.position.x + width(rennweg);
  logo.add(swoosh(-30, three.position.x + width(three) * 0.5, 6));

  const sub = text('IT & MECHATRONIK', { size: 30, depth: 6, color: COLORS.dark });
  sub.position.set(0, -110, 0);
  // Untertitel auf die Breite des Logos strecken
  sub.scale.x = rennwegEnd / width(sub);
  logo.add(sub);

  // Logo zentrieren, Unterkante auf y = 0
  const box = new THREE.Box3().setFromObject(logo);
  const center = box.getCenter(new THREE.Vector3());
  logo.position.set(-center.x, -box.min.y, -center.z);

  const logoSize = box.getSize(new THREE.Vector3());
  const pivot = new THREE.Group();
  pivot.add(logo);

  // Sockel
  const baseW = logoSize.x + 60;
  const baseD = 90;
  const baseH = 18;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(baseW, baseH, baseD),
    new THREE.MeshStandardMaterial({ color: COLORS.base, roughness: 0.6 })
  );
  base.position.y = baseH / 2;
  base.castShadow = base.receiveShadow = true;
  pivot.add(base);

  // Roter Streifen vorne am Sockel
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(baseW, 4, 1),
    new THREE.MeshStandardMaterial({ color: COLORS.red })
  );
  stripe.position.set(0, baseH / 2, baseD / 2 + 0.5);
  pivot.add(stripe);

  logo.position.y += baseH;

  const scale = widthMeters / baseW;
  pivot.scale.setScalar(scale);

  const root = new THREE.Group();
  root.add(pivot);
  root.name = 'htl3r-logo';
  return root;
}
