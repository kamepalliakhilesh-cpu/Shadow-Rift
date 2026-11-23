import type { Corridor, DungeonFloor, DungeonRoom, Rect } from './types';

/**
 * Maps 2D gameplay pixel coordinates to 3D world metric units.
 * 1 tile (48px) = 1.5m; corridor width (148px) = 4.625m; hero radius (16px) = 0.5m.
 */
export const WORLD_SCALE = 1 / 32;

export function pxToWorld(px: number): number {
  return px * WORLD_SCALE;
}

export interface Interval {
  start: number;
  end: number;
}

export interface WallSegment2D {
  x: number;
  y: number;
  w: number;
  h: number;
  /** True for south-facing foreground walls kept lower so isometric camera never occludes hero */
  isForeground: boolean;
}

/**
 * Subtracts a list of doorway opening intervals from a span [min, max].
 */
export function subtractIntervals(
  min: number,
  max: number,
  cuts: Interval[]
): Interval[] {
  if (cuts.length === 0) return [{ start: min, end: max }];

  const sorted = cuts
    .map((c) => ({ start: Math.max(min, c.start), end: Math.min(max, c.end) }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start);

  const result: Interval[] = [];
  let cursor = min;
  for (const cut of sorted) {
    if (cut.start > cursor + 2) {
      result.push({ start: cursor, end: cut.start });
    }
    cursor = Math.max(cursor, cut.end);
  }
  if (max > cursor + 2) {
    result.push({ start: cursor, end: max });
  }
  return result;
}

function getRoomOpenings(
  room: DungeonRoom,
  corridors: Corridor[]
): { north: Interval[]; south: Interval[]; west: Interval[]; east: Interval[] } {
  const north: Interval[] = [];
  const south: Interval[] = [];
  const west: Interval[] = [];
  const east: Interval[] = [];

  for (const c of corridors) {
    if (c.fromRoomId !== room.id && c.toRoomId !== room.id) continue;
    const r = c.rect;
    if (c.horizontal) {
      // Corridor intersects east or west wall of room
      if (r.x <= room.x + 12 && r.x + r.w >= room.x - 12) {
        west.push({ start: r.y, end: r.y + r.h });
      }
      if (r.x <= room.x + room.w + 12 && r.x + r.w >= room.x + room.w - 12) {
        east.push({ start: r.y, end: r.y + r.h });
      }
    } else {
      // Corridor intersects north or south wall of room
      if (r.y <= room.y + 12 && r.y + r.h >= room.y - 12) {
        north.push({ start: r.x, end: r.x + r.w });
      }
      if (r.y <= room.y + room.h + 12 && r.y + r.h >= room.y + room.h - 12) {
        south.push({ start: r.x, end: r.x + r.w });
      }
    }
  }

  return { north, south, west, east };
}

/**
 * Generates clean 3D perimeter wall segments framing every room and corridor
 * while leaving every corridor doorway 100% open.
 */
export function buildDungeonWallSegments(
  floor: DungeonFloor,
  wallThickness = 26
): WallSegment2D[] {
  const segments: WallSegment2D[] = [];
  const t = wallThickness;

  // Room outer walls with doorway openings carved out
  for (const room of floor.rooms) {
    const openings = getRoomOpenings(room, floor.corridors);

    // North wall (background wall — full height)
    for (const seg of subtractIntervals(room.x - t, room.x + room.w + t, openings.north)) {
      segments.push({
        x: seg.start,
        y: room.y - t,
        w: seg.end - seg.start,
        h: t,
        isForeground: false,
      });
    }

    // South wall (foreground wall — lower parapet height for crystal-clear camera sightline)
    for (const seg of subtractIntervals(room.x - t, room.x + room.w + t, openings.south)) {
      segments.push({
        x: seg.start,
        y: room.y + room.h,
        w: seg.end - seg.start,
        h: t,
        isForeground: true,
      });
    }

    // West wall
    for (const seg of subtractIntervals(room.y, room.y + room.h, openings.west)) {
      segments.push({
        x: room.x - t,
        y: seg.start,
        w: t,
        h: seg.end - seg.start,
        isForeground: false,
      });
    }

    // East wall
    for (const seg of subtractIntervals(room.y, room.y + room.h, openings.east)) {
      segments.push({
        x: room.x + room.w,
        y: seg.start,
        w: t,
        h: seg.end - seg.start,
        isForeground: false,
      });
    }
  }

  // Corridor side walls (strictly spanning the open gap between connected rooms)
  for (const corridor of floor.corridors) {
    const roomA = floor.rooms[corridor.fromRoomId];
    const roomB = floor.rooms[corridor.toRoomId];
    if (!roomA || !roomB) continue;

    if (corridor.horizontal) {
      const leftRoom = roomA.cx < roomB.cx ? roomA : roomB;
      const rightRoom = roomA.cx < roomB.cx ? roomB : roomA;
      const spanStart = leftRoom.x + leftRoom.w;
      const spanEnd = rightRoom.x;
      if (spanEnd > spanStart + 4) {
        // North wall of horizontal corridor
        segments.push({
          x: spanStart,
          y: corridor.rect.y - t,
          w: spanEnd - spanStart,
          h: t,
          isForeground: false,
        });
        // South wall of horizontal corridor
        segments.push({
          x: spanStart,
          y: corridor.rect.y + corridor.rect.h,
          w: spanEnd - spanStart,
          h: t,
          isForeground: true,
        });
      }
    } else {
      const topRoom = roomA.cy < roomB.cy ? roomA : roomB;
      const bottomRoom = roomA.cy < roomB.cy ? roomB : roomA;
      const spanStart = topRoom.y + topRoom.h;
      const spanEnd = bottomRoom.y;
      if (spanEnd > spanStart + 4) {
        // West wall of vertical corridor
        segments.push({
          x: corridor.rect.x - t,
          y: spanStart,
          w: t,
          h: spanEnd - spanStart,
          isForeground: false,
        });
        // East wall of vertical corridor
        segments.push({
          x: corridor.rect.x + corridor.rect.w,
          y: spanStart,
          w: t,
          h: spanEnd - spanStart,
          isForeground: false,
        });
      }
    }
  }

  return segments;
}

/**
 * Returns the doorway rects for a locked combat room so 3D glowing barrier gates can seal it cleanly.
 */
export function getLockedRoomBarrierRects(
  room: DungeonRoom,
  corridors: Corridor[]
): Array<{ rect: Rect; horizontal: boolean }> {
  const openings = getRoomOpenings(room, corridors);
  const barriers: Array<{ rect: Rect; horizontal: boolean }> = [];
  const barThickness = 12;

  for (const iv of openings.north) {
    barriers.push({
      rect: { x: iv.start, y: room.y - barThickness / 2, w: iv.end - iv.start, h: barThickness },
      horizontal: true,
    });
  }
  for (const iv of openings.south) {
    barriers.push({
      rect: { x: iv.start, y: room.y + room.h - barThickness / 2, w: iv.end - iv.start, h: barThickness },
      horizontal: true,
    });
  }
  for (const iv of openings.west) {
    barriers.push({
      rect: { x: room.x - barThickness / 2, y: iv.start, w: barThickness, h: iv.end - iv.start },
      horizontal: false,
    });
  }
  for (const iv of openings.east) {
    barriers.push({
      rect: { x: room.x + room.w - barThickness / 2, y: iv.start, w: barThickness, h: iv.end - iv.start },
      horizontal: false,
    });
  }
  return barriers;
}
