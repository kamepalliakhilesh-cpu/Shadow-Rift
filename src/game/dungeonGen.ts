import { getThemeForFloor } from './themes';
import type {
  Corridor,
  DungeonFloor,
  DungeonRoom,
  MaterialId,
  MaterialNode,
  Rect,
  RoomKind,
  TrapEntity,
  TrapKind,
} from './types';

export function createRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TILE_SIZE = 48;
const CELL_STRIDE = 1040; // Distance between room centers on grid
const CORRIDOR_WIDTH = 148;

interface GridNode {
  id: number;
  gx: number;
  gy: number;
  neighbors: number[];
  distFromStart: number;
  kind: RoomKind;
}

function keyOf(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

export function generateDungeonFloor(floorNumber: number, seed?: number): DungeonFloor {
  const resolvedSeed =
    seed !== undefined
      ? seed
      : ((Date.now() ^ (floorNumber * 2654435761)) >>> 0) || 1337;
  const rng = createRng(resolvedSeed);
  const theme = getThemeForFloor(floorNumber, resolvedSeed % 4);

  // Variable number of rooms: 5 to 7 rooms depending on floor & rng
  const baseCount = Math.min(7, 5 + Math.floor((floorNumber - 1) / 2));
  const targetRoomCount = Math.min(7, Math.max(4, baseCount + (rng() > 0.55 ? 1 : 0)));

  const gridMap = new Map<string, GridNode>();
  const nodes: GridNode[] = [];

  const startNode: GridNode = {
    id: 0,
    gx: 0,
    gy: 0,
    neighbors: [],
    distFromStart: 0,
    kind: 'entrance',
  };
  gridMap.set(keyOf(0, 0), startNode);
  nodes.push(startNode);

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  // Grow connected dungeon graph with branching
  let guard = 0;
  while (nodes.length < targetRoomCount && guard < 200) {
    guard++;
    // Bias toward growing from more recent rooms to create depth, with occasional branches
    const pickIdx =
      rng() < 0.65
        ? nodes.length - 1
        : Math.floor(rng() * nodes.length);
    const parent = nodes[pickIdx];
    const dir = dirs[Math.floor(rng() * dirs.length)];
    const nx = parent.gx + dir.dx;
    const ny = parent.gy + dir.dy;
    const k = keyOf(nx, ny);
    if (gridMap.has(k)) continue;

    // Avoid dense 2x2 loops so dungeon feels exploratory
    let adjacentCount = 0;
    for (const d of dirs) {
      if (gridMap.has(keyOf(nx + d.dx, ny + d.dy))) adjacentCount++;
    }
    if (adjacentCount > 1 && rng() < 0.75) continue;

    const newNode: GridNode = {
      id: nodes.length,
      gx: nx,
      gy: ny,
      neighbors: [parent.id],
      distFromStart: parent.distFromStart + 1,
      kind: 'combat',
    };
    parent.neighbors.push(newNode.id);
    gridMap.set(k, newNode);
    nodes.push(newNode);
  }

  // BFS distances from Entrance (id 0)
  const queue: number[] = [0];
  const visited = new Set<number>([0]);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currNode = nodes[curr];
    for (const nb of currNode.neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb);
        nodes[nb].distFromStart = currNode.distFromStart + 1;
        queue.push(nb);
      }
    }
  }

  // Pick farthest room as Boss/Exit room
  let exitNode = nodes[nodes.length - 1];
  for (const n of nodes) {
    if (n.distFromStart > exitNode.distFromStart) {
      exitNode = n;
    }
  }
  exitNode.kind = 'boss';

  // Assign special rooms among intermediate rooms
  const middleNodes = nodes.filter((n) => n.id !== 0 && n.id !== exitNode.id);
  if (middleNodes.length >= 2) {
    // Prefer a dead-end leaf for Treasure/Harvest Vault if available
    const leaf = middleNodes.find((n) => n.neighbors.length === 1) ?? middleNodes[0];
    leaf.kind = 'treasure';
    const remaining = middleNodes.filter((n) => n.id !== leaf.id);
    if (remaining.length >= 1) {
      remaining[Math.floor(rng() * remaining.length)].kind = 'trap_gauntlet';
    }
  } else if (middleNodes.length === 1) {
    middleNodes[0].kind = 'trap_gauntlet';
  }

  // Build physical rooms
  const rooms: DungeonRoom[] = nodes.map((n) => {
    let w = 680;
    let h = 520;
    if (n.kind === 'entrance') {
      w = 620;
      h = 480;
    } else if (n.kind === 'boss') {
      w = 820;
      h = 640;
    } else if (n.kind === 'treasure') {
      w = 560;
      h = 460;
    } else if (n.kind === 'trap_gauntlet') {
      w = 720;
      h = 540;
    } else {
      w = 660 + Math.floor(rng() * 3) * 48;
      h = 500 + Math.floor(rng() * 3) * 48;
    }

    const cx = n.gx * CELL_STRIDE;
    const cy = n.gy * CELL_STRIDE;
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h / 2);

    const pillars: Rect[] = [];
    if (n.kind === 'combat' || n.kind === 'boss') {
      const ox = Math.round(w * 0.27);
      const oy = Math.round(h * 0.27);
      const pw = 54;
      const ph = 54;
      // 4 symmetric corner-quadrant cover pillars (leaving center & all 4 cardinal doorways wide open)
      pillars.push(
        { x: cx - ox - pw / 2, y: cy - oy - ph / 2, w: pw, h: ph },
        { x: cx + ox - pw / 2, y: cy - oy - ph / 2, w: pw, h: ph },
        { x: cx - ox - pw / 2, y: cy + oy - ph / 2, w: pw, h: ph },
        { x: cx + ox - pw / 2, y: cy + oy - ph / 2, w: pw, h: ph }
      );
    } else if (n.kind === 'trap_gauntlet') {
      const ox = Math.round(w * 0.26);
      const pw = 48;
      const ph = 48;
      pillars.push(
        { x: cx - ox - pw / 2, y: cy - ph / 2, w: pw, h: ph },
        { x: cx + ox - pw / 2, y: cy - ph / 2, w: pw, h: ph }
      );
    }

    const braziers = [
      { x: x + 56, y: y + 56 },
      { x: x + w - 56, y: y + 56 },
      { x: x + 56, y: y + h - 56 },
      { x: x + w - 56, y: y + h - 56 },
    ];

    let enemyBudget = 0;
    if (n.kind === 'combat') {
      enemyBudget = 4 + floorNumber * 2 + Math.floor(rng() * 2);
    } else if (n.kind === 'trap_gauntlet') {
      enemyBudget = 3 + floorNumber * 2;
    } else if (n.kind === 'treasure') {
      enemyBudget = 2 + floorNumber;
    } else if (n.kind === 'boss') {
      enemyBudget = 1; // Boss + optional adds
    }

    return {
      id: n.id,
      kind: n.kind,
      gridX: n.gx,
      gridY: n.gy,
      x,
      y,
      w,
      h,
      cx,
      cy,
      neighbors: [...n.neighbors],
      discovered: n.kind === 'entrance',
      cleared: n.kind === 'entrance',
      locked: false,
      pillars,
      braziers,
      enemyBudget,
      spawned: n.kind === 'entrance',
    };
  });

  // Build connecting corridors between neighbor pairs
  const corridors: Corridor[] = [];
  const seenPairs = new Set<string>();
  for (const room of rooms) {
    for (const nbId of room.neighbors) {
      const a = Math.min(room.id, nbId);
      const b = Math.max(room.id, nbId);
      const pairKey = `${a}-${b}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const roomA = rooms[a];
      const roomB = rooms[b];
      const horizontal = roomA.gridY === roomB.gridY;

      if (horizontal) {
        const leftRoom = roomA.cx < roomB.cx ? roomA : roomB;
        const rightRoom = roomA.cx < roomB.cx ? roomB : roomA;
        const startX = leftRoom.x + leftRoom.w - 36;
        const endX = rightRoom.x + 36;
        corridors.push({
          fromRoomId: a,
          toRoomId: b,
          horizontal: true,
          rect: {
            x: startX,
            y: Math.round(leftRoom.cy - CORRIDOR_WIDTH / 2),
            w: endX - startX,
            h: CORRIDOR_WIDTH,
          },
        });
      } else {
        const topRoom = roomA.cy < roomB.cy ? roomA : roomB;
        const bottomRoom = roomA.cy < roomB.cy ? roomB : roomA;
        const startY = topRoom.y + topRoom.h - 36;
        const endY = bottomRoom.y + 36;
        corridors.push({
          fromRoomId: a,
          toRoomId: b,
          horizontal: false,
          rect: {
            x: Math.round(topRoom.cx - CORRIDOR_WIDTH / 2),
            y: startY,
            w: CORRIDOR_WIDTH,
            h: endY - startY,
          },
        });
      }
    }
  }

  // Place environmental traps in non-entrance rooms
  const traps: TrapEntity[] = [];
  let trapCounter = 0;
  for (const room of rooms) {
    if (room.kind === 'entrance') continue;
    const count =
      room.kind === 'trap_gauntlet'
        ? 4 + Math.min(2, floorNumber)
        : room.kind === 'combat'
          ? 2 + (rng() > 0.5 ? 1 : 0)
          : room.kind === 'boss'
            ? 2
            : 1;

    for (let i = 0; i < count; i++) {
      const kind: TrapKind =
        theme.trapTypes[Math.floor(rng() * theme.trapTypes.length)];
      let tx = room.cx;
      let ty = room.cy;
      let placed = false;

      for (let attempt = 0; attempt < 20; attempt++) {
        const margin = 96;
        const cx = room.x + margin + rng() * (room.w - margin * 2);
        const cy = room.y + margin + rng() * (room.h - margin * 2);

        // Keep away from center of boss room (exit portal) and pillars and other traps
        if (room.kind === 'boss' && Math.hypot(cx - room.cx, cy - room.cy) < 120) {
          continue;
        }
        const hitsPillar = room.pillars.some(
          (p) =>
            cx > p.x - 42 &&
            cx < p.x + p.w + 42 &&
            cy > p.y - 42 &&
            cy < p.y + p.h + 42
        );
        if (hitsPillar) continue;

        const tooCloseTrap = traps.some(
          (t) => t.roomId === room.id && Math.hypot(t.x - cx, t.y - cy) < 108
        );
        if (tooCloseTrap) continue;

        tx = Math.round(cx);
        ty = Math.round(cy);
        placed = true;
        break;
      }

      if (placed) {
        const period = kind === 'spikes' ? 3.2 : kind === 'void_geyser' ? 3.8 : 4.2;
        traps.push({
          id: `trap_${floorNumber}_${trapCounter++}`,
          kind,
          x: tx,
          y: ty,
          radius: kind === 'shadow_snare' ? 44 : 36,
          cyclePeriod: period,
          phaseOffset: rng() * period,
          timer: rng() * period,
          state: 'idle',
          damage:
            kind === 'shadow_snare'
              ? 8 + floorNumber * 2
              : 14 + floorNumber * 3,
          roomId: room.id,
          triggeredHitIds: new Set<string>(),
        });
      }
    }
  }

  // Place harvestable environmental material nodes
  const allMaterials: MaterialId[] = [
    'shadow_iron',
    'rift_shard',
    'ember_ash',
    'vital_essence',
  ];
  const materialNodes: MaterialNode[] = [];
  let nodeCounter = 0;

  for (const room of rooms) {
    const nodeCount =
      room.kind === 'entrance'
        ? 2 // Guaranteed 2 harvestable nodes right in Sanctuary so players learn harvesting immediately!
        : room.kind === 'treasure'
          ? 4
          : room.kind === 'boss'
            ? 1
            : 2;

    for (let i = 0; i < nodeCount; i++) {
      let material: MaterialId;
      if (room.kind === 'entrance') {
        material = i === 0 ? 'shadow_iron' : 'ember_ash';
      } else if (rng() < 0.48) {
        material = theme.materialBias;
      } else {
        material = allMaterials[Math.floor(rng() * allMaterials.length)];
      }

      let nx = room.cx;
      let ny = room.cy;
      let placed = false;

      if (room.kind === 'entrance') {
        // Neat positions in the entrance room away from spawn & doorways
        nx = i === 0 ? room.x + 115 : room.x + room.w - 115;
        ny = i === 0 ? room.y + room.h - 105 : room.y + room.h - 105;
        placed = true;
      } else {
        for (let attempt = 0; attempt < 20; attempt++) {
          const margin = 84;
          const cx = room.x + margin + rng() * (room.w - margin * 2);
          const cy = room.y + margin + rng() * (room.h - margin * 2);
          const hitsPillar = room.pillars.some(
            (p) =>
              cx > p.x - 36 &&
              cx < p.x + p.w + 36 &&
              cy > p.y - 36 &&
              cy < p.y + p.h + 36
          );
          if (hitsPillar) continue;
          const nearTrap = traps.some(
            (t) => t.roomId === room.id && Math.hypot(t.x - cx, t.y - cy) < 76
          );
          if (nearTrap) continue;
          const nearNode = materialNodes.some(
            (m) => m.roomId === room.id && Math.hypot(m.x - cx, m.y - cy) < 74
          );
          if (nearNode) continue;

          nx = Math.round(cx);
          ny = Math.round(cy);
          placed = true;
          break;
        }
      }

      if (placed) {
        materialNodes.push({
          id: `node_${floorNumber}_${nodeCounter++}`,
          material,
          x: nx,
          y: ny,
          radius: 22,
          hp: 2,
          maxHp: 2,
          yieldAmount: room.kind === 'treasure' ? 3 : 2,
          roomId: room.id,
          hitFlash: 0,
          harvested: false,
        });
      }
    }
  }

  const entranceRoom = rooms[0];
  const exitRoom = rooms[exitNode.id];

  // Player spawns in the wide open center of Entrance room; Forge Anvil sits neatly to upper-left of center
  const spawnX = entranceRoom.cx;
  const spawnY = entranceRoom.cy + 26;
  const forgePos = {
    x: entranceRoom.cx - 102,
    y: entranceRoom.cy - 64,
  };
  const exitPos = {
    x: exitRoom.cx,
    y: exitRoom.cy,
  };

  const walkableRects: Rect[] = [
    ...rooms.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    ...corridors.map((c) => c.rect),
  ];

  return {
    floorNumber,
    seed: resolvedSeed,
    theme,
    tileSize: TILE_SIZE,
    rooms,
    corridors,
    wallRects: [],
    walkableRects,
    entranceRoomId: entranceRoom.id,
    exitRoomId: exitRoom.id,
    spawnX,
    spawnY,
    forgePos,
    exitPos,
    traps,
    nodes: materialNodes,
  };
}

export function isDungeonConnected(floor: DungeonFloor): boolean {
  const visited = new Set<number>();
  const stack: number[] = [floor.entranceRoomId];
  visited.add(floor.entranceRoomId);
  while (stack.length > 0) {
    const id = stack.pop()!;
    const room = floor.rooms.find((r) => r.id === id);
    if (!room) continue;
    for (const nb of room.neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb);
        stack.push(nb);
      }
    }
  }
  return visited.size === floor.rooms.length && visited.has(floor.exitRoomId);
}
