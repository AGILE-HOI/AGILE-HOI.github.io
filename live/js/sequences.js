// sequences.js — DATA MANIFEST (single source of truth for AGILE · Live)
// All paths are relative to live/index.html.

const RESULTS = '../static/results';
const VIDEOS = '../static/videos';

// ---------------------------------------------------------------------------
// Interactive 3D reconstructions.
// Each has a full asset set: object_mesh_scaled.glb, object_poses.json,
// cam_K.json, hand_meshes/hand_XXXX.glb, rgb_images/frame_XXXX.png.
// Objects identified from the source frames (YCB objects, HO3D-v3).
// ---------------------------------------------------------------------------
export const SEQUENCES = [
  {
    id: 'MDF12',
    title: 'Power Drill',
    object: 'Power drill',
    dataset: 'HO3D-v3',
    numFrames: 120,
    dir: `${RESULTS}/MDF12`,
    thumbnail: `${RESULTS}/MDF12/thumbnail.png`,
  },
  {
    id: 'SM2',
    title: 'Mustard Bottle',
    object: 'Mustard bottle',
    dataset: 'HO3D-v3',
    numFrames: 180,
    dir: `${RESULTS}/SM2`,
    thumbnail: `${RESULTS}/SM2/thumbnail.png`,
  },
  {
    id: 'GSF13',
    title: 'Scissors',
    object: 'Scissors',
    dataset: 'HO3D-v3',
    numFrames: 166,
    dir: `${RESULTS}/GSF13`,
    thumbnail: `${RESULTS}/GSF13/thumbnail.png`,
  },
  {
    id: 'SMu40',
    title: 'Red Mug',
    object: 'Mug',
    dataset: 'HO3D-v3',
    numFrames: 205,
    dir: `${RESULTS}/SMu40`,
    thumbnail: `${RESULTS}/SMu40/thumbnail.png`,
  },
  {
    id: 'ABF12',
    title: 'Bleach Cleanser',
    object: 'Bleach cleanser',
    dataset: 'HO3D-v3',
    numFrames: 165,
    dir: `${RESULTS}/ABF12`,
    thumbnail: `${RESULTS}/ABF12/thumbnail.png`,
  },
];

// ---------------------------------------------------------------------------
// Video showcases. `thumb` is a short preview clip shown in the filmstrip;
// `src` is the full clip played in the stage. All verified present on disk.
// ---------------------------------------------------------------------------
export const SHOWCASES = {
  rotation: {
    title: '360° Geometry',
    tagline: 'Watertight, fully-textured meshes — complete geometry the video never sees.',
    items: [
      { src: `${VIDEOS}/SM2_rotate.mp4`, thumb: `${VIDEOS}/SM2_rotate/SM2_original.mp4`, label: 'Mustard Bottle', dataset: 'HO3D-v3' },
      { src: `${VIDEOS}/ABF12_rotate.mp4`, thumb: `${VIDEOS}/ABF12_rotate/ABF12_original.mp4`, label: 'Bleach Cleanser', dataset: 'HO3D-v3' },
      { src: `${VIDEOS}/GSF13_rotate.mp4`, thumb: `${VIDEOS}/GSF13_rotate/GSF13_original.mp4`, label: 'Scissors', dataset: 'HO3D-v3' },
      { src: `${VIDEOS}/BB12_rotate.mp4`, thumb: `${VIDEOS}/BB12_rotate/BB12_original.mp4`, label: 'Banana', dataset: 'HO3D-v3' },
      { src: `${VIDEOS}/pen4_rotate.mp4`, thumb: `${VIDEOS}/pen4_rotate/genhoi_pen4_original.mp4`, label: 'Pen', dataset: 'In-the-wild' },
      { src: `${VIDEOS}/controller1_rotate.mp4`, thumb: `${VIDEOS}/controller1_rotate/genhoi_controller1_original.mp4`, label: 'Controller', dataset: 'In-the-wild' },
      { src: `${VIDEOS}/toycar1_rotate.mp4`, thumb: `${VIDEOS}/toycar1_rotate/hold_toycar1_itw_original.mp4`, label: 'Toy Car', dataset: 'In-the-wild' },
    ],
  },
  retarget: {
    title: 'Real-to-Sim',
    tagline: 'Simulation-ready: human motion retargeted to a robot hand in Isaac Gym — stable grasps from kinematics alone.',
    items: [
      { src: `${VIDEOS}/ABF12_retarget.mp4`, thumb: `${VIDEOS}/ABF12_retarget/ABF12_cut_cut_cut_trimmed.mp4`, label: 'Bleach Cleanser', dataset: 'HO3D-v3' },
      { src: `${VIDEOS}/SM2_retarget.mp4`, thumb: `${VIDEOS}/SM2_retarget/SM2_cut_cut_trimmed.mp4`, label: 'Mustard Bottle', dataset: 'HO3D-v3' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Benchmarks (from the paper's tables). methods[0] = 'AGILE' (ours).
// arrow: 'down' = lower is better, 'up' = higher is better.
// Baselines (†) are averaged over successful sequences only (survivor bias).
// ---------------------------------------------------------------------------
export const BENCHMARKS = {
  methods: ['AGILE', 'HOLD', 'MagicHOI'],
  datasets: {
    ho3d: {
      name: 'HO3D-v3',
      metrics: [
        { key: 'mpjpe', name: 'MPJPE', unit: 'mm', arrow: 'down', desc: 'Hand pose error', values: [3.92, 22.09, 7.38] },
        { key: 'cd', name: 'CD', unit: 'cm²', arrow: 'down', desc: 'Object geometry', values: [0.27, 1.11, 0.90] },
        { key: 'f5', name: 'F@5mm', unit: '%', arrow: 'up', desc: 'Precision @5mm', values: [86.63, 81.75, 76.74] },
        { key: 'f10', name: 'F@10mm', unit: '%', arrow: 'up', desc: 'Precision @10mm', values: [97.77, 92.42, 91.59] },
        { key: 'cdh', name: 'CD_h', unit: 'cm²', arrow: 'down', desc: 'Hand-relative object', values: [15.81, 18.66, 21.81] },
        { key: 'sr', name: 'Success', unit: '%', arrow: 'up', desc: 'Success rate', values: [100.0, 100.0, 83.3] },
      ],
    },
    dexycb: {
      name: 'DexYCB',
      metrics: [
        { key: 'mpjpe', name: 'MPJPE', unit: 'mm', arrow: 'down', desc: 'Hand pose error', values: [19.06, 30.86, 21.20] },
        { key: 'cd', name: 'CD', unit: 'cm²', arrow: 'down', desc: 'Object geometry', values: [0.52, 19.30, 2.05] },
        { key: 'f5', name: 'F@5mm', unit: '%', arrow: 'up', desc: 'Precision @5mm', values: [83.21, 33.20, 45.67] },
        { key: 'f10', name: 'F@10mm', unit: '%', arrow: 'up', desc: 'Precision @10mm', values: [95.43, 54.94, 67.14] },
        { key: 'cdh', name: 'CD_h', unit: 'cm²', arrow: 'down', desc: 'Hand-relative object', values: [94.60, 170.9, 661.90] },
        { key: 'sr', name: 'Success', unit: '%', arrow: 'up', desc: 'Success rate', values: [100.0, 45.0, 25.0] },
      ],
    },
    arctic: {
      name: 'ARCTIC',
      methods: ['AGILE', 'HOLD', 'BIGS'],
      note: 'ARCTIC rigid-object subset — bimanual (left / right hand). AGILE is best on every metric; second-best is split between HOLD and BIGS.',
      metrics: [
        { key: 'mpjpe_l', name: 'MPJPE-L', unit: 'mm', arrow: 'down', desc: 'Left-hand pose error', values: [25.0, 27.1, 34.1] },
        { key: 'mpjpe_r', name: 'MPJPE-R', unit: 'mm', arrow: 'down', desc: 'Right-hand pose error', values: [23.8, 24.7, 36.1] },
        { key: 'cd_o', name: 'CD-O', unit: 'cm²', arrow: 'down', desc: 'Object geometry', values: [1.12, 2.07, 1.36] },
        { key: 'f5', name: 'F@5mm', unit: '%', arrow: 'up', desc: 'Precision @5mm', values: [57.6, 37.1, 56.4] },
        { key: 'cd_l', name: 'CD-L', unit: 'cm²', arrow: 'down', desc: 'Left hand-relative', values: [21.9, 105.9, 46.1] },
        { key: 'cd_r', name: 'CD-R', unit: 'cm²', arrow: 'down', desc: 'Right hand-relative', values: [30.6, 123.5, 31.3] },
      ],
    },
  },
  // Default note (HO3D / DexYCB); ARCTIC carries its own.
  note: 'Baselines (†) averaged over successful sequences only. AGILE reaches 100% success on both datasets; HOLD fails on 55% of DexYCB, MagicHOI on 75%.',
};

// "How It Works" stepped explainer — motivation + method, distilled for a booth.
export const EXPLAINER = {
  autoAdvanceMs: 14000,
  steps: [
    {
      id: 'motivation',
      tag: 'Motivation',
      title: 'From a single video to simulation-ready interaction',
      lead: 'AGILE reconstructs dynamic hand-object interaction from one ordinary monocular video — producing simulation-ready assets for dexterous-manipulation data and digital twins in robotics &amp; VR.',
      points: [
        'One ordinary video in → <b>simulation-ready 4D interaction</b> out.',
        'Prior work breaks under <b>occlusion</b>, or when <b>SfM</b> initialization fails.',
        'AGILE’s shift: <b>generate</b> the asset first, then <b>track</b> it robustly.',
      ],
    },
    {
      id: 'stage1',
      tag: 'Stage 1 · Agentic Generation',
      title: 'Agentic Textured Object Generation',
      lead: 'A VLM agent generates a complete, watertight object mesh — independent of whatever the video occludes.',
      points: [
        '<b>VLM</b> selects informative keyframes, then guides multi-view synthesis.',
        'A <b>VLM critic</b> filters candidates by rejection sampling (geometry · texture · consistency).',
        '3D lifting → retopology → VLM-supervised texture → a <b>watertight</b> mesh.',
      ],
      figure: '../static/img/agentic_gen.png',
      figureCaption: 'Stage 1 — VLM-guided multi-view synthesis with rejection sampling, then 3D lifting, retopology, and texture refinement.',
    },
    {
      id: 'stage2',
      tag: 'Stage 2 · Anchor & Track',
      title: 'Anchor-and-Track Optimization',
      lead: 'No fragile Structure-from-Motion. AGILE anchors the object pose at a single frame and propagates it with contact-aware optimization.',
      points: [
        'Metric init from <b>SAM2</b> + <b>MoGe-2</b>; hand from <b>WiLoR</b> (scale via ICP).',
        'Object pose <b>anchored</b> at the interaction-onset frame with <b>FoundationPose</b>.',
        'Bidirectional tracking: mask + <b>DINO</b> semantics + interaction-stability (no penetration).',
      ],
      figure: '../static/img/pipeline.png',
      figureCaption: 'Full method — preprocessing, pose &amp; scale initialization, and hand-object interaction optimization.',
    },
    {
      id: 'result',
      tag: 'Outcome',
      title: 'Simulation-Ready 4D Interaction',
      lead: 'Physically valid trajectories with watertight assets — validated by real-to-sim retargeting to a robot hand.',
      points: [
        'Watertight, simulation-ready assets — stable grasps from <b>kinematics alone</b>.',
        'Outperforms HOLD &amp; MagicHOI on HO3D-v3 &amp; DexYCB.',
        '<b>100% reconstruction success</b> where prior methods collapse.',
      ],
      video: '../static/videos/ABF12_retarget.mp4',
      cta: true,
    },
  ],
};
