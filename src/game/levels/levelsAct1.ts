import * as THREE from 'three';
import { ProceduralTextureSet } from '../textures';
import {
  buildInfectedVehicle,
  buildRealisticSkyscraper,
  BuiltWorld,
  createSkyscraperMaterials,
} from '../worldBuilder';
import {
  addClimbingVines,
  addConsoleInteractable,
  addDestructibleBarricade,
  addDetailedPillar,
  addDynamicDoor,
  addFireSpot,
  addFloorDecal,
  addHoloAdPylon,
  addInstancedGrassTufts,
  addLevelExitGate,
  addMeteorCrater,
  addPerimeterWalls,
  addPickup,
  addPipeConduit,
  addRoadsideTree,
  addRoomLighting,
  addSaveAndWorkbench,
  addSolidBox,
  addStandardFloor,
  addStructuralArchRibs,
  addVolumetricCone,
  addWallXWithDoor,
  addWallZWithDoor,
  createLevelContext,
  finalizeLevelWorld,
  makeTiledMat,
} from './levelShared';

// ============================================================================
// LEVEL 02 — THE UNDERGROUND (Underground Military Tunnels + THE CRAWLER)
// ============================================================================
export function buildLevel2World(
  scene: THREE.Scene,
  textures: ProceduralTextureSet
): BuiltWorld {
  const ctx = createLevelContext(scene, textures, 0x040507, 0x07080d, 0.028);

  const floorMat = makeTiledMat(ctx, {
    map: textures.concreteMap,
    normalMap: textures.concreteNormal,
    roughnessMap: textures.concreteRoughness,
    repeatX: 12,
    repeatY: 26,
    color: 0x525866,
    roughness: 0.88,
    metalness: 0.22,
    normalScale: 1.45,
  });
  const grateRunnerMat = makeTiledMat(ctx, {
    map: textures.grateMap,
    normalMap: textures.grateNormal,
    roughnessMap: textures.grateRoughness,
    metalnessMap: textures.grateMetalness,
    repeatX: 2,
    repeatY: 28,
    roughness: 0.48,
    metalness: 0.82,
    normalScale: 1.4,
  });
  const wallMat = makeTiledMat(ctx, {
    map: textures.concreteMap,
    normalMap: textures.concreteNormal,
    roughnessMap: textures.concreteRoughness,
    repeatX: 6,
    repeatY: 2,
    color: 0x3b4252,
    roughness: 0.82,
    metalness: 0.3,
    normalScale: 1.35,
  });
  const pipeMat = makeTiledMat(ctx, {
    map: textures.metalPlateMap,
    normalMap: textures.metalNormal,
    repeatX: 2,
    repeatY: 8,
    color: 0x334155,
    metalness: 0.84,
    roughness: 0.36,
  });
  const trimSteel = makeTiledMat(ctx, {
    map: textures.metalPlateMap,
    normalMap: textures.metalNormal,
    repeatX: 1,
    repeatY: 2,
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.38,
  });

  addStandardFloor(ctx, 56, 120, 0, -34, floorMat, 6.2, wallMat);
  // Central recessed diamond-grate catwalk strip running down the tunnel spine
  const spineGrate = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 112), grateRunnerMat);
  spineGrate.rotation.x = -Math.PI / 2;
  spineGrate.position.set(0, 0.015, -34);
  spineGrate.receiveShadow = true;
  scene.add(spineGrate);

  addPerimeterWalls(ctx, -26, 26, -92, 22, 6.2, wallMat);
  addStructuralArchRibs(ctx, -25.4, 25.4, [12, -10, -24, -42, -56, -74], 6.2, trimSteel, wallMat);

  // Interconnected underground rooms with physical 5m wide doorways
  addWallXWithDoor(ctx, 2, -26, 26, 6.2, 1.0, 0, 5.5, 4.0, wallMat);
  addWallZWithDoor(ctx, -9, -32, 2, 6.2, 1.0, -14, 5.0, 3.8, wallMat); // West Vent Bay
  addWallZWithDoor(ctx, 9, -32, 2, 6.2, 1.0, -14, 5.0, 3.8, wallMat); // East Maintenance Room
  addWallXWithDoor(ctx, -32, -26, 26, 6.2, 1.0, 0, 6.0, 4.2, wallMat);
  addWallXWithDoor(ctx, -62, -26, 26, 6.2, 1.0, 0, 5.0, 3.8, wallMat);
  addDynamicDoor(ctx, 'door_l2_exit', 0, -62, 5.0, 3.8, 0.55, 0x1e293b, 0xef4444);

  // Overhead flanged industrial ducts & lateral coolant conduits
  [-12, 0, 12].forEach((px) => {
    const duct = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 108), pipeMat);
    duct.position.set(px, 5.4, -34);
    duct.castShadow = true;
    scene.add(duct);
  });
  addPipeConduit(ctx, -24.5, 4.3, 18, -24.5, 4.3, -86, 0.28, pipeMat, trimSteel);
  addPipeConduit(ctx, 24.5, 4.3, 18, 24.5, 4.3, -86, 0.28, pipeMat, trimSteel);

  // Rotating Industrial Ventilation Turbine Fan in West Vent Bay
  const fanGroup = new THREE.Group();
  const fanHousing = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.24, 8, 20), trimSteel);
  const fanHub = new THREE.Group();
  const hubCore = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.4, 10), pipeMat);
  hubCore.rotation.x = Math.PI / 2;
  fanHub.add(hubCore);
  for (let b = 0; b < 5; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.45, 0.08), trimSteel);
    const ang = (b / 5) * Math.PI * 2;
    blade.position.set(Math.cos(ang) * 0.8, Math.sin(ang) * 0.8, 0);
    blade.rotation.z = ang + Math.PI / 2;
    blade.rotation.y = 0.35;
    fanHub.add(blade);
  }
  fanGroup.add(fanHousing, fanHub);
  fanGroup.position.set(-25.1, 2.8, -6);
  fanGroup.rotation.y = Math.PI / 2;
  scene.add(fanGroup);
  ctx.animatedProps.push({ kind: 'spinY', object: fanHub, speed: 2.6 });

  // Collapsed concrete rubble piles & military steel crates (stay clear of doorways)
  [
    [-18, -8, 2.8, 1.5, 2.4],
    [17, -22, 2.6, 1.4, 2.2],
    [-12, -46, 3.2, 1.8, 2.6],
    [11, -50, 3.0, 1.6, 2.5],
  ].forEach(([rx, rz, w, h, d]) => {
    addDetailedPillar(ctx, rx, rz, w, h, d, wallMat, trimSteel);
  });

  // Floor blood/oil/scorch & damp natural green moss storytelling decals
  addFloorDecal(ctx, -15, -16, 4.2, 4.2, textures.bloodDecalMap, 0.78, 0.4);
  addFloorDecal(ctx, 0, -45, 5.5, 5.5, textures.scorchDecalMap, 0.82, -0.3);
  addFloorDecal(ctx, 17, -14, 3.6, 3.6, textures.bloodDecalMap, 0.65, 1.2);
  addFloorDecal(ctx, -21, 14, 4.4, 4.4, textures.mossDecalMap, 0.8, 0.2);
  addFloorDecal(ctx, 21, -28, 4.2, 4.2, textures.mossDecalMap, 0.78, -0.5);
  addInstancedGrassTufts(
    ctx,
    [
      { x: -22, y: 0.01, z: 16, spread: 2.0, count: 12 },
      { x: 22, y: 0.01, z: 14, spread: 1.8, count: 10 },
    ],
    22
  );

  // Secret Vault Room behind destructible vent grate on East flank (z: -48..-36)
  addSolidBox(ctx, 17, 3.1, -36, 16, 6.2, 0.8, wallMat);
  addSolidBox(ctx, 17, 3.1, -50, 16, 6.2, 0.8, wallMat);
  addDestructibleBarricade(ctx, 'l2_secret_grate', 10.5, -43, 0.65, 2.2, 4.0, 0xb45309);
  addPickup(ctx, 'sec_02_stash', 'secret_cache', 'CLAIM TUNNEL SUPPLY STASH (+2 SALVAGE)', 21, 0.45, -43, 0xf59e0b, {
    secretId: 'sec_02_vault',
    secretTitle: 'COLLAPSED MAINTENANCE VAULT',
  });

  // Objectives
  addConsoleInteractable(ctx, 'l2_vent_valve', 'vent_valve', 'RESTORE VENTILATION TURBINE B-2', -20, -6, 0x38bdf8);
  addConsoleInteractable(
    ctx,
    'l2_elec_puzzle',
    'puzzle',
    'CALIBRATE ELECTRICAL RELAY (MATH PUZZLE)',
    -20,
    -24,
    0xf59e0b,
    { puzzleId: 'puz_02_elec', doorId: 'door_l2_exit' }
  );
  addPickup(ctx, 'l2_maint_key', 'keycard', 'TAKE MAINTENANCE ACCESS KEY', 20, 0.8, -8, 0x38bdf8);
  addConsoleInteractable(
    ctx,
    'l2_blast_panel',
    'gate_panel',
    'UNLOCK RESEARCH COMPLEX BLAST DOOR',
    -4.5,
    -60.5,
    0x22c55e,
    { doorId: 'door_l2_exit' }
  );

  addSaveAndWorkbench(ctx, 'l2', 17, -24, 17, -18);
  addLevelExitGate(ctx, 'l2_exit', 'ENTER PROJECT GENESIS LAB (LEVEL 03)', 0, -88, 2);

  // Lore & Supplies
  addPickup(ctx, 'l2_lore_1', 'lore', 'READ SUB-LEVEL VENTILATION LOG', -4, 0.5, 10, 0x60a5fa, {
    loreId: 'doc_tunnel_collapse',
  });
  addPickup(ctx, 'l2_lore_2', 'lore', 'PLAY MAINTENANCE SHAFT AUDIO LOG', -15, 0.5, -16, 0xf87171, {
    loreId: 'audio_crawler_ambush',
  });
  addPickup(ctx, 'l2_lore_3', 'lore', 'READ SCRATCHED TUNNEL WALL NOTE', 19, 0.5, -45, 0x60a5fa, {
    loreId: 'doc_choir_scribble',
  });
  addPickup(ctx, 'l2_med_1', 'medkit', 'COLLECT MEDKIT (+35 HP)', 4, 0.35, -18, 0x22c55e);
  addPickup(ctx, 'l2_ammo_1', 'ammo', 'COLLECT AMMO CRATE', -4, 0.35, -40, 0xf59e0b);
  addPickup(ctx, 'l2_bat_1', 'battery', 'COLLECT FLASHLIGHT CELL', 5, 0.35, -54, 0x38bdf8);

  addRoomLighting(ctx, [
    [0, 5.4, 14, 0xef4444, true],
    [-16, 5.4, -14, 0x38bdf8, false],
    [16, 5.4, -14, 0xf59e0b, false],
    [0, 5.4, -46, 0xef4444, true],
    [0, 5.4, -76, 0x22c55e, false],
  ]);
  addFireSpot(ctx, 'l2_fire_1', -12, 0.2, -38, 0.9);

  ctx.enemySpawns.push(
    { id: 'l2_crawler_1', type: 'crawler', position: new THREE.Vector3(0, 0, -10), patrolTarget: new THREE.Vector3(0, 0, -24), initiallyActive: true },
    { id: 'l2_crawler_2', type: 'crawler', position: new THREE.Vector3(-16, 0, -18), patrolTarget: new THREE.Vector3(-14, 0, -8), initiallyActive: true },
    { id: 'l2_crawler_3', type: 'crawler', position: new THREE.Vector3(16, 0, -12), patrolTarget: new THREE.Vector3(14, 0, -24), initiallyActive: true },
    { id: 'l2_screamer_1', type: 'screamer', position: new THREE.Vector3(-5, 0, -44), patrolTarget: new THREE.Vector3(5, 0, -48), initiallyActive: true },
    { id: 'l2_stalker_1', type: 'stalker', position: new THREE.Vector3(0, 0, -54), patrolTarget: new THREE.Vector3(-6, 0, -40), initiallyActive: true },
    { id: 'l2_crawler_4', type: 'crawler', position: new THREE.Vector3(-8, 0, -72), patrolTarget: new THREE.Vector3(8, 0, -76), initiallyActive: true },
    { id: 'l2_scrapper_1', type: 'scrapper', position: new THREE.Vector3(4, 0, -78), patrolTarget: new THREE.Vector3(-4, 0, -72), initiallyActive: true }
  );

  return finalizeLevelWorld(ctx, new THREE.Vector3(0, 0, 17), 0);
}

// ============================================================================
// LEVEL 03 — PROJECT GENESIS (Abandoned Research Lab + THE WATCHER)
// ============================================================================
export function buildLevel3World(
  scene: THREE.Scene,
  textures: ProceduralTextureSet
): BuiltWorld {
  const ctx = createLevelContext(scene, textures, 0x03070b, 0x061018, 0.022);

  const labFloor = makeTiledMat(ctx, {
    map: textures.labTileMap,
    normalMap: textures.labTileNormal,
    roughnessMap: textures.labTileRoughness,
    repeatX: 15,
    repeatY: 30,
    color: 0x94a3b8,
    metalness: 0.38,
    roughness: 0.34,
    normalScale: 1.3,
  });
  const labWall = makeTiledMat(ctx, {
    map: textures.labTileMap,
    normalMap: textures.labTileNormal,
    roughnessMap: textures.labTileRoughness,
    repeatX: 7,
    repeatY: 2,
    color: 0xcbd5e1,
    metalness: 0.32,
    roughness: 0.44,
    normalScale: 1.15,
  });
  const frameSteel = makeTiledMat(ctx, {
    map: textures.metalPlateMap,
    normalMap: textures.metalNormal,
    repeatX: 2,
    repeatY: 2,
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.32,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.32,
    roughness: 0.08,
    metalness: 0.12,
  });
  ctx.disposeables.push(glassMat);

  addStandardFloor(ctx, 60, 122, 0, -35, labFloor, 6.8, labWall);
  addPerimeterWalls(ctx, -28, 28, -94, 22, 6.8, labWall);
  addStructuralArchRibs(ctx, -27.4, 27.4, [14, -8, -22, -40, -56, -78], 6.8, frameSteel, labWall);

  // Overhead cryogenic supply lines feeding central containment hall
  addPipeConduit(ctx, -16, 5.8, -32, -16, 5.8, -64, 0.22, frameSteel);
  addPipeConduit(ctx, 16, 5.8, -32, 16, 5.8, -64, 0.22, frameSteel);

  // Lab layout: Reception -> Wing A/B -> Central Containment Hall -> Sealed Central Lab
  addWallXWithDoor(ctx, 4, -28, 28, 6.8, 0.9, 0, 5.5, 4.0, labWall);
  addWallZWithDoor(ctx, -10, -34, 4, 6.8, 0.9, -15, 5.0, 3.8, labWall);
  addWallZWithDoor(ctx, 10, -34, 4, 6.8, 0.9, -15, 5.0, 3.8, labWall);
  addWallXWithDoor(ctx, -34, -28, 28, 6.8, 0.9, 0, 6.2, 4.2, labWall);
  addWallXWithDoor(ctx, -66, -28, 28, 6.8, 0.9, 0, 5.2, 4.0, labWall);
  addDynamicDoor(ctx, 'door_l3_lab', 0, -66, 5.2, 4.0, 0.55, 0x0f172a, 0x38bdf8);

  // Multi-Part Cryo Containment Chambers in Central Hall (center tube shattered!)
  [
    [-16, -48, false],
    [16, -48, false],
    [0, -50, true], // Shattered containment cylinder where The Watcher escaped!
  ].forEach(([cx, cz, broken]) => {
    const px = cx as number;
    const pz = cz as number;
    const isBroken = broken as boolean;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.35, 0.65, 16), frameSteel);
    base.position.set(px, 0.325, pz);
    base.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.0, 0.7, 16), frameSteel);
    cap.position.set(px, 5.55, pz);
    const fluidRing = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.55, isBroken ? 0.14 : 4.2, 14),
      new THREE.MeshStandardMaterial({
        color: isBroken ? 0xef4444 : 0x0ea5e9,
        emissive: isBroken ? 0x991b1b : 0x0284c7,
        emissiveIntensity: isBroken ? 0.9 : 1.1,
        transparent: true,
        opacity: isBroken ? 0.55 : 0.28,
        roughness: 0.15,
      })
    );
    fluidRing.position.set(px, isBroken ? 0.72 : 2.75, pz);
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(1.78, 1.78, 4.8, 16, 1, true, 0, isBroken ? Math.PI * 1.15 : Math.PI * 2),
      glassMat
    );
    tube.position.set(px, 3.0, pz);
    // Vertical steel support stanchions around cylinder
    for (let s = 0; s < 4; s++) {
      const ang = (s / 4) * Math.PI * 2 + Math.PI / 4;
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.8, 0.18), frameSteel);
      strut.position.set(px + Math.cos(ang) * 1.92, 3.0, pz + Math.sin(ang) * 1.92);
      scene.add(strut);
    }
    scene.add(base, cap, fluidRing, tube);
    if (isBroken) {
      addFloorDecal(ctx, px, pz + 1.8, 5.2, 5.2, textures.bloodDecalMap, 0.85, 0.5);
    }
    ctx.colliders.push({
      minX: px - 1.95,
      maxX: px + 1.95,
      minY: 0,
      maxY: 5.8,
      minZ: pz - 1.95,
      maxZ: pz + 1.95,
    });
  });

  // Floor blood & scorch decals along reception & wings
  addFloorDecal(ctx, -18, -18, 3.8, 3.8, textures.bloodDecalMap, 0.72, -0.4);
  addFloorDecal(ctx, 18, -14, 3.2, 3.2, textures.scorchDecalMap, 0.68, 0.8);

  // Secret Bio-Archive behind destructible glass partition on West Wing
  addSolidBox(ctx, -20, 3.4, -36, 15, 6.8, 0.8, labWall);
  addSolidBox(ctx, -20, 3.4, -58, 15, 6.8, 0.8, labWall);
  addDestructibleBarricade(ctx, 'l3_secret_glass', -13, -42, 0.6, 2.4, 4.2, 0x0284c7);
  addPickup(ctx, 'sec_03_cache', 'secret_cache', 'CLAIM BIO-VAULT SALVAGE (+2 SALVAGE)', -22, 0.5, -47, 0xf59e0b, {
    secretId: 'sec_03_lab',
    secretTitle: 'SEALED SPECIMEN ARCHIVE',
  });

  // 3 Research Drives + Lab Cipher Puzzle
  addPickup(ctx, 'l3_drive_1', 'research_drive', 'RECOVER RESEARCH DRIVE 01 (BIO-LAB)', -20, 0.9, -12, 0x38bdf8);
  addPickup(ctx, 'l3_drive_2', 'research_drive', 'RECOVER RESEARCH DRIVE 02 (CRYO BAY)', 20, 0.9, -18, 0x38bdf8);
  addPickup(ctx, 'l3_drive_3', 'research_drive', 'RECOVER RESEARCH DRIVE 03 (CONTAINMENT)', 0, 0.9, -44, 0xef4444);

  addConsoleInteractable(
    ctx,
    'l3_lab_puzzle',
    'puzzle',
    'SOLVE CENTRAL LAB CIPHER TO UNLOCK CORE',
    -5.2,
    -64.2,
    0xf59e0b,
    { puzzleId: 'puz_03_lab', doorId: 'door_l3_lab' }
  );

  addSaveAndWorkbench(ctx, 'l3', 18, -6, 18, -26);
  addLevelExitGate(ctx, 'l3_exit', 'ASCEND TO THE DEAD CITY (LEVEL 04)', 0, -90, 2);

  addPickup(ctx, 'l3_lore_1', 'lore', 'READ METALLIC NECROSIS STUDY', -18, 0.6, -24, 0x60a5fa, {
    loreId: 'doc_archivist_note',
  });
  addPickup(ctx, 'l3_lore_2', 'lore', 'READ SPECIMEN 07: THE WATCHER', 18, 0.6, -12, 0x60a5fa, {
    loreId: 'doc_watcher_protocol',
  });
  addPickup(ctx, 'l3_lore_3', 'lore', 'PLAY CONTAINMENT BREACH AUDIO', -3, 0.6, -72, 0xf87171, {
    loreId: 'audio_sentinel_blackbox',
  });
  addPickup(ctx, 'l3_med_1', 'medkit', 'COLLECT LAB TRAUMA KIT (+35 HP)', 0, 0.35, -18, 0x22c55e);
  addPickup(ctx, 'l3_ammo_1', 'ammo', 'COLLECT AMMO CACHE', -18, 0.35, -4, 0xf59e0b);
  addPickup(ctx, 'l3_bat_1', 'battery', 'COLLECT REACTOR CELL', 16, 0.35, -46, 0x38bdf8);

  addRoomLighting(ctx, [
    [0, 6.0, 14, 0x38bdf8, false],
    [-19, 6.0, -15, 0x0ea5e9, true],
    [19, 6.0, -15, 0x38bdf8, false],
    [0, 6.0, -50, 0xef4444, true],
    [0, 6.0, -78, 0x22c55e, false],
  ]);

  ctx.enemySpawns.push(
    { id: 'l3_watcher_1', type: 'watcher', position: new THREE.Vector3(-18, 0, -18), patrolTarget: new THREE.Vector3(-18, 0, -4), initiallyActive: true },
    { id: 'l3_crawler_1', type: 'crawler', position: new THREE.Vector3(18, 0, -16), patrolTarget: new THREE.Vector3(14, 0, -6), initiallyActive: true },
    { id: 'l3_watcher_2', type: 'watcher', position: new THREE.Vector3(0, 0, -56), patrolTarget: new THREE.Vector3(-8, 0, -44), initiallyActive: true },
    { id: 'l3_ambush_watcher', type: 'watcher', position: new THREE.Vector3(10, 0, -56), patrolTarget: new THREE.Vector3(0, 0, -44), initiallyActive: false, ambushTag: 'genesis_breach' },
    { id: 'l3_ambush_scrapper', type: 'scrapper', position: new THREE.Vector3(-10, 0, -56), patrolTarget: new THREE.Vector3(0, 0, -44), initiallyActive: false, ambushTag: 'genesis_breach' },
    { id: 'l3_sentinel_1', type: 'sentinel', position: new THREE.Vector3(0, 0, -78), patrolTarget: new THREE.Vector3(6, 0, -72), initiallyActive: true }
  );

  return finalizeLevelWorld(ctx, new THREE.Vector3(0, 0, 17), 0);
}

// ============================================================================
// LEVEL 04 — THE DEAD CITY (Megacity Ruins + Mall + Parking + THE HUNTER)
// ============================================================================
export function buildLevel4World(
  scene: THREE.Scene,
  textures: ProceduralTextureSet
): BuiltWorld {
  const ctx = createLevelContext(scene, textures, 0x050609, 0x090a10, 0.017);

  const roadMat = makeTiledMat(ctx, {
    map: textures.asphaltMap,
    normalMap: textures.asphaltNormal,
    roughnessMap: textures.asphaltRoughness,
    repeatX: 16,
    repeatY: 32,
    roughness: 0.9,
    metalness: 0.2,
    normalScale: 1.4,
  });
  const concreteMat = makeTiledMat(ctx, {
    map: textures.concreteMap,
    normalMap: textures.concreteNormal,
    roughnessMap: textures.concreteRoughness,
    repeatX: 6,
    repeatY: 6,
    roughness: 0.85,
    metalness: 0.22,
    normalScale: 1.3,
  });
  const steelMat = makeTiledMat(ctx, {
    map: textures.metalPlateMap,
    normalMap: textures.metalNormal,
    repeatX: 2,
    repeatY: 2,
    color: 0x334155,
    metalness: 0.82,
    roughness: 0.4,
  });

  // Extended dark horizon city apron
  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 320),
    new THREE.MeshStandardMaterial({ color: 0x080a0f, roughness: 0.95 })
  );
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.y = -0.06;
  scene.add(horizon);

  addStandardFloor(ctx, 76, 134, 0, -38, roadMat);
  // Concrete street curbs flanking central Dead City avenue
  [-11.5, 11.5].forEach((cx) => {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 128), concreteMat);
    curb.position.set(cx, 0.08, -38);
    curb.receiveShadow = true;
    scene.add(curb);
  });

  // Invisible/steel perimeter safety walls at edge of playable avenue while showcasing towering skyscrapers beyond
  addPerimeterWalls(ctx, -35, 35, -100, 24, 4.5, concreteMat);

  // Real Photorealistic Ruined Brutalist Skyscrapers framing the Dead City skyline
  const skyMats = createSkyscraperMaterials(textures);
  const towers: [number, number, number, number, number, boolean, boolean][] = [
    [-46, 12, 20, 48, 22, false, true],
    [-46, -24, 22, 62, 24, true, false],
    [-46, -64, 20, 56, 22, true, true],
    [-46, -96, 22, 68, 24, false, false],
    [46, 14, 20, 44, 22, true, false],
    [46, -26, 22, 58, 24, false, true],
    [46, -66, 20, 52, 22, true, false],
    [46, -98, 22, 64, 24, true, true],
    [-22, -122, 24, 72, 20, true, false],
    [22, -124, 24, 78, 20, false, true],
  ];
  towers.forEach(([bx, bz, bw, bh, bd, inf, burn], idx) => {
    const sky = buildRealisticSkyscraper(skyMats, bw, bh, bd, idx + 40, inf, {
      burning: burn,
      worldX: bx,
      worldY: -0.1,
      worldZ: bz,
      facingSignX: bx < 0 ? 1 : -1,
      fireEmitters: ctx.fireEmitters,
      scene,
      withLight: burn && idx % 3 === 0,
    });
    sky.position.set(bx, -0.1, bz);
    scene.add(sky);
  });

  // Collapsed Highway Overpass Span across middle boulevard with girder trusses
  const deck = new THREE.Mesh(new THREE.BoxGeometry(46, 1.3, 7.8), concreteMat);
  deck.position.set(0, 8.4, -22);
  deck.rotation.z = -0.05;
  deck.castShadow = true;
  deck.receiveShadow = true;
  const deckBeam = new THREE.Mesh(new THREE.BoxGeometry(46, 0.55, 1.1), steelMat);
  deckBeam.position.set(0, 7.6, -18.5);
  deckBeam.rotation.z = -0.05;
  scene.add(deck, deckBeam);
  addDetailedPillar(ctx, -17, -22, 2.4, 8.4, 3.2, concreteMat, steelMat);
  addDetailedPillar(ctx, 17, -22, 2.4, 8.4, 3.2, concreteMat, steelMat);

  // Shopping Concourse Wing (East) & Underground Garage Pillars (West)
  addWallZWithDoor(ctx, 11, -50, -4, 5.5, 0.9, -28, 6.5, 4.2, concreteMat);
  addWallZWithDoor(ctx, -11, -58, -10, 5.5, 0.9, -34, 7.0, 4.2, concreteMat);

  // Toll Booth Secret Alcove on West Parking Deck
  addSolidBox(ctx, -22, 2.2, -48, 8, 4.4, 0.8, concreteMat);
  addDestructibleBarricade(ctx, 'l4_secret_toll', -17, -43, 0.7, 1.8, 3.8, 0xb45309);
  addPickup(ctx, 'sec_04_stash', 'secret_cache', 'CLAIM PARKING TOLL CACHE (+2 SALVAGE)', -23, 0.5, -42, 0xf59e0b, {
    secretId: 'sec_04_garage',
    secretTitle: 'GARAGE TOLL VAULT',
  });

  // Real Sculpted Infected & Wrecked Sedans replacing plain slab boxes
  const carDefs: [number, number, number, boolean][] = [
    [-5, 8, 0.28, true],
    [6, -6, -0.45, false],
    [-4, -52, 2.65, true],
    [7, -64, -2.4, true],
  ];
  carDefs.forEach(([cx, cz, rotY, infected]) => {
    const car = buildInfectedVehicle(textures, cx, cz, rotY, infected);
    scene.add(car);
    ctx.colliders.push({
      minX: cx - 1.35,
      maxX: cx + 1.35,
      minY: 0,
      maxY: 1.75,
      minZ: cz - 2.25,
      maxZ: cz + 2.25,
    });
    addFloorDecal(ctx, cx, cz, 5.5, 5.5, textures.scorchDecalMap, 0.78, rotY);
  });

  // Urban Streetlamps with volumetric sodium/emergency light cones along avenue
  [
    [-10.2, 6, 0xf59e0b],
    [10.2, -16, 0x38bdf8],
    [-10.2, -44, 0xef4444],
    [10.2, -72, 0xf59e0b],
  ].forEach(([lx, lz, col]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7.6, 8), steelMat);
    pole.position.set(lx as number, 3.8, lz as number);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.18), steelMat);
    const sign = (lx as number) < 0 ? 1 : -1;
    arm.position.set((lx as number) + sign * 1.0, 7.5, lz as number);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.16, 0.36),
      new THREE.MeshBasicMaterial({ color: col })
    );
    head.position.set((lx as number) + sign * 1.8, 7.35, lz as number);
    scene.add(pole, arm, head);
    addVolumetricCone(ctx, (lx as number) + sign * 1.8, 7.3, lz as number, col as number, 3.0, 6.8, 0.045);
  });

  // Part 1: Secondary Meteor Impact Crater, 3059 Holo Ad Pylons & Healthy Reclaiming Flora
  addMeteorCrater(ctx, -24, -12, 3.2, 'l4_lot');
  addHoloAdPylon(ctx, -12.2, 12, 0.55, 0x38bdf8);
  addHoloAdPylon(ctx, 12.2, -10, -0.65, 0xf59e0b);
  addHoloAdPylon(ctx, -12.2, -56, 0.45, 0x38bdf8);

  addRoadsideTree(ctx, -26, 12, 1.15, true);
  addRoadsideTree(ctx, 26, 10, 1.1, true);
  addRoadsideTree(ctx, -28, -68, 1.12, true);
  addRoadsideTree(ctx, 28, -62, 1.08, true);

  addClimbingVines(ctx, -15.7, 0.2, -22, 2.4, 7.8, 'x', 1, 14);
  addClimbingVines(ctx, 15.7, 0.2, -22, 2.4, 7.8, 'x', -1, 15);
  addClimbingVines(ctx, 10.4, 0.2, -16, 4.2, 4.8, 'x', -1, 16);

  addFloorDecal(ctx, -26, 12, 5.5, 5.5, textures.mossDecalMap, 0.82, 0.2);
  addFloorDecal(ctx, 26, 10, 5.5, 5.5, textures.mossDecalMap, 0.82, -0.4);
  addFloorDecal(ctx, -11.5, -42, 4.5, 4.5, textures.mossDecalMap, 0.78, 0.6);

  addInstancedGrassTufts(
    ctx,
    [
      { x: -11.5, y: 0.14, z: 12, spread: 1.8, count: 16 },
      { x: 11.5, y: 0.14, z: 4, spread: 1.8, count: 16 },
      { x: -5, y: 0.01, z: 8, spread: 2.8, count: 18 },
      { x: 6, y: 0.01, z: -6, spread: 2.8, count: 18 },
      { x: -4, y: 0.01, z: -52, spread: 2.8, count: 18 },
      { x: 7, y: 0.01, z: -64, spread: 2.8, count: 18 },
      { x: -26, y: 0.01, z: 12, spread: 2.0, count: 18 },
      { x: 26, y: 0.01, z: 10, spread: 2.0, count: 18 },
      { x: -28, y: 0.01, z: -68, spread: 2.0, count: 18 },
      { x: 28, y: 0.01, z: -62, spread: 2.0, count: 18 },
      { x: -11.5, y: 0.14, z: -48, spread: 1.8, count: 16 },
      { x: 11.5, y: 0.14, z: -58, spread: 1.8, count: 16 },
    ],
    44
  );

  // Objectives
  addConsoleInteractable(ctx, 'l4_transport', 'transport_console', 'SECURE MILITARY EVACUATION TRANSPORT', -20, -68, 0x38bdf8);
  addConsoleInteractable(
    ctx,
    'l4_comms_tower',
    'puzzle',
    'ACTIVATE EMERGENCY COMMS TOWER (MATH PUZZLE)',
    18,
    -74,
    0xf59e0b,
    { puzzleId: 'puz_04_comms' }
  );

  addSaveAndWorkbench(ctx, 'l4', 18, -16, 18, -36);
  addLevelExitGate(ctx, 'l4_exit', 'DEPART FOR THE IRON FACTORY (LEVEL 05)', 0, -96, 2);

  addPickup(ctx, 'l4_lore_1', 'lore', 'READ TRANSIT ADVISORY', 4, 0.5, 12, 0x60a5fa, {
    loreId: 'doc_deadcity_grid',
  });
  addPickup(ctx, 'l4_lore_2', 'lore', 'PLAY MALL BEACON AUDIO LOG', 19, 0.5, -26, 0xf87171, {
    loreId: 'audio_deadcity_scout',
  });
  addPickup(ctx, 'l4_lore_3', 'lore', 'READ PARKING DECK LEDGER', -20, 0.5, -36, 0x60a5fa, {
    loreId: 'doc_deadcity_garage',
  });
  addPickup(ctx, 'l4_med_1', 'medkit', 'COLLECT MEDKIT (+35 HP)', 16, 0.35, -42, 0x22c55e);
  addPickup(ctx, 'l4_ammo_1', 'ammo', 'COLLECT HEAVY AMMO CRATE', -16, 0.35, -28, 0xf59e0b);
  addPickup(ctx, 'l4_bat_1', 'battery', 'COLLECT OPTIC BATTERY', 0, 0.35, -60, 0x38bdf8);

  addRoomLighting(ctx, [
    [0, 7, 10, 0xef4444, true],
    [18, 5, -28, 0x38bdf8, false],
    [-19, 5, -34, 0xf59e0b, true],
    [0, 8, -74, 0xef4444, true],
  ]);
  addFireSpot(ctx, 'l4_fire_1', -5, 1.0, 8, 1.1);
  addFireSpot(ctx, 'l4_fire_2', 7, 1.0, -64, 1.2);

  ctx.enemySpawns.push(
    { id: 'l4_stalker_1', type: 'stalker', position: new THREE.Vector3(-4, 0, -8), patrolTarget: new THREE.Vector3(6, 0, -14), initiallyActive: true },
    { id: 'l4_hunter_1', type: 'hunter', position: new THREE.Vector3(-20, 0, -28), patrolTarget: new THREE.Vector3(-18, 0, -52), initiallyActive: true },
    { id: 'l4_screamer_1', type: 'screamer', position: new THREE.Vector3(19, 0, -22), patrolTarget: new THREE.Vector3(16, 0, -40), initiallyActive: true },
    { id: 'l4_scrapper_1', type: 'scrapper', position: new THREE.Vector3(4, 0, -48), patrolTarget: new THREE.Vector3(-6, 0, -44), initiallyActive: true },
    { id: 'l4_hunter_2', type: 'hunter', position: new THREE.Vector3(10, 0, -78), patrolTarget: new THREE.Vector3(-12, 0, -78), initiallyActive: true }
  );

  return finalizeLevelWorld(ctx, new THREE.Vector3(0, 0, 19), 0);
}
