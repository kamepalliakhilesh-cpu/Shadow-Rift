import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  MATERIAL_COLORS,
  createBrazierModel,
  createEnemyModel,
  createExitPortalModel,
  createForgeAnvilModel,
  createHeroModel,
  createMaterialNodeModel,
  createPickupModel,
  createThemeTextures,
  createTrapModel,
  disposeGroupResources,
  type EnemyModelRig,
  type HeroModelRig,
  type ThemeTextures,
  type TrapModelRig,
} from './models3d';
import { ParticleSystem3D } from './particles3d';
import type { SpellCastVfxKind } from './particleKinematics';
import type {
  DungeonFloor,
  EnemyEntity,
  FloatingNumberSlot,
  NovaEffect,
  PickupDrop,
  ProjectileEntity,
  ShadowCloneEntity,
  SlashEffect,
} from './types';
import {
  WORLD_SCALE,
  buildDungeonWallSegments,
  getLockedRoomBarrierRects,
  pxToWorld,
} from './wallGeometry';

export interface Scene3DPlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  aimAngle: number;
  scaleX: number;
  scaleY: number;
  walkPhase: number;
  hitFlash: number;
  invulnTimer: number;
  dashing: boolean;
  comboStep: 1 | 2 | 3;
  attackSwingTimer: number;
  bladeColor: string;
  cloakColor: string;
  shield: number;
  afterimages: Array<{ x: number; y: number; alpha: number; angle: number }>;
}

export interface Scene3DFrameInput {
  time: number;
  dt: number;
  cameraX: number;
  cameraY: number;
  trauma: number;
  floor: DungeonFloor;
  player: Scene3DPlayerState;
  enemies: EnemyEntity[];
  projectiles: ProjectileEntity[];
  pickups: PickupDrop[];
  clones: ShadowCloneEntity[];
  slashes: SlashEffect[];
  novas: NovaEffect[];
  floatingNumbers: FloatingNumberSlot[];
  pointerWorldX: number;
  pointerWorldY: number;
  nearForge: boolean;
  nearExit: boolean;
  exitUnlocked: boolean;
  isPlaying: boolean;
  showReticle: boolean;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoft = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return isSoft;
  } catch {
    return true;
  }
}

export class ShadowRiftScene3D {
  public readonly isSoftwareGl: boolean;
  public readonly particles = new ParticleSystem3D();

  private container: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private pmremEnvTex: THREE.Texture | null = null;

  private width = 1280;
  private height = 720;
  private contextLost = false;

  // Lights
  private hemiLight: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;
  private heroLight: THREE.PointLight;
  private forgeLight: THREE.PointLight;
  private flashLight: THREE.PointLight;
  private flashIntensity = 0;

  // Static floor geometry & props
  private floorGroup = new THREE.Group();
  private themeTextures: ThemeTextures | null = null;
  private braziers: Array<{ flame: THREE.Mesh; x: number; z: number; seed: number }> = [];
  private forgeRig: { group: THREE.Group; emberRing: THREE.Mesh } | null = null;
  private portalRig: ReturnType<typeof createExitPortalModel> | null = null;
  private trapRigs = new Map<string, TrapModelRig>();
  private nodeRigs = new Map<string, { group: THREE.Group; crystalMat: THREE.MeshStandardMaterial }>();
  private barrierGroup = new THREE.Group();
  private activeLockedRoomId: number | null = null;

  // Dynamic entities
  private heroRig: HeroModelRig;
  private enemyRigs = new Map<string, EnemyModelRig>();
  private enemyTelegraphGroup = new THREE.Group();
  private pickupRigs = new Map<string, THREE.Group>();
  private projectileGroup = new THREE.Group();
  private slashGroup = new THREE.Group();
  private afterimageGroup = new THREE.Group();
  private cloneGroup = new THREE.Group();
  private reticleGroup = new THREE.Group();

  // Reusable shared geometries/materials for dynamic VFX
  private projGeoOrb = new THREE.OctahedronGeometry(0.24, 1);
  private projGeoLance = new THREE.ConeGeometry(0.18, 1.45, 5);
  private projGeoWave = new THREE.TorusGeometry(0.65, 0.11, 6, 16, Math.PI * 0.9);
  private afterimageGeo = new THREE.ConeGeometry(0.36, 1.25, 6);
  private cloneGeo = new THREE.CylinderGeometry(0.32, 0.42, 1.35, 7);
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private scratchVec2 = new THREE.Vector2();
  private scratchVec3 = new THREE.Vector3();
  private ambientSpawnAccum = 0;

  // Context loss handlers
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
  };
  private onContextRestored = () => {
    this.contextLost = false;
  };

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'block w-full h-full outline-none cursor-crosshair';
    this.renderer.domElement.setAttribute('data-testid', 'game-canvas');
    this.renderer.domElement.tabIndex = 0;

    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    container.appendChild(this.renderer.domElement);

    // Lightweight transparent 2D overlay strictly for crisp floating damage numbers & world prompts
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.className = 'pointer-events-none fixed inset-0 w-full h-full';
    this.overlayCanvas.style.zIndex = '2';
    container.appendChild(this.overlayCanvas);
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;

    // Dramatic angled 3D isometric ARPG camera showcasing vertical masonry & hero/enemy silhouettes
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 140);
    this.camera.position.set(0, 14.8, 14.6);

    // Studio RoomEnvironment PMREM on every device for crisp metallic highlights
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.pmremEnvTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.pmremEnvTex;
      pmrem.dispose();
    } catch {
      // Fallback gracefully if PMREM unavailable
    }

    // Lighting rig: cool atmospheric hemisphere + warm key sun + hero lantern + forge hearth + combat flash
    this.hemiLight = new THREE.HemisphereLight(0x8b9ec7, 0x241d31, 0.92);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffeed6, 1.55);
    this.dirLight.position.set(14, 24, 12);
    this.dirLight.castShadow = !this.isSoftwareGl;
    if (this.dirLight.castShadow) {
      this.dirLight.shadow.mapSize.set(1024, 1024);
      this.dirLight.shadow.camera.near = 4;
      this.dirLight.shadow.camera.far = 55;
      const d = 16;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.heroLight = new THREE.PointLight(0xf5c469, 3.2, 13, 1.6);
    this.heroLight.position.set(0, 2.2, 0);
    this.scene.add(this.heroLight);

    this.forgeLight = new THREE.PointLight(0xf97316, 4.5, 14, 1.5);
    this.scene.add(this.forgeLight);

    this.flashLight = new THREE.PointLight(0xc084fc, 0, 18, 1.4);
    this.scene.add(this.flashLight);

    // Mount scene layers
    this.scene.add(this.floorGroup);
    this.scene.add(this.barrierGroup);
    this.scene.add(this.enemyTelegraphGroup);
    this.scene.add(this.projectileGroup);
    this.scene.add(this.slashGroup);
    this.scene.add(this.afterimageGroup);
    this.scene.add(this.cloneGroup);
    this.scene.add(this.particles.group);

    // Build Hero rig
    this.heroRig = createHeroModel();
    this.scene.add(this.heroRig.root);

    // Build 3D Ground Aim Reticle
    const retRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.42, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf5c469,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    retRing.rotation.x = -Math.PI / 2;
    retRing.position.y = 0.05;
    const retDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.08, 12),
      new THREE.MeshBasicMaterial({
        color: 0xfffbeb,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    retDot.rotation.x = -Math.PI / 2;
    retDot.position.y = 0.055;
    this.reticleGroup.add(retRing, retDot);
    this.reticleGroup.visible = false;
    this.scene.add(this.reticleGroup);

    this.resize();
  }

  public getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public resize(): void {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth));
    const h = Math.max(240, Math.round(rect.height || window.innerHeight));
    this.width = w;
    this.height = h;

    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.overlayCanvas.width = Math.round(w * dpr);
    this.overlayCanvas.height = Math.round(h * dpr);
    this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Paces continuous animation cleanly on software WebGL via WebGL2 fenceSync + 80ms yield
   * (prevents compositor starvation in headless verification), and uses raw rAF on GPU.
   */
  public afterDraw(cb: () => void): () => void {
    let cancelled = false;
    let timerId: number | null = null;
    let rafId: number | null = null;

    const cleanup = () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };

    if (!this.isSoftwareGl) {
      rafId = requestAnimationFrame(() => {
        if (!cancelled) cb();
      });
      return cleanup;
    }

    const gl = this.renderer.getContext();
    const pause = () => {
      if (cancelled) return;
      timerId = window.setTimeout(() => {
        if (!cancelled) cb();
      }, 80);
    };

    if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (sync) {
        gl.flush();
        const poll = () => {
          if (cancelled) {
            gl.deleteSync(sync);
            return;
          }
          if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) {
            timerId = window.setTimeout(poll, 4);
            return;
          }
          gl.deleteSync(sync);
          pause();
        };
        poll();
        return cleanup;
      }
    }

    pause();
    return cleanup;
  }

  /**
   * Raycasts pointer screen coordinates onto the y = 0 dungeon floor and returns 2D gameplay px coordinates.
   */
  public screenToWorldPx(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;

    this.scratchVec2.set(nx, ny);
    this.raycaster.setFromCamera(this.scratchVec2, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.scratchVec3);
    if (hit) {
      return {
        x: hit.x / WORLD_SCALE,
        y: hit.z / WORLD_SCALE,
      };
    }
    return { x: 0, y: 0 };
  }

  public triggerCombatFlash(px: number, py: number, cssColor: string, intensity = 7.5): void {
    this.flashLight.position.set(pxToWorld(px), 1.8, pxToWorld(py));
    this.flashLight.color.set(cssColor);
    this.flashIntensity = Math.max(this.flashIntensity, intensity);
  }

  public emitWeaponImpactPx(
    px: number,
    py: number,
    slashAngle: number,
    bladeColor: string,
    isCrit: boolean,
    isFinisher: boolean,
    blocked: boolean
  ): void {
    this.particles.pool.emitWeaponImpact(
      pxToWorld(px),
      pxToWorld(py),
      slashAngle,
      bladeColor,
      isCrit,
      isFinisher,
      blocked
    );
    if (isCrit || isFinisher) {
      this.triggerCombatFlash(px, py, isCrit ? '#fde047' : bladeColor, isCrit ? 9 : 6);
    }
  }

  public emitSpellCastPx(
    kind: SpellCastVfxKind,
    px: number,
    py: number,
    angle: number,
    color: string,
    radiusPx = 140
  ): void {
    this.particles.pool.emitSpellCast(
      kind,
      pxToWorld(px),
      pxToWorld(py),
      angle,
      color,
      pxToWorld(radiusPx)
    );
    if (kind !== 'lance_trail' && kind !== 'dash') {
      this.triggerCombatFlash(px, py, color, kind === 'boss_phase' ? 11 : 8.5);
    }
  }

  public emitEnemyDeathPx(enemy: EnemyEntity): void {
    const rig = this.enemyRigs.get(enemy.id);
    const primary = rig?.primaryColor ?? '#3b2d52';
    const accent = rig?.accentColor ?? '#c084fc';
    const isBoss = enemy.kind === 'boss_malakor';
    this.particles.pool.emitEnemyDeath(
      pxToWorld(enemy.x),
      pxToWorld(enemy.y),
      pxToWorld(enemy.radius),
      primary,
      accent,
      isBoss
    );
    this.triggerCombatFlash(enemy.x, enemy.y, accent, isBoss ? 12 : 7);
  }

  public emitNodeHitPx(px: number, py: number, material: keyof typeof MATERIAL_COLORS, shattered: boolean): void {
    const css = MATERIAL_COLORS[material].css;
    this.particles.pool.emitNodeHit(pxToWorld(px), pxToWorld(py), css, shattered);
  }

  public emitTrapBurstPx(px: number, py: number, color: string): void {
    this.particles.pool.emitTrapBurst(pxToWorld(px), pxToWorld(py), color);
  }

  /**
   * Builds all static 3D dungeon architecture & interactive props for a newly generated floor.
   */
  public buildFloor(floor: DungeonFloor): void {
    // Clean up prior floor resources
    this.clearFloorResources();
    this.particles.clear();

    const theme = floor.theme;
    const bgHex = new THREE.Color(theme.voidBg);
    this.scene.background = bgHex;
    this.scene.fog = new THREE.FogExp2(bgHex.getHex(), 0.0155);

    this.themeTextures = createThemeTextures(
      theme,
      this.renderer.capabilities.getMaxAnisotropy()
    );

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.themeTextures.wallMap,
      bumpMap: this.themeTextures.wallBump,
      bumpScale: 0.08,
      roughness: 0.84,
      metalness: 0.14,
    });

    const corniceMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.wallTop),
      roughness: 0.72,
      metalness: 0.25,
    });

    const accentTrimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.accentColor),
      emissive: new THREE.Color(theme.accentColor),
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.6,
    });

    // 1. Walkable Room & Corridor Flagstone Floors (UV tiled cleanly per slab!)
    const addFloorSlab = (x: number, y: number, w: number, h: number, yOffset = 0) => {
      const ww = pxToWorld(w);
      const wh = pxToWorld(h);
      const cx = pxToWorld(x + w / 2);
      const cz = pxToWorld(y + h / 2);

      const fMap = this.themeTextures!.floorMap.clone();
      fMap.repeat.set(Math.max(1, ww / 3), Math.max(1, wh / 3));
      fMap.needsUpdate = true;

      const fBump = this.themeTextures!.floorBump.clone();
      fBump.repeat.set(Math.max(1, ww / 3), Math.max(1, wh / 3));
      fBump.needsUpdate = true;

      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: fMap,
        bumpMap: fBump,
        bumpScale: 0.05,
        roughness: 0.88,
        metalness: 0.06,
      });

      const slab = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.3, wh), mat);
      slab.position.set(cx, -0.15 + yOffset, cz);
      slab.receiveShadow = true;
      this.floorGroup.add(slab);
    };

    for (const room of floor.rooms) {
      addFloorSlab(room.x, room.y, room.w, room.h, 0);

      // Decorative recessed center rune emblem on floor
      const emblemRadius = room.kind === 'boss' ? 3.2 : 1.8;
      const emblem = new THREE.Mesh(
        new THREE.RingGeometry(emblemRadius - 0.14, emblemRadius, 28),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(theme.accentColor),
          transparent: true,
          opacity: room.kind === 'boss' ? 0.32 : 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      emblem.rotation.x = -Math.PI / 2;
      emblem.position.set(pxToWorld(room.cx), 0.012, pxToWorld(room.cy));
      this.floorGroup.add(emblem);
    }

    for (const corridor of floor.corridors) {
      addFloorSlab(corridor.rect.x, corridor.rect.y, corridor.rect.w, corridor.rect.h, -0.004);
    }

    // 2. Perimeter 3D Masonry Walls (with doorway gaps cleanly carved out!)
    const wallSegments = buildDungeonWallSegments(floor, 28);
    for (const seg of wallSegments) {
      const ww = pxToWorld(seg.w);
      const wd = pxToWorld(seg.h);
      const wallH = seg.isForeground ? 1.15 : 2.55;
      const cx = pxToWorld(seg.x + seg.w / 2);
      const cz = pxToWorld(seg.y + seg.h / 2);

      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(ww, wallH, wd), wallMat);
      wallMesh.position.set(cx, wallH / 2, cz);
      wallMesh.castShadow = !seg.isForeground;
      wallMesh.receiveShadow = true;
      this.floorGroup.add(wallMesh);

      // Beveled top stone cornice cap
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(ww + 0.08, 0.16, wd + 0.08),
        corniceMat
      );
      cap.position.set(cx, wallH + 0.08, cz);
      this.floorGroup.add(cap);
    }

    // 3. Beveled Cover Pillars with glowing rune collars
    for (const room of floor.rooms) {
      for (const p of room.pillars) {
        const pw = pxToWorld(p.w);
        const pd = pxToWorld(p.h);
        const cx = pxToWorld(p.x + p.w / 2);
        const cz = pxToWorld(p.y + p.h / 2);

        const base = new THREE.Mesh(
          new THREE.BoxGeometry(pw + 0.24, 0.26, pd + 0.24),
          corniceMat
        );
        base.position.set(cx, 0.13, cz);
        base.receiveShadow = true;
        this.floorGroup.add(base);

        const shaft = new THREE.Mesh(new THREE.BoxGeometry(pw, 2.75, pd), wallMat);
        shaft.position.set(cx, 1.5, cz);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        this.floorGroup.add(shaft);

        const collar = new THREE.Mesh(
          new THREE.BoxGeometry(pw + 0.1, 0.12, pd + 0.1),
          accentTrimMat
        );
        collar.position.set(cx, 2.65, cz);
        this.floorGroup.add(collar);

        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(pw + 0.22, 0.2, pd + 0.22),
          corniceMat
        );
        cap.position.set(cx, 2.95, cz);
        this.floorGroup.add(cap);
      }

      // 4. Corner Braziers
      for (const b of room.braziers) {
        const bx = pxToWorld(b.x);
        const bz = pxToWorld(b.y);
        const rig = createBrazierModel(theme.torchColor);
        rig.group.position.set(bx, 0, bz);
        this.floorGroup.add(rig.group);
        this.braziers.push({
          flame: rig.flame,
          x: bx,
          z: bz,
          seed: bx * 3.1 + bz * 1.7,
        });
      }
    }

    // 5. Rift Forge Anvil in Entrance Sanctuary
    this.forgeRig = createForgeAnvilModel();
    const fx = pxToWorld(floor.forgePos.x);
    const fz = pxToWorld(floor.forgePos.y);
    this.forgeRig.group.position.set(fx, 0, fz);
    this.floorGroup.add(this.forgeRig.group);
    this.forgeLight.position.set(fx, 2.1, fz);

    // 6. Exit Rift Portal Archway in Boss Chamber
    this.portalRig = createExitPortalModel(theme.accentColor);
    this.portalRig.group.position.set(
      pxToWorld(floor.exitPos.x),
      0,
      pxToWorld(floor.exitPos.y)
    );
    this.floorGroup.add(this.portalRig.group);

    // 7. Environmental Traps
    for (const trap of floor.traps) {
      const rig = createTrapModel(trap.kind, pxToWorld(trap.radius));
      rig.group.position.set(pxToWorld(trap.x), 0, pxToWorld(trap.y));
      this.floorGroup.add(rig.group);
      this.trapRigs.set(trap.id, rig);
    }

    // 8. Harvestable Material Nodes
    for (const node of floor.nodes) {
      const rig = createMaterialNodeModel(node.material);
      rig.group.position.set(pxToWorld(node.x), 0, pxToWorld(node.y));
      this.floorGroup.add(rig.group);
      this.nodeRigs.set(node.id, rig);
    }

    // Pre-compile shaders on hardware GPU only (skip on software WebGL)
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  public renderFrame(input: Scene3DFrameInput): void {
    if (this.contextLost) return;

    const { time, dt, floor, player, enemies, projectiles, pickups, clones, slashes } = input;

    // 1. Update 3D particles & dynamic combat light
    this.particles.update(dt);
    if (this.flashIntensity > 0.05) {
      this.flashIntensity *= Math.exp(-9.5 * dt);
      this.flashLight.intensity = this.flashIntensity;
    } else {
      this.flashIntensity = 0;
      this.flashLight.intensity = 0;
    }

    // Emit subtle ambient embers near forge & player's nearby braziers
    this.ambientSpawnAccum += dt;
    if (this.ambientSpawnAccum >= 0.12) {
      this.ambientSpawnAccum = 0;
      const pwx = pxToWorld(player.x);
      const pwz = pxToWorld(player.y);
      if (Math.hypot(pxToWorld(floor.forgePos.x) - pwx, pxToWorld(floor.forgePos.y) - pwz) < 16) {
        this.particles.pool.emitAmbientEmber(
          pxToWorld(floor.forgePos.x),
          1.15,
          pxToWorld(floor.forgePos.y),
          '#fb923c'
        );
      }
      for (const b of this.braziers) {
        if (Math.hypot(b.x - pwx, b.z - pwz) < 15 && Math.random() < 0.35) {
          this.particles.pool.emitAmbientEmber(b.x, 1.35, b.z, floor.theme.torchColor);
        }
      }
    }

    // 2. Sync Hero 3D Model
    const hwx = pxToWorld(player.x);
    const hwz = pxToWorld(player.y);
    this.heroRig.root.position.set(hwx, 0, hwz);
    // Align +X model forward with 2D (cos(aim), sin(aim)) -> rotation.y = -aimAngle
    this.heroRig.bodyGroup.rotation.y = -player.aimAngle;

    const speedMag = Math.hypot(player.vx, player.vy);
    const strideAmp = Math.min(1, speedMag / 220);
    const walkBob = Math.abs(Math.sin(player.walkPhase)) * 0.1 * strideAmp;
    this.heroRig.bodyGroup.position.y = walkBob;
    this.heroRig.leftLeg.rotation.z = Math.sin(player.walkPhase) * 0.52 * strideAmp;
    this.heroRig.rightLeg.rotation.z = -Math.sin(player.walkPhase) * 0.52 * strideAmp;

    // Squash & stretch + forward dash lean
    this.heroRig.bodyGroup.scale.set(
      player.scaleX,
      player.scaleY,
      2 - player.scaleY
    );
    this.heroRig.bodyGroup.rotation.z = player.dashing ? -0.32 : -0.06 * strideAmp;

    // Weapon swing arc animation
    if (player.attackSwingTimer > 0) {
      const swingProgress = 1 - player.attackSwingTimer / 0.16;
      const swingDir = player.comboStep === 2 ? -1 : 1;
      this.heroRig.weaponPivot.rotation.y = swingDir * (-1.35 + swingProgress * 2.85);
      this.heroRig.weaponPivot.rotation.z = -0.18;
    } else {
      this.heroRig.weaponPivot.rotation.y = -0.38 + Math.sin(time * 3.5) * 0.06;
      this.heroRig.weaponPivot.rotation.z = 0.1;
    }

    // Sync gear tints & hit flash
    this.heroRig.cloakMat.color.set(player.cloakColor);
    this.heroRig.bladeMat.color.set(player.bladeColor);
    this.heroRig.bladeMat.emissive.set(player.bladeColor);
    this.heroRig.bladeMat.emissiveIntensity = player.attackSwingTimer > 0 ? 1.85 : 0.85;

    const hitFlashActive = player.hitFlash > 0;
    for (const m of this.heroRig.allHitMats) {
      m.emissive.setHex(hitFlashActive ? 0xff4444 : 0x000000);
      m.emissiveIntensity = hitFlashActive ? 1.4 : 0;
    }

    this.heroRig.shieldDome.visible = player.shield > 0;
    if (player.shield > 0) {
      this.heroRig.shieldDome.rotation.y = time * 1.4;
      this.heroRig.shieldDome.rotation.x = Math.sin(time * 1.1) * 0.25;
    }

    // Track Hero with key light & lantern
    this.heroLight.position.set(hwx, 2.35, hwz);
    this.dirLight.position.set(hwx + 12, 23, hwz + 10);
    this.dirLight.target.position.set(hwx, 0, hwz);
    this.dirLight.target.updateMatrixWorld();

    // 3. Camera follow + subtle combat trauma shake
    const camX = pxToWorld(input.cameraX);
    const camZ = pxToWorld(input.cameraY);
    const shakeAmp = input.trauma * input.trauma * 0.55;
    const sx = shakeAmp > 0.01 ? (Math.random() * 2 - 1) * shakeAmp : 0;
    const sz = shakeAmp > 0.01 ? (Math.random() * 2 - 1) * shakeAmp : 0;

    this.camera.position.set(camX + sx, 14.8, camZ + 14.6 + sz);
    this.camera.lookAt(camX + sx * 0.4, 0.65, camZ + sz * 0.4);

    // 4. Animate Braziers, Forge, Portal, Traps, Material Nodes, Locked Room Barriers
    for (const b of this.braziers) {
      const flicker = 0.86 + Math.sin(time * 12 + b.seed) * 0.16;
      b.flame.scale.set(flicker, 0.85 + Math.cos(time * 15 + b.seed) * 0.2, flicker);
      b.flame.rotation.y = time * 2.5 + b.seed;
    }

    if (this.forgeRig) {
      const pulse = 1 + Math.sin(time * 4.5) * 0.06;
      this.forgeRig.emberRing.scale.set(pulse, pulse, 1);
      this.forgeLight.intensity = 4.2 + Math.sin(time * 8) * 0.65;
    }

    if (this.portalRig) {
      this.portalRig.outerRing.rotation.z = time * (input.exitUnlocked ? 1.8 : 0.35);
      this.portalRig.innerRing.rotation.z = -time * (input.exitUnlocked ? 2.6 : 0.5);
      this.portalRig.innerRing.rotation.y = Math.sin(time * 1.4) * 0.4;
      this.portalRig.vortexDisc.visible = input.exitUnlocked;
      this.portalRig.vortexMat.opacity = 0.38 + Math.sin(time * 5) * 0.14;
    }

    for (const trap of floor.traps) {
      const rig = this.trapRigs.get(trap.id);
      if (!rig) continue;
      if (trap.kind === 'spikes') {
        const targetY = trap.state === 'active' ? 0.04 : trap.state === 'telegraph' ? -0.45 : -0.72;
        rig.activePart.position.y += (targetY - rig.activePart.position.y) * Math.min(1, dt * 20);
      } else {
        rig.activePart.visible = trap.state === 'active';
        if (trap.state === 'active') {
          rig.activePart.rotation.y = time * 4;
        }
      }
      rig.glowMat.opacity =
        trap.state === 'active'
          ? 0.92
          : trap.state === 'telegraph'
            ? 0.48 + Math.sin(time * 24) * 0.28
            : 0.16;
    }

    for (const node of floor.nodes) {
      const rig = this.nodeRigs.get(node.id);
      if (!rig) continue;
      rig.group.visible = !node.harvested;
      if (!node.harvested) {
        const flash = node.hitFlash > 0;
        rig.crystalMat.emissiveIntensity = flash ? 2.6 : 0.65 + Math.sin(time * 3 + node.x) * 0.18;
        const s = flash ? 1.14 : 1.0;
        rig.group.scale.set(s, s, s);
      }
    }

    this.syncLockedRoomBarriers(floor, time);

    // 5. Sync Enemies + 3D Death KO Animations + Telegraphs
    this.syncEnemies(enemies, time);

    // 6. Sync Dynamic Slash Crescents, Projectiles, Afterimages, Clones, Pickups, Aim Reticle
    this.syncSlashes(slashes);
    this.syncProjectiles(projectiles, time);
    this.syncAfterimages(player.afterimages);
    this.syncClones(clones, time);
    this.syncPickups(pickups, time);

    this.reticleGroup.visible = input.isPlaying && input.showReticle;
    if (this.reticleGroup.visible) {
      this.reticleGroup.position.set(
        pxToWorld(input.pointerWorldX),
        0,
        pxToWorld(input.pointerWorldY)
      );
      this.reticleGroup.rotation.y = time * 1.6;
    }

    // 7. Render 3D WebGL Scene
    this.renderer.render(this.scene, this.camera);

    // 8. Render crisp 2D projected overlay (floating combat numbers, enemy HP bars, diegetic prompts)
    this.render2DOverlay(input);
  }

  private syncLockedRoomBarriers(floor: DungeonFloor, time: number): void {
    const lockedRoom = floor.rooms.find((r) => r.locked) ?? null;
    const lockedId = lockedRoom ? lockedRoom.id : null;

    if (lockedId !== this.activeLockedRoomId) {
      this.activeLockedRoomId = lockedId;
      while (this.barrierGroup.children.length > 0) {
        const child = this.barrierGroup.children[0];
        disposeGroupResources(child);
        this.barrierGroup.remove(child);
      }

      if (lockedRoom) {
        const rects = getLockedRoomBarrierRects(lockedRoom, floor.corridors);
        for (const b of rects) {
          const bw = Math.max(0.22, pxToWorld(b.rect.w));
          const bd = Math.max(0.22, pxToWorld(b.rect.h));
          const gate = new THREE.Mesh(
            new THREE.BoxGeometry(bw, 2.2, bd),
            new THREE.MeshBasicMaterial({
              color: 0xef4444,
              transparent: true,
              opacity: 0.36,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
          );
          gate.position.set(
            pxToWorld(b.rect.x + b.rect.w / 2),
            1.1,
            pxToWorld(b.rect.y + b.rect.h / 2)
          );
          this.barrierGroup.add(gate);
        }
      }
    }

    for (const child of this.barrierGroup.children) {
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = 0.28 + Math.sin(time * 7) * 0.1;
    }
  }

  private syncEnemies(enemies: EnemyEntity[], time: number): void {
    const liveIds = new Set<string>();

    // Rebuild enemy windup telegraphs cleanly each frame
    while (this.enemyTelegraphGroup.children.length > 0) {
      const ch = this.enemyTelegraphGroup.children[0];
      disposeGroupResources(ch);
      this.enemyTelegraphGroup.remove(ch);
    }

    for (const e of enemies) {
      liveIds.add(e.id);
      let rig = this.enemyRigs.get(e.id);
      if (!rig) {
        rig = createEnemyModel(e.kind);
        this.scene.add(rig.root);
        this.enemyRigs.set(e.id, rig);
      }

      const wx = pxToWorld(e.x);
      const wz = pxToWorld(e.y);
      rig.root.position.set(wx, 0, wz);
      rig.bodyGroup.rotation.y = -e.facing;

      if (e.state === 'dying') {
        // Multi-stage dramatic 3D death animation: knockback topple -> fiery fissure glow -> shatter sink!
        const maxDeath = e.kind === 'boss_malakor' ? 0.65 : 0.45;
        const progress = Math.min(1, Math.max(0, 1 - e.deathTimer / maxDeath));
        const topple = Math.min(1, progress * 1.65);

        rig.bodyGroup.rotation.z = topple * 1.15;
        rig.bodyGroup.rotation.x = topple * 0.35;
        rig.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.35 - progress * 0.55;
        const shrink = Math.max(0.02, 1 - Math.pow(progress, 1.8));
        rig.bodyGroup.scale.set(shrink * 1.15, shrink * 0.78, shrink * 1.15);

        for (const mat of rig.hitMats) {
          mat.emissive.set(rig.accentColor);
          mat.emissiveIntensity = 1.6 + progress * 2.4;
        }
        continue;
      }

      // Alive animations
      rig.bodyGroup.rotation.z = 0;
      rig.bodyGroup.rotation.x = 0;
      const hover = e.kind === 'acolyte' || e.kind === 'boss_malakor'
        ? 0.2 + Math.sin(time * 4 + e.radius) * 0.14
        : Math.abs(Math.sin(time * 8 + e.x * 0.05)) * 0.08;
      rig.bodyGroup.position.y = hover;

      const windupCoil = e.state === 'windup' ? 1 + Math.sin(time * 28) * 0.08 : 1;
      rig.bodyGroup.scale.set(e.scaleX * windupCoil, e.scaleY, e.scaleX * windupCoil);

      if (rig.orbitGroup) {
        const spinSpeed = e.bossPhase === 2 ? 3.8 : 1.7;
        rig.orbitGroup.rotation.y = time * spinSpeed;
      }

      // Emissive feedback for Hit Flash & Windup Telegraph
      const flashing = e.hitFlash > 0;
      const winding = e.state === 'windup';
      for (let mIdx = 0; mIdx < rig.hitMats.length; mIdx++) {
        const mat = rig.hitMats[mIdx];
        if (flashing) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 1.8;
        } else if (winding) {
          mat.emissive.setHex(0xef4444);
          mat.emissiveIntensity = 0.75 + Math.sin(time * 26) * 0.45;
        } else {
          mat.emissive.setHex(rig.baseEmissiveColors[mIdx]);
          mat.emissiveIntensity = rig.baseEmissiveColors[mIdx] === 0 ? 0 : 0.55;
        }
      }

      // 3D Ground Attack Telegraphs
      if (e.state === 'windup') {
        const ratio = 1 - Math.max(0, e.stateTimer / Math.max(0.01, e.stateDuration));
        if (e.kind === 'lancer') {
          const laneLen = 5.4;
          const lane = new THREE.Mesh(
            new THREE.PlaneGeometry(laneLen, 0.85),
            new THREE.MeshBasicMaterial({
              color: 0xf97316,
              transparent: true,
              opacity: 0.25 + ratio * 0.45,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
          lane.rotation.x = -Math.PI / 2;
          lane.rotation.z = -e.facing;
          lane.position.set(
            wx + Math.cos(e.facing) * (laneLen / 2),
            0.045,
            wz + Math.sin(e.facing) * (laneLen / 2)
          );
          this.enemyTelegraphGroup.add(lane);
        } else if (e.kind === 'sentinel' || (e.kind === 'boss_malakor' && e.bossPatternIndex === 1)) {
          const tx = e.kind === 'boss_malakor' ? pxToWorld(e.targetX) : wx;
          const tz = e.kind === 'boss_malakor' ? pxToWorld(e.targetY) : wz;
          const maxR = e.kind === 'boss_malakor' ? pxToWorld(128) : pxToWorld(88);
          const outer = new THREE.Mesh(
            new THREE.RingGeometry(maxR - 0.14, maxR, 28),
            new THREE.MeshBasicMaterial({
              color: 0xef4444,
              transparent: true,
              opacity: 0.75,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
          outer.rotation.x = -Math.PI / 2;
          outer.position.set(tx, 0.05, tz);
          const fill = new THREE.Mesh(
            new THREE.CircleGeometry(Math.max(0.1, maxR * ratio), 24),
            new THREE.MeshBasicMaterial({
              color: 0xef4444,
              transparent: true,
              opacity: 0.26,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
          fill.rotation.x = -Math.PI / 2;
          fill.position.set(tx, 0.042, tz);
          this.enemyTelegraphGroup.add(outer, fill);
        } else if (e.kind === 'acolyte') {
          const beamLen = 7.2;
          const beam = new THREE.Mesh(
            new THREE.PlaneGeometry(beamLen, 0.16),
            new THREE.MeshBasicMaterial({
              color: 0xf43f5e,
              transparent: true,
              opacity: 0.35 + ratio * 0.5,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
          beam.rotation.x = -Math.PI / 2;
          beam.rotation.z = -e.facing;
          beam.position.set(
            wx + Math.cos(e.facing) * (beamLen / 2),
            0.06,
            wz + Math.sin(e.facing) * (beamLen / 2)
          );
          this.enemyTelegraphGroup.add(beam);
        }
      }
    }

    // Remove dead enemy meshes
    for (const [id, rig] of this.enemyRigs.entries()) {
      if (!liveIds.has(id)) {
        this.scene.remove(rig.root);
        rig.dispose();
        this.enemyRigs.delete(id);
      }
    }
  }

  private syncSlashes(slashes: SlashEffect[]): void {
    while (this.slashGroup.children.length > 0) {
      const ch = this.slashGroup.children[0];
      disposeGroupResources(ch);
      this.slashGroup.remove(ch);
    }

    for (const s of slashes) {
      const t = Math.max(0, s.life / s.maxLife);
      const radius = pxToWorld(s.radius);
      const innerR = Math.max(0.35, radius * (s.isFinisher ? 0.44 : 0.56));
      const arcAngle = s.isWhirlwind ? Math.PI * 2 : s.arc;

      const geo = new THREE.RingGeometry(innerR, radius, 22, 1, -arcAngle / 2, arcAngle);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(s.color),
        transparent: true,
        opacity: Math.min(1, t * 1.1),
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = -s.angle + (1 - t) * 0.35;
      mesh.position.set(pxToWorld(s.x), 0.88, pxToWorld(s.y));
      this.slashGroup.add(mesh);

      // Bright crisp outer edge ribbon
      const edgeGeo = new THREE.RingGeometry(radius - 0.14, radius + 0.04, 22, 1, -arcAngle / 2, arcAngle);
      const edgeMat = new THREE.MeshBasicMaterial({
        color: 0xfffbeb,
        transparent: true,
        opacity: t * 0.95,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.rotation.copy(mesh.rotation);
      edge.position.set(pxToWorld(s.x), 0.9, pxToWorld(s.y));
      this.slashGroup.add(edge);
    }
  }

  private syncProjectiles(projectiles: ProjectileEntity[], time: number): void {
    while (this.projectileGroup.children.length > 0) {
      const ch = this.projectileGroup.children[0] as THREE.Mesh;
      (ch.material as THREE.Material).dispose();
      this.projectileGroup.remove(ch);
    }

    for (const p of projectiles) {
      const wx = pxToWorld(p.x);
      const wz = pxToWorld(p.y);
      const ang = Math.atan2(p.vy, p.vx);

      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(p.color),
        toneMapped: false,
      });

      let mesh: THREE.Mesh;
      if (p.kind === 'astral_lance') {
        mesh = new THREE.Mesh(this.projGeoLance, mat);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.y = -ang;
        mesh.rotation.z = -Math.PI / 2;
      } else if (p.kind === 'shadow_wave') {
        mesh = new THREE.Mesh(this.projGeoWave, mat);
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = ang - Math.PI * 0.45;
      } else {
        mesh = new THREE.Mesh(this.projGeoOrb, mat);
        mesh.rotation.set(time * 5, time * 7, 0);
      }
      mesh.position.set(wx, 0.86, wz);
      this.projectileGroup.add(mesh);
    }
  }

  private syncAfterimages(
    afterimages: Array<{ x: number; y: number; alpha: number; angle: number }>
  ): void {
    while (this.afterimageGroup.children.length > 0) {
      const ch = this.afterimageGroup.children[0] as THREE.Mesh;
      (ch.material as THREE.Material).dispose();
      this.afterimageGroup.remove(ch);
    }

    for (const a of afterimages) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: a.alpha * 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ghost = new THREE.Mesh(this.afterimageGeo, mat);
      ghost.position.set(pxToWorld(a.x), 0.7, pxToWorld(a.y));
      ghost.rotation.y = -a.angle;
      this.afterimageGroup.add(ghost);
    }
  }

  private syncClones(clones: ShadowCloneEntity[], time: number): void {
    while (this.cloneGroup.children.length > 0) {
      const ch = this.cloneGroup.children[0];
      disposeGroupResources(ch);
      this.cloneGroup.remove(ch);
    }

    for (const c of clones) {
      const pulse = 1 + Math.sin(time * 18) * 0.1;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.62,
        wireframe: true,
      });
      const mesh = new THREE.Mesh(this.cloneGeo, mat);
      mesh.position.set(pxToWorld(c.x), 0.72, pxToWorld(c.y));
      mesh.scale.set(pulse, pulse, pulse);
      this.cloneGroup.add(mesh);
    }
  }

  private syncPickups(pickups: PickupDrop[], time: number): void {
    const liveIds = new Set<string>();
    for (const p of pickups) {
      liveIds.add(p.id);
      let mesh = this.pickupRigs.get(p.id);
      if (!mesh) {
        mesh = createPickupModel(p.kind, p.material);
        this.scene.add(mesh);
        this.pickupRigs.set(p.id, mesh);
      }
      const bob = Math.sin(time * 5 + p.x * 0.08) * 0.14;
      mesh.position.set(pxToWorld(p.x), bob, pxToWorld(p.y));
      mesh.children[0].rotation.y = time * 2.4;
    }

    for (const [id, mesh] of this.pickupRigs.entries()) {
      if (!liveIds.has(id)) {
        this.scene.remove(mesh);
        disposeGroupResources(mesh);
        this.pickupRigs.delete(id);
      }
    }
  }

  private projectWorld(wx: number, wy: number, wz: number): { x: number; y: number } | null {
    this.scratchVec3.set(wx, wy, wz).project(this.camera);
    if (this.scratchVec3.z < -1 || this.scratchVec3.z > 1) return null;
    return {
      x: (this.scratchVec3.x * 0.5 + 0.5) * this.width,
      y: (-this.scratchVec3.y * 0.5 + 0.5) * this.height,
    };
  }

  private render2DOverlay(input: Scene3DFrameInput): void {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Mini HP Bars above damaged non-boss enemies
    for (const e of input.enemies) {
      if (e.state === 'dying' || e.kind === 'boss_malakor' || e.hp >= e.maxHp) continue;
      const pt = this.projectWorld(pxToWorld(e.x), 2.15, pxToWorld(e.y));
      if (!pt) continue;
      const w = 40;
      const h = 5;
      ctx.fillStyle = 'rgba(10, 8, 16, 0.85)';
      ctx.fillRect(pt.x - w / 2 - 1, pt.y - 1, w + 2, h + 2);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(pt.x - w / 2, pt.y, w * Math.max(0, e.hp / e.maxHp), h);
    }

    // 2. Diegetic Interaction Prompts ([F] Rift Forge / [F] Descend Floor)
    if (input.isPlaying && input.nearForge) {
      const pt = this.projectWorld(
        pxToWorld(input.floor.forgePos.x),
        1.85,
        pxToWorld(input.floor.forgePos.y)
      );
      if (pt) {
        this.drawWorldPrompt(ctx, pt.x, pt.y, '[F] Open Rift Forge', '#f5c469');
      }
    }
    if (input.isPlaying && input.nearExit) {
      const pt = this.projectWorld(
        pxToWorld(input.floor.exitPos.x),
        3.2,
        pxToWorld(input.floor.exitPos.y)
      );
      if (pt) {
        this.drawWorldPrompt(
          ctx,
          pt.x,
          pt.y,
          input.exitUnlocked ? '[F] Enter Rift Portal' : 'Defeat Guardian to Unseal',
          input.exitUnlocked ? '#fde047' : '#94a3b8'
        );
      }
    }

    // 3. Projected Floating Damage Numbers & Harvest Notifications
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of input.floatingNumbers) {
      if (!f.active) continue;
      const lifeRatio = Math.max(0, f.life / f.maxLife);
      const liftY = 1.65 + (1 - lifeRatio) * 1.45;
      const pt = this.projectWorld(pxToWorld(f.x), liftY, pxToWorld(f.y));
      if (!pt) continue;

      const fontSize = Math.round(15 * f.scale);
      ctx.save();
      ctx.globalAlpha = Math.min(1, lifeRatio * 1.5);
      ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(8, 6, 14, 0.92)';
      ctx.strokeText(f.text, pt.x, pt.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, pt.x, pt.y);
      ctx.restore();
    }
  }

  private drawWorldPrompt(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    accent: string
  ): void {
    ctx.save();
    ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    const tw = ctx.measureText(text).width;
    const padX = 12;
    const boxW = tw + padX * 2;
    const boxH = 26;
    ctx.fillStyle = 'rgba(14, 11, 22, 0.9)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8f5ef';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  private clearFloorResources(): void {
    while (this.floorGroup.children.length > 0) {
      const child = this.floorGroup.children[0];
      disposeGroupResources(child);
      this.floorGroup.remove(child);
    }
    while (this.barrierGroup.children.length > 0) {
      const child = this.barrierGroup.children[0];
      disposeGroupResources(child);
      this.barrierGroup.remove(child);
    }
    for (const rig of this.enemyRigs.values()) {
      this.scene.remove(rig.root);
      rig.dispose();
    }
    this.enemyRigs.clear();

    for (const mesh of this.pickupRigs.values()) {
      this.scene.remove(mesh);
      disposeGroupResources(mesh);
    }
    this.pickupRigs.clear();

    this.braziers = [];
    this.forgeRig = null;
    this.portalRig = null;
    this.trapRigs.clear();
    this.nodeRigs.clear();
    this.activeLockedRoomId = null;

    if (this.themeTextures) {
      this.themeTextures.dispose();
      this.themeTextures = null;
    }
  }

  public dispose(): void {
    this.clearFloorResources();
    this.heroRig.dispose();
    this.particles.dispose();
    this.projGeoOrb.dispose();
    this.projGeoLance.dispose();
    this.projGeoWave.dispose();
    this.afterimageGeo.dispose();
    this.cloneGeo.dispose();
    disposeGroupResources(this.reticleGroup);
    if (this.pmremEnvTex) {
      this.pmremEnvTex.dispose();
      this.pmremEnvTex = null;
    }

    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlayCanvas.remove();
  }
}
