import * as THREE from 'three';
import type { DungeonTheme, EnemyKind, MaterialId, TrapKind } from './types';

export interface ThemeTextures {
  floorMap: THREE.CanvasTexture;
  floorBump: THREE.CanvasTexture;
  wallMap: THREE.CanvasTexture;
  wallBump: THREE.CanvasTexture;
  dispose: () => void;
}

/**
 * Generates crisp procedural PBR flagstone & obsidian masonry CanvasTextures for each dungeon theme.
 */
export function createThemeTextures(
  theme: DungeonTheme,
  maxAnisotropy: number
): ThemeTextures {
  const size = 256;

  // --- FLOOR FLAGSTONES (Albedo + Bump) ---
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = size;
  floorCanvas.height = size;
  const fctx = floorCanvas.getContext('2d')!;

  const floorBumpCanvas = document.createElement('canvas');
  floorBumpCanvas.width = size;
  floorBumpCanvas.height = size;
  const fbctx = floorBumpCanvas.getContext('2d')!;

  fctx.fillStyle = theme.floorGrout;
  fctx.fillRect(0, 0, size, size);
  fbctx.fillStyle = '#141414';
  fbctx.fillRect(0, 0, size, size);

  const tiles = 4;
  const step = size / tiles;
  for (let row = 0; row < tiles; row++) {
    const offsetX = row % 2 === 0 ? 0 : step * 0.5;
    for (let col = -1; col <= tiles; col++) {
      const tx = col * step + offsetX;
      const ty = row * step;
      const hash = ((row * 31 + col * 17) & 7) / 7;
      fctx.fillStyle = hash > 0.45 ? theme.floorPrimary : theme.floorSecondary;
      fctx.fillRect(tx + 3, ty + 3, step - 6, step - 6);

      // Subtle bevel highlight & shadow on stone slab
      fctx.fillStyle = 'rgba(255,255,255,0.06)';
      fctx.fillRect(tx + 3, ty + 3, step - 6, 3);
      fctx.fillRect(tx + 3, ty + 3, 3, step - 6);
      fctx.fillStyle = 'rgba(0,0,0,0.22)';
      fctx.fillRect(tx + 3, ty + step - 6, step - 6, 3);

      // Subtle weathered chisel speckles
      for (let s = 0; s < 5; s++) {
        const sx = tx + 8 + (((row * 19 + col * 13 + s * 29) % 44));
        const sy = ty + 8 + (((row * 23 + col * 11 + s * 37) % 44));
        fctx.fillStyle = s % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
        fctx.fillRect(sx, sy, 4, 2);
      }

      // Bump slab
      const bVal = Math.round(170 + hash * 45);
      fbctx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      fbctx.fillRect(tx + 4, ty + 4, step - 8, step - 8);
    }
  }

  // --- MASONRY WALLS (Albedo + Bump) ---
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = size;
  wallCanvas.height = size;
  const wctx = wallCanvas.getContext('2d')!;

  const wallBumpCanvas = document.createElement('canvas');
  wallBumpCanvas.width = size;
  wallBumpCanvas.height = size;
  const wbctx = wallBumpCanvas.getContext('2d')!;

  wctx.fillStyle = theme.wallFace;
  wctx.fillRect(0, 0, size, size);
  wbctx.fillStyle = '#181818';
  wbctx.fillRect(0, 0, size, size);

  const brickRows = 4;
  const bh = size / brickRows;
  const bw = size / 2;
  for (let r = 0; r < brickRows; r++) {
    const ox = r % 2 === 0 ? 0 : bw * 0.5;
    for (let c = -1; c <= 2; c++) {
      const bx = c * bw + ox;
      const by = r * bh;
      wctx.fillStyle = r === 0 ? theme.wallTop : theme.wallFace;
      wctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
      wctx.fillStyle = theme.wallHighlight;
      wctx.globalAlpha = 0.28;
      wctx.fillRect(bx + 3, by + 3, bw - 6, 4);
      wctx.globalAlpha = 1;

      wbctx.fillStyle = '#c8c8c8';
      wbctx.fillRect(bx + 4, by + 4, bw - 8, bh - 8);
    }
  }
  // Subtle themed rune trim band near wall cornice
  wctx.fillStyle = theme.accentColor;
  wctx.globalAlpha = 0.25;
  wctx.fillRect(0, bh - 4, size, 4);
  wctx.globalAlpha = 1;

  const configureTex = (canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.anisotropy = Math.min(8, maxAnisotropy);
    tex.needsUpdate = true;
    return tex;
  };

  const floorMap = configureTex(floorCanvas, true);
  const floorBump = configureTex(floorBumpCanvas, false);
  const wallMap = configureTex(wallCanvas, true);
  const wallBump = configureTex(wallBumpCanvas, false);

  return {
    floorMap,
    floorBump,
    wallMap,
    wallBump,
    dispose: () => {
      floorMap.dispose();
      floorBump.dispose();
      wallMap.dispose();
      wallBump.dispose();
    },
  };
}

let sharedShadowTexture: THREE.CanvasTexture | null = null;

export function getContactShadowTexture(): THREE.CanvasTexture {
  if (sharedShadowTexture) return sharedShadowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(4, 3, 9, 0.72)');
  grad.addColorStop(0.55, 'rgba(4, 3, 9, 0.34)');
  grad.addColorStop(1, 'rgba(4, 3, 9, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  sharedShadowTexture = tex;
  return tex;
}

export function createContactShadow(radius: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2.5, radius * 2.5);
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.88,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.018;
  return mesh;
}

export interface HeroModelRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  weaponPivot: THREE.Group;
  cloakMat: THREE.MeshStandardMaterial;
  armorMat: THREE.MeshStandardMaterial;
  bladeMat: THREE.MeshStandardMaterial;
  shieldDome: THREE.Mesh;
  allHitMats: THREE.MeshStandardMaterial[];
  dispose: () => void;
}

/**
 * Composite 10-part 3D Riftwalker Hero model (grounded bottom-center at y = 0).
 * Faces +X in local space so rotation.y = -aimAngle aligns cleanly with 2D (cos, sin) aim!
 */
export function createHeroModel(): HeroModelRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadow = createContactShadow(0.62);
  root.add(shadow);

  const cloakMat = new THREE.MeshStandardMaterial({
    color: 0x3b3454,
    roughness: 0.78,
    metalness: 0.08,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x262235,
    roughness: 0.38,
    metalness: 0.72,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4a454,
    roughness: 0.28,
    metalness: 0.85,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x181522,
    roughness: 0.65,
    metalness: 0.3,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf5c469,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xf5c469,
    emissive: 0xf5c469,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.85,
  });

  // Boots / Legs
  const legGeo = new THREE.BoxGeometry(0.19, 0.42, 0.17);
  const leftLeg = new THREE.Mesh(legGeo, bootMat);
  leftLeg.position.set(0, 0.21, -0.14);
  leftLeg.castShadow = true;
  bodyGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, bootMat);
  rightLeg.position.set(0, 0.21, 0.14);
  rightLeg.castShadow = true;
  bodyGroup.add(rightLeg);

  // Flared Cloak Lower Skirt (drapes back slightly toward -X)
  const cloakLower = new THREE.Mesh(
    new THREE.ConeGeometry(0.46, 0.82, 8),
    cloakMat
  );
  cloakLower.position.set(-0.08, 0.52, 0);
  cloakLower.rotation.z = 0.16;
  cloakLower.castShadow = true;
  bodyGroup.add(cloakLower);

  // Armored Torso Cuirass
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.22, 0.56, 8),
    armorMat
  );
  torso.position.set(0, 0.78, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Gold Waist Belt
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.08, 8),
    goldMat
  );
  belt.position.set(0, 0.56, 0);
  bodyGroup.add(belt);

  // Shoulder Pauldrons
  const pauldronGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const leftPauldron = new THREE.Mesh(pauldronGeo, armorMat);
  leftPauldron.position.set(0, 1.0, -0.32);
  leftPauldron.scale.set(1.1, 0.78, 1.0);
  leftPauldron.castShadow = true;
  bodyGroup.add(leftPauldron);

  const rightPauldron = new THREE.Mesh(pauldronGeo, armorMat);
  rightPauldron.position.set(0, 1.0, 0.32);
  rightPauldron.scale.set(1.1, 0.78, 1.0);
  rightPauldron.castShadow = true;
  bodyGroup.add(rightPauldron);

  // Hooded Head / Cowl
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.48, 7), cloakMat);
  hood.position.set(-0.02, 1.32, 0);
  hood.rotation.z = 0.2;
  hood.castShadow = true;
  bodyGroup.add(hood);

  const faceMask = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bootMat);
  faceMask.position.set(0.05, 1.24, 0);
  bodyGroup.add(faceMask);

  // Luminous Eyes facing +X
  const eyeGeo = new THREE.BoxGeometry(0.06, 0.045, 0.065);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.2, 1.26, -0.065);
  bodyGroup.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.2, 1.26, 0.065);
  bodyGroup.add(eyeR);

  // Articulated Sword Arm + Multi-part Riftblade
  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.06, 0.88, 0.36);
  bodyGroup.add(weaponPivot);

  const hilt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.036, 0.32, 6),
    bootMat
  );
  hilt.rotation.z = -Math.PI / 2;
  hilt.position.set(0.14, 0, 0);
  weaponPivot.add(hilt);

  const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.36), goldMat);
  crossguard.position.set(0.3, 0, 0);
  weaponPivot.add(crossguard);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.045, 0.14), bladeMat);
  blade.position.set(0.9, 0, 0);
  blade.castShadow = true;
  weaponPivot.add(blade);

  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.28, 4), bladeMat);
  bladeTip.rotation.z = -Math.PI / 2;
  bladeTip.rotation.x = Math.PI / 4;
  bladeTip.position.set(1.6, 0, 0);
  weaponPivot.add(bladeTip);

  // Translucent Arcane Ward Shield Dome
  const shieldDome = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.92, 1),
    new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
      depthWrite: false,
    })
  );
  shieldDome.position.y = 0.82;
  shieldDome.visible = false;
  root.add(shieldDome);

  const allHitMats = [cloakMat, armorMat, goldMat];

  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    weaponPivot,
    cloakMat,
    armorMat,
    bladeMat,
    shieldDome,
    allHitMats,
    dispose: () => {
      disposeGroupResources(root);
    },
  };
}

export interface EnemyModelRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  orbitGroup?: THREE.Group;
  hitMats: THREE.MeshStandardMaterial[];
  baseEmissiveColors: number[];
  primaryColor: string;
  accentColor: string;
  dispose: () => void;
}

/**
 * Builds distinct 5-10 part composite 3D enemy archetypes (grounded at y = 0, facing +X).
 */
export function createEnemyModel(kind: EnemyKind): EnemyModelRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const hitMats: THREE.MeshStandardMaterial[] = [];
  const registerMat = (mat: THREE.MeshStandardMaterial) => {
    hitMats.push(mat);
    return mat;
  };

  let primaryColor = '#3b2d52';
  let accentColor = '#c084fc';
  let orbitGroup: THREE.Group | undefined;

  if (kind === 'stalker') {
    primaryColor = '#332544';
    accentColor = '#f43f5e';
    root.add(createContactShadow(0.55));

    const hideMat = registerMat(
      new THREE.MeshStandardMaterial({ color: 0x2d1f3d, roughness: 0.7, metalness: 0.15 })
    );
    const spineMat = registerMat(
      new THREE.MeshStandardMaterial({
        color: 0x4c1d95,
        emissive: 0x881337,
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.4,
      })
    );
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff6b81,
      emissive: 0xf43f5e,
      emissiveIntensity: 2.4,
    });

    // Muscular hound torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.4, 0.44), hideMat);
    torso.position.set(0, 0.46, 0);
    torso.castShadow = true;
    bodyGroup.add(torso);

    // 4 Feral legs
    const legGeo = new THREE.BoxGeometry(0.14, 0.38, 0.14);
    for (const [lx, lz] of [
      [0.3, -0.18],
      [0.3, 0.18],
      [-0.3, -0.18],
      [-0.3, 0.18],
    ]) {
      const leg = new THREE.Mesh(legGeo, hideMat);
      leg.position.set(lx, 0.19, lz);
      leg.castShadow = true;
      bodyGroup.add(leg);
    }

    // Horned feral skull facing +X
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.46, 5), hideMat);
    head.rotation.z = -Math.PI / 2;
    head.position.set(0.55, 0.56, 0);
    head.castShadow = true;
    bodyGroup.add(head);

    // Glowing crimson eyes
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.06, 0.07);
    const eL = new THREE.Mesh(eyeGeo, eyeMat);
    eL.position.set(0.56, 0.62, -0.11);
    const eR = new THREE.Mesh(eyeGeo, eyeMat);
    eR.position.set(0.56, 0.62, 0.11);
    bodyGroup.add(eL, eR);

    // Dorsal obsidian spines + spiked tail
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), spineMat);
      spike.position.set(0.18 - i * 0.22, 0.74, 0);
      spike.rotation.z = 0.25;
      bodyGroup.add(spike);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 5), spineMat);
    tail.rotation.z = Math.PI / 2.4;
    tail.position.set(-0.58, 0.54, 0);
    bodyGroup.add(tail);
  } else if (kind === 'acolyte') {
    primaryColor = '#43256d';
    accentColor = '#c084fc';
    root.add(createContactShadow(0.56));

    const robeMat = registerMat(
      new THREE.MeshStandardMaterial({ color: 0x3b2163, roughness: 0.75, metalness: 0.15 })
    );
    const trimMat = registerMat(
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.65,
        roughness: 0.3,
        metalness: 0.6,
      })
    );
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xf5d0fe,
      emissive: 0xc084fc,
      emissiveIntensity: 2.2,
    });

    // Hovering tapered cultist robe
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.15, 7), robeMat);
    robe.position.set(0, 0.72, 0);
    robe.castShadow = true;
    bodyGroup.add(robe);

    // Hooded head
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.44, 6), robeMat);
    hood.position.set(0.02, 1.44, 0);
    hood.castShadow = true;
    bodyGroup.add(hood);

    const eyeVisor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.2), orbMat);
    eyeVisor.position.set(0.16, 1.36, 0);
    bodyGroup.add(eyeVisor);

    // Floating arcane shoulder halo
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.038, 6, 18), trimMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1.1, 0);
    bodyGroup.add(ring);

    // Arcane staff + hovering orb
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6), trimMat);
    staff.position.set(0.32, 0.9, 0.3);
    bodyGroup.add(staff);

    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), orbMat);
    orb.position.set(0.32, 1.65, 0.3);
    bodyGroup.add(orb);
  } else if (kind === 'lancer') {
    primaryColor = '#4a1d28';
    accentColor = '#fb923c';
    root.add(createContactShadow(0.68));

    const plateMat = registerMat(
      new THREE.MeshStandardMaterial({ color: 0x3b1b24, roughness: 0.36, metalness: 0.72 })
    );
    const spearMat = registerMat(
      new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xea580c,
        emissiveIntensity: 0.8,
        roughness: 0.25,
        metalness: 0.8,
      })
    );

    // Greaves & Armored Torso
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.65, 8), plateMat);
    lower.position.set(0, 0.33, 0);
    lower.castShadow = true;
    bodyGroup.add(lower);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.62, 0.62), plateMat);
    chest.position.set(0, 0.88, 0);
    chest.castShadow = true;
    bodyGroup.add(chest);

    // Horned Knight Helm
    const helm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), plateMat);
    helm.position.set(0.04, 1.38, 0);
    helm.castShadow = true;
    bodyGroup.add(helm);

    const hornGeo = new THREE.ConeGeometry(0.06, 0.36, 5);
    const hL = new THREE.Mesh(hornGeo, spearMat);
    hL.position.set(0.08, 1.56, -0.2);
    hL.rotation.set(-0.4, 0, -0.35);
    const hR = new THREE.Mesh(hornGeo, spearMat);
    hR.position.set(0.08, 1.56, 0.2);
    hR.rotation.set(0.4, 0, -0.35);
    bodyGroup.add(hL, hR);

    // Long forward-pointing Obsidian Lance
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.85, 6), plateMat);
    shaft.rotation.z = -Math.PI / 2;
    shaft.position.set(0.55, 0.9, 0.36);
    bodyGroup.add(shaft);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.56, 4), spearMat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(1.65, 0.9, 0.36);
    tip.castShadow = true;
    bodyGroup.add(tip);
  } else if (kind === 'sentinel') {
    primaryColor = '#334155';
    accentColor = '#60a5fa';
    root.add(createContactShadow(0.84));

    const ironMat = registerMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.78 })
    );
    const shieldTrim = registerMat(
      new THREE.MeshStandardMaterial({
        color: 0xd4a454,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.45,
        roughness: 0.28,
        metalness: 0.88,
      })
    );

    // Bulky Heavy Body
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.42, 1.15, 8), ironMat);
    torso.position.set(-0.04, 0.64, 0);
    torso.castShadow = true;
    bodyGroup.add(torso);

    // Heavy Pauldrons
    const pGeo = new THREE.BoxGeometry(0.38, 0.34, 0.38);
    const pL = new THREE.Mesh(pGeo, ironMat);
    pL.position.set(-0.04, 1.18, -0.5);
    const pR = new THREE.Mesh(pGeo, ironMat);
    pR.position.set(-0.04, 1.18, 0.5);
    bodyGroup.add(pL, pR);

    // Visored Helm
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.38, 8), ironMat);
    helm.position.set(0, 1.44, 0);
    bodyGroup.add(helm);

    // Prominent Frontal Tower Shield (clearly communicates frontal guard!)
    const shieldSlab = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.38, 1.02), ironMat);
    shieldSlab.position.set(0.54, 0.78, 0);
    shieldSlab.castShadow = true;
    bodyGroup.add(shieldSlab);

    const shieldRim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.14), shieldTrim);
    shieldRim.position.set(0.56, 0.78, 0);
    bodyGroup.add(shieldRim);

    const shieldBoss = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), shieldTrim);
    shieldBoss.position.set(0.66, 0.82, 0);
    bodyGroup.add(shieldBoss);
  } else {
    // BOSS: Malakor, Sovereign of the Seam
    primaryColor = '#3b102f';
    accentColor = '#f5c469';
    root.add(createContactShadow(1.25));

    const sovereignMat = registerMat(
      new THREE.MeshStandardMaterial({ color: 0x261029, roughness: 0.34, metalness: 0.76 })
    );
    const crownMat = registerMat(
      new THREE.MeshStandardMaterial({
        color: 0xf5c469,
        emissive: 0xb45309,
        emissiveIntensity: 0.65,
        roughness: 0.22,
        metalness: 0.9,
      })
    );
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xe11d48,
      emissiveIntensity: 2.2,
      roughness: 0.18,
    });

    // Towering Layered Mantle
    const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.88, 2.0, 8), sovereignMat);
    mantle.position.set(0, 1.1, 0);
    mantle.castShadow = true;
    bodyGroup.add(mantle);

    // Broad Armored Shoulders
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.52, 1.48), sovereignMat);
    shoulders.position.set(0, 1.85, 0);
    shoulders.castShadow = true;
    bodyGroup.add(shoulders);

    // Glowing Chest Rift Core
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), coreMat);
    core.position.set(0.36, 1.66, 0);
    bodyGroup.add(core);

    // Sovereign Head + Ornate Golden Horned Crown
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), sovereignMat);
    head.position.set(0.06, 2.38, 0);
    head.castShadow = true;
    bodyGroup.add(head);

    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 12), crownMat);
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.set(0.06, 2.58, 0);
    bodyGroup.add(crownRing);

    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.45, 4), crownMat);
      spike.position.set(0.06 + Math.cos(a) * 0.3, 2.84, Math.sin(a) * 0.3);
      bodyGroup.add(spike);
    }

    // 4 Orbiting Obsidian Monolith Shards (animated in scene3d)
    orbitGroup = new THREE.Group();
    orbitGroup.position.y = 1.5;
    bodyGroup.add(orbitGroup);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const monolith = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), crownMat);
      monolith.scale.set(0.7, 1.8, 0.7);
      monolith.position.set(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4);
      orbitGroup.add(monolith);
    }
  }

  return {
    root,
    bodyGroup,
    orbitGroup,
    hitMats,
    baseEmissiveColors: hitMats.map((m) => m.emissive.getHex()),
    primaryColor,
    accentColor,
    dispose: () => {
      disposeGroupResources(root);
    },
  };
}

/**
 * 3D Rift Forge Anvil Station (octagonal plinth + molten ember bed + multi-part iron anvil + glowing runes).
 */
export function createForgeAnvilModel(): { group: THREE.Group; emberRing: THREE.Mesh } {
  const group = new THREE.Group();
  group.add(createContactShadow(1.15));

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x262134, roughness: 0.85, metalness: 0.1 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x3b384a, roughness: 0.34, metalness: 0.82 });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xfb923c,
    emissive: 0xf97316,
    emissiveIntensity: 1.9,
    roughness: 0.3,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.22, 0.28, 8), stoneMat);
  plinth.position.y = 0.14;
  plinth.receiveShadow = true;
  group.add(plinth);

  const emberRing = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.06, 6, 20), emberMat);
  emberRing.rotation.x = Math.PI / 2;
  emberRing.position.y = 0.29;
  group.add(emberRing);

  // Anvil Base, Waist, Top Face & Horn
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.24, 0.56), ironMat);
  base.position.y = 0.4;
  base.castShadow = true;
  group.add(base);

  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.36), ironMat);
  waist.position.y = 0.68;
  waist.castShadow = true;
  group.add(waist);

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.28, 0.48), ironMat);
  top.position.set(-0.08, 0.96, 0);
  top.castShadow = true;
  group.add(top);

  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.58, 6), ironMat);
  horn.rotation.z = -Math.PI / 2;
  horn.position.set(0.68, 0.98, 0);
  horn.castShadow = true;
  group.add(horn);

  // Glowing forged ingot resting on anvil
  const ingot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.16), emberMat);
  ingot.position.set(0, 1.14, 0);
  group.add(ingot);

  return { group, emberRing };
}

/**
 * 3D Exit Rift Portal Archway (twin carved monoliths + arch lintel + animated vortex rings).
 */
export function createExitPortalModel(accentColor: string): {
  group: THREE.Group;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  vortexDisc: THREE.Mesh;
  vortexMat: THREE.MeshBasicMaterial;
} {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x262138, roughness: 0.78, metalness: 0.2 });
  const accentHex = new THREE.Color(accentColor);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.75, 0.24, 12), stoneMat);
  base.position.y = 0.12;
  base.receiveShadow = true;
  group.add(base);

  const pillarGeo = new THREE.BoxGeometry(0.42, 2.75, 0.48);
  const leftPillar = new THREE.Mesh(pillarGeo, stoneMat);
  leftPillar.position.set(-1.18, 1.45, 0);
  leftPillar.castShadow = true;
  const rightPillar = new THREE.Mesh(pillarGeo, stoneMat);
  rightPillar.position.set(1.18, 1.45, 0);
  rightPillar.castShadow = true;
  group.add(leftPillar, rightPillar);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.44, 0.56), stoneMat);
  lintel.position.set(0, 2.95, 0);
  lintel.castShadow = true;
  group.add(lintel);

  const outerRingMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 1.5,
    roughness: 0.25,
  });
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.085, 8, 24), outerRingMat);
  outerRing.position.set(0, 1.45, 0);
  group.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.055, 6, 20), outerRingMat);
  innerRing.position.set(0, 1.45, 0);
  group.add(innerRing);

  const vortexMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const vortexDisc = new THREE.Mesh(new THREE.CircleGeometry(0.92, 24), vortexMat);
  vortexDisc.position.set(0, 1.45, 0);
  group.add(vortexDisc);

  return { group, outerRing, innerRing, vortexDisc, vortexMat };
}

export function createBrazierModel(torchColor: string): {
  group: THREE.Group;
  flame: THREE.Mesh;
} {
  const group = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x262333, roughness: 0.45, metalness: 0.78 });
  const flameColor = new THREE.Color(torchColor);
  const flameMat = new THREE.MeshBasicMaterial({
    color: flameColor,
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
  });

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 0.68, 6), ironMat);
  stand.position.y = 0.34;
  stand.castShadow = true;
  group.add(stand);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.2, 0.26, 8), ironMat);
  bowl.position.y = 0.76;
  group.add(bowl);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.64, 6), flameMat);
  flame.position.y = 1.15;
  group.add(flame);

  // Soft warm floor light pool beneath brazier
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({
      map: getBrazierGlowTexture(),
      color: flameColor,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.022;
  group.add(pool);

  return { group, flame };
}

let sharedBrazierGlowTex: THREE.CanvasTexture | null = null;
function getBrazierGlowTexture(): THREE.CanvasTexture {
  if (sharedBrazierGlowTex) return sharedBrazierGlowTex;
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 64;
  glowCanvas.height = 64;
  const gctx = glowCanvas.getContext('2d')!;
  const grad = gctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 220, 140, 0.45)');
  grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.18)');
  grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 64, 64);
  sharedBrazierGlowTex = new THREE.CanvasTexture(glowCanvas);
  return sharedBrazierGlowTex;
}

export const MATERIAL_COLORS: Record<MaterialId, { main: number; css: string }> = {
  shadow_iron: { main: 0x94a3b8, css: '#94a3b8' },
  rift_shard: { main: 0xa78bfa, css: '#a78bfa' },
  ember_ash: { main: 0xfb923c, css: '#fb923c' },
  vital_essence: { main: 0x34d399, css: '#34d399' },
};

export function createMaterialNodeModel(material: MaterialId): {
  group: THREE.Group;
  crystalMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();
  group.add(createContactShadow(0.65));

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x242031, roughness: 0.88, metalness: 0.1 });
  const cHex = MATERIAL_COLORS[material].main;
  const crystalMat = new THREE.MeshStandardMaterial({
    color: cHex,
    emissive: cHex,
    emissiveIntensity: 0.6,
    roughness: 0.24,
    metalness: material === 'shadow_iron' ? 0.82 : 0.35,
  });

  const baseRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 0), rockMat);
  baseRock.scale.set(1.2, 0.55, 1.2);
  baseRock.position.y = 0.2;
  baseRock.castShadow = true;
  group.add(baseRock);

  // Cluster of 3 angled mineral spires
  const configs = [
    { x: 0, z: 0, h: 0.92, r: 0.2, rx: 0.08, rz: -0.08 },
    { x: 0.24, z: 0.14, h: 0.68, r: 0.15, rx: 0.25, rz: -0.3 },
    { x: -0.22, z: -0.14, h: 0.62, r: 0.14, rx: -0.24, rz: 0.28 },
  ];
  for (const cfg of configs) {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(cfg.r, cfg.h, 5), crystalMat);
    spire.position.set(cfg.x, 0.2 + cfg.h * 0.45, cfg.z);
    spire.rotation.set(cfg.rx, 0, cfg.rz);
    spire.castShadow = true;
    group.add(spire);
  }

  return { group, crystalMat };
}

export interface TrapModelRig {
  group: THREE.Group;
  activePart: THREE.Object3D;
  glowMat: THREE.MeshBasicMaterial;
}

export function createTrapModel(kind: TrapKind, worldRadius: number): TrapModelRig {
  const group = new THREE.Group();

  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x1a1724,
    roughness: 0.72,
    metalness: 0.45,
  });
  const basePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(worldRadius, worldRadius * 1.05, 0.07, 14),
    plateMat
  );
  basePlate.position.y = 0.035;
  basePlate.receiveShadow = true;
  group.add(basePlate);

  const glowColor =
    kind === 'void_geyser' ? 0xfb923c : kind === 'shadow_snare' ? 0xa78bfa : 0xef4444;
  const glowMat = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(worldRadius * 0.78, worldRadius * 0.96, 20),
    glowMat
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.085;
  group.add(ring);

  const activePart = new THREE.Group();
  if (kind === 'spikes') {
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.26,
      metalness: 0.88,
    });
    const spikeGeo = new THREE.ConeGeometry(0.11, 0.75, 4);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const dist = i === 0 ? 0 : worldRadius * 0.52;
      const sp = new THREE.Mesh(spikeGeo, steelMat);
      sp.position.set(Math.cos(a) * dist, 0.35, Math.sin(a) * dist);
      activePart.add(sp);
    }
    activePart.position.y = -0.7;
  } else if (kind === 'void_geyser') {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(worldRadius * 0.58, worldRadius * 0.72, 2.1, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    col.position.y = 1.05;
    activePart.add(col);
    activePart.visible = false;
  } else {
    const snareRing = new THREE.Mesh(
      new THREE.TorusGeometry(worldRadius * 0.75, 0.08, 6, 18),
      new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    snareRing.rotation.x = Math.PI / 2;
    snareRing.position.y = 0.2;
    activePart.add(snareRing);
    activePart.visible = false;
  }

  group.add(activePart);
  return { group, activePart, glowMat };
}

export function createPickupModel(
  kind: 'soul' | 'material' | 'heart',
  material?: MaterialId
): THREE.Group {
  const group = new THREE.Group();
  const hex =
    kind === 'soul'
      ? 0xc084fc
      : kind === 'heart'
        ? 0xf43f5e
        : MATERIAL_COLORS[material ?? 'shadow_iron'].main;

  const gemMat = new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.5,
  });

  const gem = new THREE.Mesh(
    kind === 'soul'
      ? new THREE.OctahedronGeometry(0.22, 0)
      : kind === 'heart'
        ? new THREE.DodecahedronGeometry(0.24, 0)
        : new THREE.OctahedronGeometry(0.24, 0),
    gemMat
  );
  gem.position.y = 0.52;
  group.add(gem);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.34, 16),
    new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.05;
  group.add(halo);

  return group;
}

/**
 * Recursively disposes geometries and materials inside a Three.js Group.
 */
export function disposeGroupResources(obj: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) materials.add(m);
      } else {
        materials.add(mesh.material);
      }
    }
  });

  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}
