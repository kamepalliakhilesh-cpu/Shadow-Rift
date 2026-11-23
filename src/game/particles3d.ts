import * as THREE from 'three';
import {
  MAX_SHARD_PARTICLES,
  MAX_SHOCKWAVE_RINGS,
  MAX_WISP_PARTICLES,
  ParticlePool3D,
} from './particleKinematics';

/**
 * GPU-instanced Three.js renderer for ParticlePool3D.
 * Uses 1 draw call for all 520 sparks/shards, 1 draw call for all 240 wisps,
 * and pooled torus rings for 3D shockwaves — zero per-frame allocations.
 */
export class ParticleSystem3D {
  public readonly group = new THREE.Group();
  public readonly pool = new ParticlePool3D(
    MAX_SHARD_PARTICLES,
    MAX_WISP_PARTICLES,
    MAX_SHOCKWAVE_RINGS
  );

  private shardMesh: THREE.InstancedMesh;
  private shardGeo: THREE.OctahedronGeometry;
  private shardMat: THREE.MeshBasicMaterial;

  private wispMesh: THREE.InstancedMesh;
  private wispGeo: THREE.IcosahedronGeometry;
  private wispMat: THREE.MeshBasicMaterial;

  private ringGeo: THREE.TorusGeometry;
  private ringMeshes: THREE.Mesh[] = [];
  private ringMats: THREE.MeshBasicMaterial[] = [];

  // Scratch objects (zero GC per frame)
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratchPos = new THREE.Vector3();
  private readonly scratchScale = new THREE.Vector3();
  private readonly scratchQuat = new THREE.Quaternion();
  private readonly scratchEuler = new THREE.Euler();
  private readonly scratchDir = new THREE.Vector3();
  private readonly scratchForward = new THREE.Vector3(0, 0, 1);
  private readonly scratchColor = new THREE.Color();
  private readonly zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor() {
    this.group.name = 'ParticleSystem3D';

    // 1. Shards & directional sparks (faceted crystal octahedron)
    this.shardGeo = new THREE.OctahedronGeometry(1, 0);
    this.shardMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    this.shardMesh = new THREE.InstancedMesh(
      this.shardGeo,
      this.shardMat,
      MAX_SHARD_PARTICLES
    );
    this.shardMesh.frustumCulled = false;
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX_SHARD_PARTICLES; i++) {
      this.shardMesh.setMatrixAt(i, this.zeroMatrix);
      this.shardMesh.setColorAt(i, this.scratchColor.setHex(0xffffff));
    }
    this.group.add(this.shardMesh);

    // 2. Soul wisps, dash mist, heal helices, ambient embers
    this.wispGeo = new THREE.IcosahedronGeometry(1, 0);
    this.wispMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.wispMesh = new THREE.InstancedMesh(
      this.wispGeo,
      this.wispMat,
      MAX_WISP_PARTICLES
    );
    this.wispMesh.frustumCulled = false;
    this.wispMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX_WISP_PARTICLES; i++) {
      this.wispMesh.setMatrixAt(i, this.zeroMatrix);
      this.wispMesh.setColorAt(i, this.scratchColor.setHex(0xa78bfa));
    }
    this.group.add(this.wispMesh);

    // 3. Expanding 3D shockwave torus rings
    this.ringGeo = new THREE.TorusGeometry(1, 0.08, 8, 32);
    for (let i = 0; i < MAX_SHOCKWAVE_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.visible = false;
      mesh.rotation.x = Math.PI / 2;
      this.ringMats.push(mat);
      this.ringMeshes.push(mesh);
      this.group.add(mesh);
    }
  }

  public clear(): void {
    this.pool.clear();
    this.syncToScene();
  }

  public update(dt: number): void {
    this.pool.step(dt);
    this.syncToScene();
  }

  public syncToScene(): void {
    // Sync Shards
    const shards = this.pool.shards;
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      if (!s.active) {
        this.shardMesh.setMatrixAt(i, this.zeroMatrix);
        continue;
      }
      const lifeRatio = Math.max(0, s.life / s.maxLife);
      const shrink = Math.min(1, lifeRatio * 1.45);

      this.scratchPos.set(s.x, s.y, s.z);
      if (s.alignVelocity) {
        const speedSq = s.vx * s.vx + s.vy * s.vy + s.vz * s.vz;
        if (speedSq > 0.02) {
          this.scratchDir.set(s.vx, s.vy, s.vz).normalize();
          this.scratchQuat.setFromUnitVectors(this.scratchForward, this.scratchDir);
        } else {
          this.scratchQuat.identity();
        }
        const stretch = Math.min(2.2, 0.7 + Math.sqrt(speedSq) * 0.18);
        this.scratchScale.set(
          s.scaleX * shrink,
          s.scaleY * shrink,
          s.scaleZ * shrink * stretch
        );
      } else {
        this.scratchEuler.set(s.rotX, s.rotY, s.rotZ);
        this.scratchQuat.setFromEuler(this.scratchEuler);
        this.scratchScale.set(
          s.scaleX * shrink,
          s.scaleY * shrink,
          s.scaleZ * shrink
        );
      }

      this.scratchMatrix.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
      this.shardMesh.setMatrixAt(i, this.scratchMatrix);
      this.shardMesh.setColorAt(i, this.scratchColor.setHex(s.colorHex));
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;
    if (this.shardMesh.instanceColor) {
      this.shardMesh.instanceColor.needsUpdate = true;
    }

    // Sync Wisps
    const wisps = this.pool.wisps;
    for (let i = 0; i < wisps.length; i++) {
      const w = wisps[i];
      if (!w.active) {
        this.wispMesh.setMatrixAt(i, this.zeroMatrix);
        continue;
      }
      const t = 1 - Math.max(0, w.life / w.maxLife);
      const scale = Math.max(
        0.001,
        w.size * (1 + t * w.growRate) * (1 - t * 0.75)
      );
      this.scratchPos.set(w.x, w.y, w.z);
      this.scratchQuat.identity();
      this.scratchScale.set(scale, scale, scale);
      this.scratchMatrix.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
      this.wispMesh.setMatrixAt(i, this.scratchMatrix);
      // Fade wisp brightness with lifetime since additive blending treats dark as transparent
      this.scratchColor.setHex(w.colorHex).multiplyScalar(1 - t * 0.85);
      this.wispMesh.setColorAt(i, this.scratchColor);
    }
    this.wispMesh.instanceMatrix.needsUpdate = true;
    if (this.wispMesh.instanceColor) {
      this.wispMesh.instanceColor.needsUpdate = true;
    }

    // Sync Shockwave Rings
    const rings = this.pool.rings;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const mesh = this.ringMeshes[i];
      const mat = this.ringMats[i];
      if (!r.active) {
        mesh.visible = false;
        continue;
      }
      const t = 1 - Math.max(0, r.life / r.maxLife);
      const easeOut = 1 - Math.pow(1 - t, 2.5);
      const curRadius = r.startRadius + (r.endRadius - r.startRadius) * easeOut;

      mesh.visible = true;
      mesh.position.set(r.x, r.y, r.z);
      mesh.rotation.set(Math.PI / 2 + r.tiltX, 0, r.tiltZ);
      mesh.scale.set(curRadius, curRadius, Math.max(0.3, (1 - t) * 1.4));
      mat.color.setHex(r.colorHex);
      mat.opacity = (1 - t) * 0.92;
    }
  }

  public dispose(): void {
    this.shardGeo.dispose();
    this.shardMat.dispose();
    this.wispGeo.dispose();
    this.wispMat.dispose();
    this.ringGeo.dispose();
    for (const mat of this.ringMats) mat.dispose();
  }
}
