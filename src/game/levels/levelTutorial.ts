import * as THREE from 'three';
import {
  addConsoleInteractable,
  addDestructibleBarricade,
  addDynamicDoor,
  addFloorDecal,
  addLevelExitGate,
  addPerimeterWalls,
  addPickup,
  addPipeConduit,
  addRoomLighting,
  addSaveAndWorkbench,
  addSolidBox,
  addStandardFloor,
  addStructuralArchRibs,
  addWallXWithDoor,
  addWallZWithDoor,
  createLevelContext,
  finalizeLevelWorld,
  LevelBuildContext,
  makeTiledMat,
} from './levelShared';
import { ProceduralTextureSet } from '../textures';
import { BuiltWorld } from '../worldBuilder';

function addRangeTarget(
  ctx: LevelBuildContext,
  id: string,
  x: number,
  z: number,
  textures: ProceduralTextureSet
): void {
  const grp = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    map: textures.metalPlateMap,
    normalMap: textures.metalNormal,
    metalness: 0.72,
    roughness: 0.4,
  });
  const targetFaceMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 0.9,
    roughness: 0.35,
  });
  const bullseyeMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 1.4,
  });

  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.5), frameMat);
  stand.position.y = 0.375;
  stand.castShadow = true;

  const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.22), frameMat);
  board.position.y = 1.32;
  board.castShadow = true;

  const ringOuter = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.84, 0.26), targetFaceMat);
  ringOuter.position.y = 1.32;

  const centerDot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.3), bullseyeMat);
  centerDot.position.y = 1.32;

  grp.add(stand, board, ringOuter, centerDot);
  grp.position.set(x, 0, z);
  ctx.scene.add(grp);

  const colIdx = ctx.colliders.length;
  ctx.colliders.push({
    minX: x - 0.62,
    maxX: x + 0.62,
    minY: 0,
    maxY: 2.0,
    minZ: z - 0.35,
    maxZ: z + 0.35,
    tag: `destructible_${id}`,
  });

  ctx.destructibleBarricades.push({
    id,
    mesh: grp,
    position: new THREE.Vector3(x, 1.3, z),
    colliderIndex: colIdx,
    destroyed: false,
    kind: 'crate',
    health: 40,
    maxHealth: 40,
    minStrength: 1,
  });
}

export function buildTutorialWorld(
  scene: THREE.Scene,
  textures: ProceduralTextureSet
): BuiltWorld {
  const ctx = createLevelContext(scene, textures, 0x05070b, 0x06080c, 0.015);

  const floorMat = makeTiledMat(ctx, {
    map: textures.labTileMap,
    normalMap: textures.labTileNormal,
    roughnessMap: textures.labTileRoughness,
    repeatX: 7,
    repeatY: 22,
    color: 0x333c48,
    roughness: 0.72,
    metalness: 0.35,
  });

  const wallMat = makeTiledMat(ctx, {
    map: textures.metalPlateMap,
    normalMap: textures.metalNormal,
    roughnessMap: textures.metalRoughness,
    repeatX: 6,
    repeatY: 2,
    color: 0x262f3d,
    roughness: 0.56,
    metalness: 0.65,
  });

  const ceilMat = makeTiledMat(ctx, {
    map: textures.metalPlateMap,
    normalMap: textures.metalNormal,
    repeatX: 6,
    repeatY: 18,
    color: 0x161b24,
    roughness: 0.78,
    metalness: 0.55,
  });

  const hazardMat = makeTiledMat(ctx, {
    map: textures.hazardStripeMap,
    normalMap: textures.metalNormal,
    repeatX: 4,
    repeatY: 1,
    roughness: 0.45,
    metalness: 0.42,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x18202c,
    metalness: 0.8,
    roughness: 0.36,
  });
  ctx.disposeables.push(trimMat);

  // Overall Vanguard Training Facility footprint: x = -16..16, z = -76..24
  addStandardFloor(ctx, 34, 102, 0, -26, floorMat, 6.2, ceilMat);
  addPerimeterWalls(ctx, -16, 16, -76, 24, 6.2, wallMat);
  addStructuralArchRibs(ctx, -15.5, 15.5, [18, 8, -16, -24, -40, -56, -68], 6.2, trimMat);

  // Overhead coolant conduits running along the training bays
  addPipeConduit(ctx, -14.8, 5.1, 22, -14.8, 5.1, -74, 0.2, trimMat, hazardMat);
  addPipeConduit(ctx, 14.8, 5.1, 22, 14.8, 5.1, -74, 0.2, trimMat, hazardMat);

  // ---------------------------------------------------------------------------
  // BAY 00: ORIENTATION DECK (z = 24 .. 10)
  // ---------------------------------------------------------------------------
  addWallXWithDoor(ctx, 10, -16, 16, 6.2, 0.9, 0, 6.4, 4.4, wallMat);
  addPickup(
    ctx,
    'tut_lore_1',
    'lore',
    'READ VANGUARD ORIENTATION LOG',
    -3.2,
    0.85,
    16.5,
    0x38bdf8,
    { loreId: 'doc_tutorial_brief' }
  );
  // Podium under lore tablet
  addSolidBox(ctx, -3.2, 0.42, 16.5, 0.9, 0.84, 0.7, trimMat);

  // ---------------------------------------------------------------------------
  // BAY 01: MOBILITY, CROUCH, VAULT & FLASHLIGHT ALCOVE (z = 10 .. -12)
  // ---------------------------------------------------------------------------
  // Partition narrow traversal lane (x = -7..7) so obstacles cannot be walked around
  addWallZWithDoor(ctx, -7, -12, 10, 6.2, 0.8, -6, 3.6, 3.8, wallMat);
  addSolidBox(ctx, 7, 3.1, -1, 0.8, 6.2, 22, wallMat);

  // Low Hazard Overhead Beam at z = 2 (clearance 1.38m -> player MUST crouch [C/CTRL])
  addSolidBox(ctx, 0, 3.69, 2, 13.4, 4.62, 1.3, wallMat, 'crouch_beam');
  const beamTrim = new THREE.Mesh(new THREE.BoxGeometry(13.3, 0.28, 1.38), hazardMat);
  beamTrim.position.set(0, 1.52, 2);
  ctx.scene.add(beamTrim);

  // Vault Barrier at z = -3.8 (height 0.62m -> player MUST jump [SPACE])
  addSolidBox(ctx, 0, 0.31, -3.8, 13.4, 0.62, 0.85, hazardMat, 'jump_vault');

  // Dark West Alcove (x = -16..-7, z = -12..10): unlit pocket for flashlight & battery pickup
  addPickup(
    ctx,
    'tut_bat_1',
    'battery',
    'COLLECT FLASHLIGHT BATTERY (+100%)',
    -12.5,
    0.35,
    -6.0,
    0x38bdf8
  );

  // Bay 01 -> Bay 02 archway
  addWallXWithDoor(ctx, -12, -16, 16, 6.2, 0.9, 0, 7.2, 4.4, wallMat);

  // ---------------------------------------------------------------------------
  // BAY 02: FIRING RANGE & LIVE-FIRE CONTAINMENT CAGE (z = -12 .. -48)
  // ---------------------------------------------------------------------------
  addSaveAndWorkbench(ctx, 'tut', -12.5, -16.5, -12.5, -21.5);

  addPickup(ctx, 'tut_ammo_1', 'ammo', 'RESUPPLY AMMUNITION CRATE', 11.0, 0.25, -16.5, 0xfbbf24);
  addPickup(ctx, 'tut_med_1', 'medkit', 'COLLECT TACTICAL MEDKIT (+35 HP)', 11.0, 0.25, -20.5, 0x22c55e);

  // Firing line low counter (visual cue; low enough to shoot cleanly over)
  addSolidBox(ctx, 0, 0.42, -21.5, 11.5, 0.84, 0.6, trimMat);

  // 3 Shooting Range Targets
  addRangeTarget(ctx, 'tut_target_1', -4.0, -27.5, textures);
  addRangeTarget(ctx, 'tut_target_2', 0.0, -27.5, textures);
  addRangeTarget(ctx, 'tut_target_3', 4.0, -27.5, textures);

  // Range-to-Combat Blast Door (z = -31.5)
  addWallXWithDoor(ctx, -31.5, -16, 16, 6.2, 1.0, 0, 5.2, 4.1, wallMat);
  addDynamicDoor(ctx, 'door_tut_combat', 0, -31.5, 5.0, 4.0, 0.48, 0x1e293b, 0x38bdf8);

  // Live Crawler in Containment Cage (z = -39)
  ctx.enemySpawns.push({
    id: 'tut_crawler_1',
    type: 'crawler',
    position: new THREE.Vector3(0, 0, -40.5),
    patrolTarget: new THREE.Vector3(3.5, 0, -40.5),
    initiallyActive: true,
  });

  // Combat Arena surface decal
  addFloorDecal(ctx, 0, -40.5, 4.8, 4.8, textures.scorchDecalMap, 0.6);

  // ---------------------------------------------------------------------------
  // BAY 03: GENERATOR OVERRIDE & EXTRACTION AIRLOCK (z = -48 .. -76)
  // ---------------------------------------------------------------------------
  addWallXWithDoor(ctx, -48, -16, 16, 6.2, 0.9, 0, 6.4, 4.4, wallMat);

  // Generator Puzzle Console
  addConsoleInteractable(
    ctx,
    'tut_puzzle',
    'puzzle',
    'CALIBRATE EXTRACTION AIRLOCK GENERATOR',
    -4.8,
    -57.5,
    0xf59e0b,
    { puzzleId: 'puz_00_tutorial', doorId: 'door_tut_exit' }
  );

  // Exit Blast Door (z = -62.5)
  addWallXWithDoor(ctx, -62.5, -16, 16, 6.2, 1.0, 0, 5.2, 4.1, wallMat);
  addDynamicDoor(ctx, 'door_tut_exit', 0, -62.5, 5.0, 4.0, 0.48, 0x1e293b, 0x22c55e);

  // Final Extraction Airlock Gate
  addLevelExitGate(
    ctx,
    'tut_exit',
    'ENTER EXTRACTION AIRLOCK TO COMPLETE ORIENTATION',
    0,
    -72.5,
    0
  );

  // Crisp Tactical Lighting (Notice: West Dark Alcove intentionally left dark for Flashlight drill!)
  addRoomLighting(ctx, [
    [0, 5.4, 17.5, 0x93c5fd, false],
    [0, 5.4, 6.0, 0xfbbf24, false],
    [0, 5.4, -7.5, 0xfbbf24, false],
    [0, 5.4, -18.5, 0x38bdf8, false],
    [0, 5.4, -27.5, 0xf87171, false],
    [0, 5.4, -40.5, 0xef4444, true],
    [0, 5.4, -55.5, 0xf59e0b, false],
    [0, 5.4, -68.5, 0x4ade80, false],
  ]);

  // Surface zones for authentic metal/industrial audio feedback
  ctx.surfaceZones.push(
    { minX: -16, maxX: 16, minZ: -76, maxZ: -48, surface: 'metal' },
    { minX: -16, maxX: 16, minZ: -48, maxZ: 24, surface: 'industrial' }
  );

  return finalizeLevelWorld(ctx, new THREE.Vector3(0, 0.05, 19.5), 0);
}
