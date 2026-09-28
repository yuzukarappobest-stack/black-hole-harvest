export const BASE_CONFIG = {
  courseWidth: 8.6,
  courseLength: 420,
  courseStartZ: 4.5,
  courseSegments: [
    { length: 60, curve: 0 },
    { length: 75, curve: .035 },
    { length: 70, curve: -.04 },
    { length: 85, curve: .04 },
    { length: 70, curve: -.035 },
    { length: 60, curve: 0 },
  ],
  forwardSpeed: 8.2,
  lateralSpeed: 12,
  lateralSmoothing: 12,
  cameraHeight: 7.8,
  cameraDistance: 10,
  spawnCount: 54,
  smallFruitScoreFactor: .4,
  magnetDuration: 2,
  rainbowScoreRequirement: 12000,
  rainbowShardCount: 3,
  respawnDelay: 3,
  respawnBacktrack: 16,
  courseOutPenalty: 200,
  finishPadding: 8,
};

export const STAGES = {
  1: {
    id:1, name:"ステージ1", subtitle:"みどりの こうえん",
    theme:"park",
    config:{ ...BASE_CONFIG },
  },
  2: {
    id:2, name:"ステージ2", subtitle:"うちゅう",
    theme:"space",
    config:{
      ...BASE_CONFIG,
      courseWidth:8.2,
      courseSegments:[
        {length:55,curve:.02},{length:65,curve:-.055},{length:70,curve:.06},
        {length:75,curve:-.065},{length:80,curve:.05},{length:75,curve:-.03},
      ],
      forwardSpeed:8.7,
    },
  },
  3: {
    id:3, name:"ステージ3", subtitle:"やまの うえ",
    theme:"mountain",
    config:{
      ...BASE_CONFIG,
      courseWidth:8.0,
      widthProfile:[
        {from:0,to:95,width:9.4},{from:95,to:175,width:6.2},
        {from:175,to:270,width:8.8},{from:270,to:350,width:5.8},{from:350,to:420,width:8.2},
      ],
      courseSegments:[
        {length:80,curve:.025},{length:85,curve:-.045},{length:90,curve:.035},
        {length:75,curve:-.05},{length:90,curve:.025},
      ],
      forwardSpeed:8.4,
    },
  },
  4: {
    id:4, name:"ステージ4", subtitle:"うみ",
    theme:"sea",
    config:{
      ...BASE_CONFIG,
      courseWidth:7.6,
      widthProfile:[
        {from:0,to:70,width:8.6},{from:70,to:140,width:6.8},{from:140,to:210,width:9.8},
        {from:210,to:300,width:6.0},{from:300,to:420,width:8.2},
      ],
      courseSegments:[
        {length:55,curve:.07},{length:55,curve:-.09},{length:65,curve:.095},
        {length:70,curve:-.085},{length:75,curve:.075},{length:100,curve:-.035},
      ],
      forwardSpeed:9.0,
    },
  },
};

export let CONFIG = { ...STAGES[1].config };
export let ACTIVE_STAGE = STAGES[1];

export function setStage(stageId) {
  ACTIVE_STAGE = STAGES[stageId] || STAGES[1];
  CONFIG = { ...ACTIVE_STAGE.config };
  return ACTIVE_STAGE;
}

export function courseWidthAtDistance(distance) {
  const profile = CONFIG.widthProfile;
  if (!profile?.length) return CONFIG.courseWidth;
  const d = Math.max(0, Math.min(CONFIG.courseLength, distance));
  const segment = profile.find((item) => d >= item.from && d < item.to) || profile[profile.length - 1];
  return segment.width;
}

export const FRUIT_LEVELS = [
  { level: 1, name: "CHERRY", label: "さくらんぼ", radius: .48, color: 0xe74d62, score: 10 },
  { level: 2, name: "STRAWBERRY", label: "いちご", radius: .62, color: 0xf0445e, score: 25 },
  { level: 3, name: "GRAPE", label: "ぶどう", radius: .78, color: 0x7b52c7, score: 45 },
  { level: 4, name: "ORANGE", label: "みかん", radius: .94, color: 0xffa52e, score: 70 },
  { level: 5, name: "APPLE", label: "りんご", radius: 1.10, color: 0xea3f43, score: 105 },
  { level: 6, name: "PEACH", label: "もも", radius: 1.26, color: 0xffa2aa, score: 150 },
  { level: 7, name: "DURIAN", label: "ドリアン", radius: 1.40, color: 0x8e9d40, score: 205 },
  { level: 8, name: "PINEAPPLE", label: "パイナップル", radius: 1.55, color: 0xf3bd39, score: 270 },
  { level: 9, name: "MELON", label: "メロン", radius: 1.70, color: 0x9bcf4b, score: 350 },
  { level: 10, name: "WATERMELON", label: "スイカ", radius: 1.88, color: 0x38a95a, score: 450 },
  { level: 11, name: "JACKFRUIT", label: "ジャックフルーツ", radius: 2.08, color: 0x86b53f, score: 580 },
  { level: 12, name: "RAINBOW", label: "にじいろフルーツ", radius: 2.30, color: 0xff72a9, score: 750 },
];
