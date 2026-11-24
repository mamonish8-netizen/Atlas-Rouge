import * as THREE from 'three';
import { CLONE_ARCHETYPES, CloneArchetypeId } from './types';

export interface ProceduralTextureSet {
  ground: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  spireMetal: THREE.CanvasTexture;
  deadEarth: THREE.CanvasTexture;
  gasGiant: THREE.CanvasTexture;
  arenaDeck: THREE.CanvasTexture;
  rock: THREE.CanvasTexture;
  rustAlien: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.max(1, anisotropy);
  tex.needsUpdate = true;
  return tex;
}

export async function generateProceduralTextures(
  maxAnisotropy: number,
  onProgress?: (pct: number) => void,
): Promise<ProceduralTextureSet> {
  // 1. Jungle Ground Texture
  const [gCan, gCtx] = makeCanvas(512, 512);
  gCtx.fillStyle = '#20381e';
  gCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 8;
    gCtx.fillStyle =
      Math.random() > 0.45
        ? `rgba(54, 98, 42, ${0.18 + Math.random() * 0.28})`
        : `rgba(34, 28, 20, ${0.18 + Math.random() * 0.25})`;
    gCtx.beginPath();
    gCtx.arc(x, y, r, 0, Math.PI * 2);
    gCtx.fill();
  }
  onProgress?.(0.16);

  // 2. Bark Texture
  const [bCan, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#3d2a1d';
  bCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 4) {
    bCtx.fillStyle = x % 8 === 0 ? 'rgba(22,14,9,0.55)' : 'rgba(84,59,39,0.35)';
    bCtx.fillRect(x, 0, 2 + Math.random() * 2, 256);
  }
  onProgress?.(0.28);

  // 3. Spire Metallic Plating
  const [sCan, sCtx] = makeCanvas(512, 512);
  sCtx.fillStyle = '#1e293b';
  sCtx.fillRect(0, 0, 512, 512);
  sCtx.strokeStyle = '#0f172a';
  sCtx.lineWidth = 4;
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 128) {
      sCtx.fillStyle = (x + y) % 256 === 0 ? '#243247' : '#1b2638';
      sCtx.fillRect(x + 2, y + 2, 124, 60);
      sCtx.strokeRect(x, y, 128, 64);
      sCtx.fillStyle = '#475569';
      sCtx.fillRect(x + 10, y + 10, 4, 4);
      sCtx.fillRect(x + 114, y + 10, 4, 4);
    }
  }
  onProgress?.(0.42);

  // 4. Barren Lifeless Earth Texture
  const [eCan, eCtx] = makeCanvas(1024, 512);
  const grad = eCtx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#3e3934');
  grad.addColorStop(0.5, '#59483b');
  grad.addColorStop(1, '#312c29');
  eCtx.fillStyle = grad;
  eCtx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 48; i++) {
    const x = Math.random() * 1024;
    const y = 60 + Math.random() * 390;
    const rx = 30 + Math.random() * 110;
    const ry = 18 + Math.random() * 55;
    eCtx.fillStyle = i % 2 === 0 ? 'rgba(34, 30, 28, 0.45)' : 'rgba(130, 96, 68, 0.32)';
    eCtx.beginPath();
    eCtx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    eCtx.fill();
  }
  for (let i = 0; i < 65; i++) {
    const x = Math.random() * 1024;
    const y = 40 + Math.random() * 432;
    const r = 4 + Math.random() * 20;
    eCtx.strokeStyle = 'rgba(180, 145, 115, 0.35)';
    eCtx.lineWidth = 2;
    eCtx.beginPath();
    eCtx.arc(x, y, r, 0, Math.PI * 2);
    eCtx.stroke();
    if (i % 7 === 0) {
      eCtx.fillStyle = 'rgba(234, 88, 12, 0.4)';
      eCtx.beginPath();
      eCtx.arc(x, y, r * 0.35, 0, Math.PI * 2);
      eCtx.fill();
    }
  }
  onProgress?.(0.56);

  // 5. Ringed Gas Giant Planet Texture
  const [pCan, pCtx] = makeCanvas(512, 256);
  const pGrad = pCtx.createLinearGradient(0, 0, 0, 256);
  pGrad.addColorStop(0, '#1e3a5f');
  pGrad.addColorStop(0.25, '#3b82f6');
  pGrad.addColorStop(0.45, '#7dd3fc');
  pGrad.addColorStop(0.65, '#2563eb');
  pGrad.addColorStop(0.85, '#1d4ed8');
  pGrad.addColorStop(1, '#0f172a');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 24; i++) {
    pCtx.fillStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.12})`;
    pCtx.fillRect(0, Math.random() * 256, 512, 2 + Math.random() * 8);
  }
  onProgress?.(0.68);

  // 6. Apex Command Deck Texture
  const [aCan, aCtx] = makeCanvas(512, 512);
  aCtx.fillStyle = '#0f172a';
  aCtx.fillRect(0, 0, 512, 512);
  aCtx.strokeStyle = '#1e293b';
  aCtx.lineWidth = 3;
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 64) {
      aCtx.strokeRect(x, y, 64, 64);
      aCtx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      aCtx.fillRect(x + 28, y + 28, 8, 8);
    }
  }
  onProgress?.(0.8);

  // 7. Rock Texture
  const [rCan, rCtx] = makeCanvas(256, 256);
  rCtx.fillStyle = '#525866';
  rCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i++) {
    rCtx.fillStyle =
      Math.random() > 0.5 ? 'rgba(30,35,42,0.35)' : 'rgba(148,163,184,0.22)';
    rCtx.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 14, 4 + Math.random() * 12);
  }
  onProgress?.(0.9);

  // 8. Rusted Alien Alloy Texture
  const [ruCan, ruCtx] = makeCanvas(256, 256);
  ruCtx.fillStyle = '#47362b';
  ruCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    ruCtx.fillStyle =
      i % 3 === 0
        ? 'rgba(138, 62, 24, 0.35)'
        : i % 3 === 1
          ? 'rgba(51, 65, 85, 0.4)'
          : 'rgba(28, 25, 23, 0.3)';
    ruCtx.fillRect(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 22, 4 + Math.random() * 14);
  }
  ruCtx.strokeStyle = 'rgba(20, 184, 166, 0.45)';
  ruCtx.lineWidth = 2;
  for (let y = 32; y < 256; y += 64) {
    ruCtx.beginPath();
    ruCtx.moveTo(0, y);
    ruCtx.lineTo(100, y);
    ruCtx.lineTo(128, y + 18);
    ruCtx.lineTo(256, y + 18);
    ruCtx.stroke();
  }
  onProgress?.(1.0);

  return {
    ground: finalizeTexture(gCan, maxAnisotropy, 56, 56),
    bark: finalizeTexture(bCan, maxAnisotropy, 2, 4),
    spireMetal: finalizeTexture(sCan, maxAnisotropy, 4, 8),
    deadEarth: finalizeTexture(eCan, maxAnisotropy, 1, 1),
    gasGiant: finalizeTexture(pCan, maxAnisotropy, 1, 1),
    arenaDeck: finalizeTexture(aCan, maxAnisotropy, 10, 10),
    rock: finalizeTexture(rCan, maxAnisotropy, 2, 2),
    rustAlien: finalizeTexture(ruCan, maxAnisotropy, 2, 3),
  };
}

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  handMount: THREE.Group;
  armorGroup: THREE.Group;
  tools: {
    pickaxe: THREE.Group;
    hatchet: THREE.Group;
    bow: THREE.Group;
  };
}

export function buildToolMesh(kind: 'pickaxe' | 'hatchet' | 'bow'): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85, metalness: 0.05 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.25 });
  const bindMat = new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.9, metalness: 0.0 });

  if (kind === 'pickaxe') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.95, 8), woodMat);
    handle.position.y = 0.42;
    g.add(handle);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 5), stoneMat);
    head.rotation.z = Math.PI / 2;
    head.position.set(0.14, 0.82, 0);
    g.add(head);

    const backSpike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 5), stoneMat);
    backSpike.rotation.z = -Math.PI / 2;
    backSpike.position.set(-0.1, 0.82, 0);
    g.add(backSpike);

    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), bindMat);
    wrap.position.set(0, 0.82, 0);
    g.add(wrap);

    g.rotation.x = Math.PI / 2.4;
  } else if (kind === 'hatchet') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.78, 8), woodMat);
    handle.position.y = 0.35;
    g.add(handle);

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, -0.06);
    bladeShape.lineTo(0.24, -0.14);
    bladeShape.lineTo(0.27, 0.14);
    bladeShape.lineTo(0, 0.07);
    bladeShape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    });
    bladeGeo.center();
    const blade = new THREE.Mesh(bladeGeo, stoneMat);
    blade.position.set(0.11, 0.68, 0);
    g.add(blade);

    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), bindMat);
    wrap.position.set(0, 0.68, 0);
    g.add(wrap);

    g.rotation.x = Math.PI / 2.4;
  } else {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.58, 0.14),
      new THREE.Vector3(0, -0.25, -0.08),
      new THREE.Vector3(0, 0, -0.14),
      new THREE.Vector3(0, 0.25, -0.08),
      new THREE.Vector3(0, 0.58, 0.14),
    ]);
    const bowLimb = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.025, 6, false), woodMat);
    g.add(bowLimb);

    const stringGeo = new THREE.CylinderGeometry(0.006, 0.006, 1.15, 4);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const bowString = new THREE.Mesh(stringGeo, stringMat);
    bowString.position.set(0, 0, 0.14);
    g.add(bowString);

    const arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 6), woodMat);
    arrowShaft.rotation.x = Math.PI / 2;
    arrowShaft.position.set(0.04, 0, -0.06);
    g.add(arrowShaft);
  }

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

export function buildCloneCharacter(archetypeId: CloneArchetypeId): CharacterRig {
  const arch = CLONE_ARCHETYPES[archetypeId];
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: arch.primaryColor,
    roughness: 0.32,
    metalness: 0.68,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: arch.secondaryColor,
    roughness: 0.78,
    metalness: 0.15,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: arch.accentColor,
    emissive: arch.accentColor,
    emissiveIntensity: 1.4,
    roughness: 0.12,
    metalness: 0.9,
  });

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.18, 0.85, 0);
  const lThigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 4, 8), secondaryMat);
  lThigh.position.y = -0.34;
  const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.34), primaryMat);
  lBoot.position.set(0, -0.73, 0.04);
  leftLeg.add(lThigh, lBoot);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.18, 0.85, 0);
  const rThigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 4, 8), secondaryMat);
  rThigh.position.y = -0.34;
  const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.34), primaryMat);
  rBoot.position.set(0, -0.73, 0.04);
  rightLeg.add(rThigh, rBoot);

  const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.42, 10), secondaryMat);
  abdomen.position.y = 1.04;
  const chestW = archetypeId === 'tank' ? 0.66 : 0.56;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(chestW, 0.52, 0.36), primaryMat);
  chest.position.y = 1.38;

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), secondaryMat);
  pack.position.set(0, 1.36, -0.25);
  const packCore = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8), visorMat);
  packCore.position.set(0, 1.36, -0.35);

  if (archetypeId === 'teknician') {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.55, 6), primaryMat);
    antenna.position.set(0.14, 1.75, -0.28);
    bodyPivot.add(antenna);
  } else if (archetypeId === 'medic') {
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.06), visorMat);
    crossH.position.set(0, 1.4, -0.36);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.06), visorMat);
    crossV.position.set(0, 1.4, -0.36);
    bodyPivot.add(crossH, crossV);
  }

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), primaryMat);
  helmet.position.set(0, 1.84, 0);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.18), visorMat);
  visor.position.set(0, 1.85, 0.16);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.38, 1.54, 0);
  const lSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), secondaryMat);
  lSleeve.position.y = -0.26;
  const lGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.17), primaryMat);
  lGauntlet.position.y = -0.52;
  leftArm.add(lSleeve, lGauntlet);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.38, 1.54, 0);
  const rSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), secondaryMat);
  rSleeve.position.y = -0.26;
  const rGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.17), primaryMat);
  rGauntlet.position.y = -0.52;
  const handMount = new THREE.Group();
  handMount.position.set(0, -0.58, 0.08);
  rightArm.add(rSleeve, rGauntlet, handMount);

  const armorGroup = new THREE.Group();
  const barkArmorMat = new THREE.MeshStandardMaterial({ color: 0x6b4f32, roughness: 0.9, metalness: 0.05 });
  const lPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), barkArmorMat);
  lPauldron.position.set(-0.39, 1.58, 0);
  const rPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), barkArmorMat);
  rPauldron.position.set(0.39, 1.58, 0);
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.36, 0.42), barkArmorMat);
  chestPlate.position.set(0, 1.4, 0);
  armorGroup.add(lPauldron, rPauldron, chestPlate);
  armorGroup.visible = false;

  const tools = {
    pickaxe: buildToolMesh('pickaxe'),
    hatchet: buildToolMesh('hatchet'),
    bow: buildToolMesh('bow'),
  };
  tools.hatchet.visible = false;
  tools.bow.visible = false;
  handMount.add(tools.pickaxe, tools.hatchet, tools.bow);

  bodyPivot.add(leftLeg, rightLeg, abdomen, chest, pack, packCore, helmet, visor, leftArm, rightArm, armorGroup);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { root, bodyPivot, leftArm, rightArm, leftLeg, rightLeg, handMount, armorGroup, tools };
}

export function buildEnemyMesh(
  kind: 'raptor' | 'theropod' | 'skywing' | 'drone',
  aggroRadius = 18,
): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'raptor') {
    const skin = new THREE.MeshStandardMaterial({ color: 0x3b6e4c, roughness: 0.65, metalness: 0.1 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45, metalness: 0.15 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.5 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.9, 4, 8), skin);
    body.rotation.x = Math.PI / 2.2;
    body.position.set(0, 0.95, 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.5, 6), skin);
    tail.rotation.x = -Math.PI / 2.1;
    tail.position.set(0, 0.98, -1.1);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.6, 6), skin);
    neck.rotation.x = Math.PI / 5;
    neck.position.set(0, 1.32, 0.62);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.65), stripe);
    head.position.set(0, 1.52, 0.95);
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat);
    lEye.position.set(-0.14, 1.58, 1.05);
    const rEye = lEye.clone();
    rEye.position.x = 0.14;
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.22), skin);
    lLeg.position.set(-0.24, 0.45, -0.05);
    const rLeg = lLeg.clone();
    rLeg.position.x = 0.24;
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.7), stripe);
    crest.position.set(0, 1.25, 0);
    g.add(body, tail, neck, head, lEye, rEye, lLeg, rLeg, crest);
  } else if (kind === 'theropod') {
    const hide = new THREE.MeshStandardMaterial({ color: 0x5c2b29, roughness: 0.75, metalness: 0.12 });
    const plate = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.4, metalness: 0.4 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xef4444, emissiveIntensity: 1.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.25, 2.2), hide);
    body.position.set(0, 1.75, 0);
    const armorBack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 2.0), plate);
    armorBack.position.set(0, 2.45, -0.05);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 7), hide);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 1.65, -2.1);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.78, 1.25), hide);
    head.position.set(0, 2.55, 1.45);
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 5), plate);
    hornL.position.set(-0.3, 3.05, 1.25);
    const hornR = hornL.clone();
    hornR.position.x = 0.3;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), eyeMat);
    eyeL.position.set(-0.42, 2.7, 1.75);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.42;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.5, 0.5), plate);
    legL.position.set(-0.48, 0.75, 0.1);
    const legR = legL.clone();
    legR.position.x = 0.48;
    g.add(body, armorBack, tail, head, hornL, hornR, eyeL, eyeR, legL, legR);
  } else if (kind === 'skywing') {
    // Flying Sky-Pteron that hovers above and must be hit with Bow & Arrows
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45, metalness: 0.25 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.65, metalness: 0.1, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xeab308, emissiveIntensity: 2.0 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 4, 8), bodyMat);
    body.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 6), bodyMat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0.12, 0.95);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 5), wingMat);
    crest.rotation.x = -Math.PI / 3;
    crest.position.set(0, 0.36, 0.6);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    eyeL.position.set(-0.14, 0.16, 0.82);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;

    const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.9), wingMat);
    wingLeft.position.set(-1.15, 0.05, 0);
    wingLeft.name = 'wingLeft';
    const wingRight = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.9), wingMat);
    wingRight.position.set(1.15, 0.05, 0);
    wingRight.name = 'wingRight';

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 5), bodyMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0, -1.1);

    g.add(body, head, crest, eyeL, eyeR, wingLeft, wingRight, tail);
  } else {
    const chassis = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.25, metalness: 0.85 });
    const lens = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 2.2 });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), chassis);
    orb.position.y = 1.8;
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 12), lens);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(0, 1.8, 0.42);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.06, 8, 24), chassis);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.8;
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.35), chassis);
    finL.position.set(-0.62, 1.8, 0);
    const finR = finL.clone();
    finR.position.x = 0.62;
    g.add(orb, eye, ring, finL, finR);
  }

  if (kind === 'raptor' || kind === 'theropod') {
    const aggroRingGeo = new THREE.RingGeometry(Math.max(1, aggroRadius - 0.28), aggroRadius, 48);
    aggroRingGeo.rotateX(-Math.PI / 2);
    const aggroRingMat = new THREE.MeshBasicMaterial({
      color: kind === 'theropod' ? 0xef4444 : 0xf59e0b,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const aggroRing = new THREE.Mesh(aggroRingGeo, aggroRingMat);
    aggroRing.position.y = 0.22;
    aggroRing.name = 'aggroRing';
    g.add(aggroRing);
  }

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name !== 'aggroRing') {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function buildAlienRuinStructure(
  variant: 0 | 1 | 2,
  rustTex: THREE.CanvasTexture,
): THREE.Group {
  const g = new THREE.Group();
  const rustMat = new THREE.MeshStandardMaterial({
    map: rustTex,
    roughness: 0.78,
    metalness: 0.62,
  });
  const darkAlloy = new THREE.MeshStandardMaterial({
    color: 0x1e242b,
    roughness: 0.48,
    metalness: 0.82,
  });
  const glyphMat = new THREE.MeshStandardMaterial({
    color: 0x14b8a6,
    emissive: 0x0d9488,
    emissiveIntensity: 1.2,
    roughness: 0.25,
  });

  if (variant === 0) {
    const leftPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 8.5, 6), rustMat);
    leftPillar.position.set(-2.8, 4.0, 0);
    leftPillar.rotation.z = -0.14;
    const rightPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.05, 6.2, 6), rustMat);
    rightPillar.position.set(2.9, 2.9, 0.3);
    rightPillar.rotation.z = 0.22;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.2, 1.6), darkAlloy);
    lintel.position.set(-0.4, 7.6, 0.1);
    lintel.rotation.z = -0.18;
    const fallenShard = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 3.8, 6), rustMat);
    fallenShard.position.set(4.2, 0.55, 2.1);
    fallenShard.rotation.set(Math.PI / 2.2, 0.4, 0.6);
    const glyphStrip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.6, 0.24), glyphMat);
    glyphStrip.position.set(-2.4, 4.0, 0.78);
    glyphStrip.rotation.z = -0.14;
    g.add(leftPillar, rightPillar, lintel, fallenShard, glyphStrip);
  } else if (variant === 1) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.75, 6, 18, Math.PI * 0.72), rustMat);
    arc.position.set(0, 1.2, 0);
    arc.rotation.z = 0.35;
    arc.rotation.x = 0.15;
    const strut1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.5, 1.4), darkAlloy);
    strut1.position.set(-4.2, 2.0, 0);
    strut1.rotation.z = -0.3;
    const conduit = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.18, 6, 18, Math.PI * 0.68), glyphMat);
    conduit.position.set(0, 1.2, 0.68);
    conduit.rotation.z = 0.35;
    conduit.rotation.x = 0.15;
    const debris = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), rustMat);
    debris.position.set(3.8, 0.7, 1.4);
    g.add(arc, strut1, conduit, debris);
  } else {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.1, 1.4, 6), darkAlloy);
    base.position.y = 0.7;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.8, 9.5, 6), rustMat);
    spire.position.set(0, 5.2, 0);
    spire.rotation.x = 0.12;
    spire.rotation.z = -0.09;
    const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.5, 1.6), darkAlloy);
    fin1.position.set(-1.5, 3.6, 0);
    fin1.rotation.z = 0.18;
    const fin2 = fin1.clone();
    fin2.position.x = 1.5;
    fin2.rotation.z = -0.18;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), glyphMat);
    core.position.set(0, 9.8, 0.9);
    g.add(base, spire, fin1, fin2, core);
  }

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function buildForgingStation(spireTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ map: spireTex, roughness: 0.45, metalness: 0.75 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.88 });
  const magmaMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, 0.6, 10), ironMat);
  pad.position.y = 0.3;
  const furnace = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.2, 3.8, 8), hullMat);
  furnace.position.set(-1.4, 2.2, -1.2);
  const crucible = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), magmaMat);
  crucible.position.set(-1.4, 1.8, -0.1);
  const chimney1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 3.2, 8), ironMat);
  chimney1.position.set(-2.0, 5.2, -1.4);
  const chimney2 = chimney1.clone();
  chimney2.position.set(-0.7, 4.9, -1.4);

  const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.85), ironMat);
  anvilBase.position.set(1.8, 0.9, 0.9);
  const anvilHorn = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 0.65), hullMat);
  anvilHorn.position.set(1.8, 1.55, 0.9);

  // Tall amber beacon column so players can spot the Forge from afar
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.55, 70, 10, 1, true), markerMat);
  marker.position.set(-1.4, 36, -1.2);

  g.add(pad, furnace, crucible, chimney1, chimney2, anvilBase, anvilHorn, marker);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== marker) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function buildFloatingPlatform(
  heightDelta: number,
  spireTex: THREE.CanvasTexture,
): { group: THREE.Group; ladderXOffset: number; ladderZOffset: number } {
  const group = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({ map: spireTex, roughness: 0.4, metalness: 0.78 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.7 });
  const thrustMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.8,
  });

  // Elevated floating platform disc
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 6.2, 1.2, 12), deckMat);
  platform.position.y = heightDelta - 0.6;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.25, 8, 24), thrustMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = heightDelta - 1.25;
  group.add(platform, ring);

  // Metallic Climbable Ladder on +Z edge of platform
  const ladderZ = 6.9;
  const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, heightDelta + 0.8, 6), railMat);
  railL.position.set(-0.55, (heightDelta + 0.8) / 2, ladderZ);
  const railR = railL.clone();
  railR.position.x = 0.55;
  group.add(railL, railR);

  const rungCount = Math.floor(heightDelta / 1.05);
  for (let i = 1; i <= rungCount; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 6), thrustMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, i * 1.05, ladderZ);
    group.add(rung);
  }

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { group, ladderXOffset: 0, ladderZOffset: ladderZ };
}

export function buildGemRupeeCluster(seedIdx: number): THREE.Group {
  const g = new THREE.Group();
  const colors = [0x10b981, 0x3b82f6, 0xa855f7, 0xf59e0b, 0xec4899];
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.1 });

  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), baseMat);
  rock.scale.set(1.4, 0.5, 1.3);
  rock.position.y = 0.2;
  g.add(rock);

  for (let i = 0; i < 6; i++) {
    const col = colors[(seedIdx + i) % colors.length];
    const crystalMat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.75,
      roughness: 0.12,
      metalness: 0.35,
    });
    const ang = (i / 6) * Math.PI * 2;
    if (i % 2 === 0) {
      // Faceted Rupee / Gem Prism
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 + (i % 3) * 0.08, 0), crystalMat);
      gem.scale.set(0.65, 1.5, 0.65);
      gem.position.set(Math.cos(ang) * 0.55, 0.62, Math.sin(ang) * 0.55);
      gem.rotation.z = (Math.random() - 0.5) * 0.35;
      g.add(gem);
    } else {
      // Botanical Pistil Stalk + Bulb
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.05, 0.9, 5),
        new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.8 }),
      );
      stalk.position.set(Math.cos(ang) * 0.62, 0.6, Math.sin(ang) * 0.62);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), crystalMat);
      bulb.position.set(Math.cos(ang) * 0.62, 1.08, Math.sin(ang) * 0.62);
      g.add(stalk, bulb);
    }
  }
  return g;
}

export function buildSkyEnclosure(radius: number, spireTex: THREE.CanvasTexture, isSoftwareGl: boolean): THREE.Group {
  const g = new THREE.Group();
  const ribMat = new THREE.MeshStandardMaterial({
    map: spireTex,
    roughness: 0.42,
    metalness: 0.82,
  });

  // Heavy Metallic Structural Rib Arches spanning overhead
  const ribCount = 8;
  for (let i = 0; i < ribCount; i++) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(radius, 2.2, 6, 40, Math.PI), ribMat);
    arch.rotation.y = (i / ribCount) * Math.PI;
    g.add(arch);
  }

  // Horizontal structural ring bands
  for (const hFrac of [0.22, 0.52, 0.78]) {
    const ringR = Math.cos(hFrac * Math.PI * 0.5) * radius;
    const ringY = Math.sin(hFrac * Math.PI * 0.5) * radius;
    const band = new THREE.Mesh(new THREE.TorusGeometry(ringR, 1.8, 6, 48), ribMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = ringY;
    g.add(band);
  }

  // Transparent glass panes nestled between the metallic ribs so space & planets shine through
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: isSoftwareGl ? 0.1 : 0.12,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(radius - 0.6, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), glassMat);
  glass.renderOrder = 6;
  g.add(glass);

  return g;
}

export interface BeaconVisual {
  group: THREE.Group;
  ring: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  beamMat: THREE.MeshBasicMaterial;
  beam: THREE.Mesh;
}

export function buildRepairBeacon(): BeaconVisual {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.3 });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.5,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.0, 1.2, 8), accentMat);
  plinth.position.y = 0.5;
  group.add(plinth);

  const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 3.6, 8), baseMat);
  pylon.position.y = 2.4;
  group.add(pylon);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.8, 0.45), baseMat);
    strut.position.set(Math.cos(angle) * 1.15, 1.9, Math.sin(angle) * 1.15);
    strut.rotation.y = -angle;
    strut.rotation.z = 0.22;
    group.add(strut);
  }

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 1), coreMat);
  core.position.y = 4.9;
  group.add(core);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.1, 8, 24), baseMat);
  ring.position.y = 4.9;
  ring.rotation.x = Math.PI / 3;
  group.add(ring);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.65, 130, 12, 1, true), beamMat);
  beam.position.y = 66;
  group.add(beam);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== beam) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { group, ring, coreMat, beamMat, beam };
}

export interface SpireVisual {
  group: THREE.Group;
  doorLeft: THREE.Mesh;
  doorRight: THREE.Mesh;
  elevatorCabin: THREE.Group;
  doorLightMat: THREE.MeshStandardMaterial;
}

export function buildCentralSpire(spireTex: THREE.CanvasTexture, isSoftwareGl: boolean): SpireVisual {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    map: spireTex,
    roughness: 0.38,
    metalness: 0.78,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.65,
    metalness: 0.55,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    roughness: 0.08,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.75,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 0.88,
    depthWrite: false,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(11, 13.5, 2.5, 12), darkMetal);
  base.position.y = 1.25;
  group.add(base);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 8.8, 72, 12), hullMat);
  shaft.position.y = 37;
  group.add(shaft);

  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(2.0, 68, 3.2), darkMetal);
    rib.position.set(Math.cos(ang) * 7.8, 35, Math.sin(ang) * 7.8);
    rib.rotation.y = -ang;
    group.add(rib);
  }

  const deck = new THREE.Mesh(new THREE.CylinderGeometry(28, 10, 4, 16), darkMetal);
  deck.position.y = 73;
  group.add(deck);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.8, 2.4), darkMetal);
  frame.position.set(0, 4.2, 8.6);
  group.add(frame);

  const doorLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
    roughness: 0.3,
  });
  const statusBar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 0.3), doorLightMat);
  statusBar.position.set(0, 6.7, 9.8);
  group.add(statusBar);

  const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.8, 0.45), hullMat);
  doorLeft.position.set(-1.12, 3.6, 9.7);
  const doorRight = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.8, 0.45), hullMat);
  doorRight.position.set(1.12, 3.6, 9.7);
  group.add(doorLeft, doorRight);

  const elevatorCabin = new THREE.Group();
  elevatorCabin.position.set(0, 1.5, 7.6);
  const cabFloor = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.35, 10), darkMetal);
  const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.3, 10), darkMetal);
  cabRoof.position.y = 3.8;
  const cabGlass = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 3.4, 10, 1, true), glassMat);
  cabGlass.position.y = 1.9;
  cabGlass.renderOrder = 3;
  elevatorCabin.add(cabFloor, cabRoof, cabGlass);
  group.add(elevatorCabin);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== cabGlass) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { group, doorLeft, doorRight, elevatorCabin, doorLightMat };
}

export interface AtlasBossVisual {
  group: THREE.Group;
  ringOuter: THREE.Mesh;
  ringMid: THREE.Mesh;
  ringInner: THREE.Mesh;
  coreMesh: THREE.Mesh;
  shieldMesh: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  eyeMat: THREE.MeshStandardMaterial;
}

export function buildAtlasBoss(): AtlasBossVisual {
  const group = new THREE.Group();
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.7 });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xff3b30,
    emissive: 0xdc2626,
    emissiveIntensity: 2.2,
    roughness: 0.15,
    metalness: 0.4,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.6,
  });

  const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 1), coreMat);
  coreMesh.position.y = 3.6;
  group.add(coreMesh);

  const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.32, 10, 32), armorMat);
  ringOuter.position.y = 3.6;
  group.add(ringOuter);

  const ringMid = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.22, 10, 28), trimMat);
  ringMid.position.y = 3.6;
  group.add(ringMid);

  const ringInner = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.15, 8, 24), coreMat);
  ringInner.position.y = 3.6;
  group.add(ringInner);

  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.85, 3.2, 0.85), armorMat);
    pylon.position.set(Math.cos(a) * 4.2, 3.6, Math.sin(a) * 4.2);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 6), eyeMat);
    tip.position.set(Math.cos(a) * 4.2, 1.7, Math.sin(a) * 4.2);
    tip.rotation.x = Math.PI;
    group.add(pylon, tip);
  }

  const eyeHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.8, 12), armorMat);
  eyeHousing.rotation.x = Math.PI / 2;
  eyeHousing.position.set(0, 3.6, 2.0);
  const eyeLens = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), eyeMat);
  eyeLens.position.set(0, 3.6, 2.35);
  group.add(eyeHousing, eyeLens);

  // Immunity energy shield dome
  const shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4.9, 20, 16),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.24,
      wireframe: true,
      depthWrite: false,
    }),
  );
  shieldMesh.position.y = 3.6;
  shieldMesh.visible = false;
  group.add(shieldMesh);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== shieldMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { group, ringOuter, ringMid, ringInner, coreMesh, shieldMesh, coreMat, eyeMat };
}

export function buildResourceNode(
  kind: 'tree' | 'stone' | 'fiber',
  barkTex: THREE.CanvasTexture,
  rockTex: THREE.CanvasTexture,
): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'tree') {
    const trunkMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.9, metalness: 0.02 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d6a36, roughness: 0.72, metalness: 0.02 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 5.6, 8), trunkMat);
    trunk.position.y = 2.7;
    const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5, 1), leafMat);
    crown1.position.set(0, 5.9, 0);
    crown1.scale.set(1.2, 0.78, 1.2);
    const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 1), leafMat);
    crown2.position.set(0.85, 6.9, -0.5);
    g.add(trunk, crown1, crown2);
  } else if (kind === 'stone') {
    const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.85, metalness: 0.1 });
    const oreMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.4 });
    const main = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 0), rockMat);
    main.position.y = 0.9;
    main.scale.set(1.15, 0.88, 1.0);
    const side = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), oreMat);
    side.position.set(0.9, 0.58, 0.45);
    g.add(main, side);
  } else {
    // Round Shrub Bush (clearly rounded shrub silhouette!)
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4b3828, roughness: 0.9 });
    const shrubMat = new THREE.MeshStandardMaterial({ color: 0x3f7d20, roughness: 0.72, metalness: 0.02 });
    const shrubLight = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.68, metalness: 0.02 });

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.65, 6), stemMat);
    stem.position.y = 0.3;
    const domeMain = new THREE.Mesh(new THREE.SphereGeometry(0.88, 12, 10), shrubMat);
    domeMain.position.set(0, 0.85, 0);
    domeMain.scale.set(1.12, 0.92, 1.12);
    const lobe1 = new THREE.Mesh(new THREE.SphereGeometry(0.58, 10, 8), shrubLight);
    lobe1.position.set(0.55, 0.72, 0.35);
    const lobe2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), shrubMat);
    lobe2.position.set(-0.52, 0.76, -0.32);
    const lobe3 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), shrubLight);
    lobe3.position.set(-0.25, 1.18, 0.25);
    g.add(stem, domeMain, lobe1, lobe2, lobe3);
  }

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
