(() => {
  window.MUSHI_AI_POLICY = {
  "version": 13,
  "source": "color-counter-deck-search-v6",
  "training": {
    "seed": 20260926,
    "targetOpponent": "colorBlessing",
    "approximateSimulator": true,
    "colorWeaknessMode": true,
    "games": 746000,
    "baseBee": {
      "winRate": 0.547,
      "score": 1.6429,
      "record": {
        "wins": 10940,
        "losses": 9020,
        "draws": 40,
        "games": 20000
      }
    },
    "bestDeck": {
      "ids": [
        701,
        701,
        703,
        703,
        8,
        8,
        702,
        702,
        511,
        511,
        212,
        212,
        513,
        513,
        125,
        125,
        253,
        253,
        60,
        824
      ],
      "names": [
        "オオスズメバチ（女王）",
        "オオスズメバチ（女王）",
        "オオスズメバチ",
        "オオスズメバチ",
        "オオスズメバチ",
        "オオスズメバチ",
        "タランチュラホーク",
        "タランチュラホーク",
        "モンスズメバチ",
        "モンスズメバチ",
        "キアシナガバチ",
        "キアシナガバチ",
        "クロスズメバチ",
        "クロスズメバチ",
        "玉響の蠢き",
        "玉響の蠢き",
        "電気虫の稲妻",
        "電気虫の稲妻",
        "ニホンミツバチ",
        "ヤマトハキリバチ"
      ],
      "label": "オオスズメバチ（女王）×2 / オオスズメバチ×2 / オオスズメバチ×2 / タランチュラホーク×2 / モンスズメバチ×2 / キアシナガバチ×2 / クロスズメバチ×2 / 玉響の蠢き×2 / 電気虫の稲妻×2 / ニホンミツバチ / ヤマトハキリバチ",
      "winRate": 0.6481,
      "score": 1.9491,
      "record": {
        "wins": 12961,
        "losses": 6933,
        "draws": 106,
        "games": 20000
      }
    },
    "stage1Top": [
      {
        "replacements": [
          253,
          253
        ],
        "names": [
          "電気虫の稲妻",
          "電気虫の稲妻"
        ],
        "winRate": 0.6264,
        "score": 1.885
      },
      {
        "replacements": [
          60,
          253
        ],
        "names": [
          "ニホンミツバチ",
          "電気虫の稲妻"
        ],
        "winRate": 0.6195,
        "score": 1.8631
      },
      {
        "replacements": [
          607,
          253
        ],
        "names": [
          "エゾオナガバチ",
          "電気虫の稲妻"
        ],
        "winRate": 0.6197,
        "score": 1.863
      },
      {
        "replacements": [
          253,
          527
        ],
        "names": [
          "電気虫の稲妻",
          "ニイニイゼミ"
        ],
        "winRate": 0.6167,
        "score": 1.8544
      },
      {
        "replacements": [
          830,
          253
        ],
        "names": [
          "パンダアリバチ",
          "電気虫の稲妻"
        ],
        "winRate": 0.6158,
        "score": 1.8509
      }
    ],
    "stage2Top": [
      {
        "replacements": [
          60,
          824
        ],
        "names": [
          "ニホンミツバチ",
          "ヤマトハキリバチ"
        ],
        "winRate": 0.6481,
        "score": 1.9491
      },
      {
        "replacements": [
          60,
          607
        ],
        "names": [
          "ニホンミツバチ",
          "エゾオナガバチ"
        ],
        "winRate": 0.6473,
        "score": 1.9467
      },
      {
        "replacements": [
          54,
          824
        ],
        "names": [
          "キムネクマバチ",
          "ヤマトハキリバチ"
        ],
        "winRate": 0.6459,
        "score": 1.9425
      },
      {
        "replacements": [
          53,
          607
        ],
        "names": [
          "セイヨウミツバチ",
          "エゾオナガバチ"
        ],
        "winRate": 0.6452,
        "score": 1.9419
      },
      {
        "replacements": [
          54,
          54
        ],
        "names": [
          "キムネクマバチ",
          "キムネクマバチ"
        ],
        "winRate": 0.6455,
        "score": 1.9409
      }
    ]
  },
  "archetypes": {
    "aquatic": {
      "comboWeight": 1,
      "cheapDeployBonus": 0,
      "finisherResourceTarget": 6,
      "blueBaitFloor": 5,
      "bloodPactWeight": 1.4,
      "rgbBaitPriority": 9,
      "bloodPactTerritoryWeight": 1.15,
      "engineBaitPriority": 8,
      "aquaticCheapBonus": 2.5,
      "bounceThreatThreshold": 7,
      "reverseSwapDelta": 3,
      "resourceTarget": 4,
      "aggression": 1.495,
      "directAttackWeight": 1.497,
      "tempSummonBaitFloor": 5,
      "tempSummonMinValue": 16.284,
      "preserveWeight": 1.256,
      "removalWeight": 1.133,
      "aceWeight": 1.059,
      "deployThreshold": 5.7
    },
    "armyAnt": {
      "comboWeight": 0.82,
      "cheapDeployBonus": 0,
      "finisherResourceTarget": 4,
      "blueBaitFloor": 2,
      "bloodPactWeight": 1.681,
      "rgbBaitPriority": 9.378,
      "bloodPactTerritoryWeight": 0.97,
      "engineBaitPriority": 8,
      "aquaticCheapBonus": 0,
      "bounceThreatThreshold": 7.634,
      "reverseSwapDelta": 3.832,
      "resourceTarget": 6,
      "aggression": 1.45,
      "directAttackWeight": 1.689,
      "tempSummonBaitFloor": 7,
      "tempSummonMinValue": 11.47,
      "preserveWeight": 1.022,
      "removalWeight": 0.756,
      "aceWeight": 1.816,
      "deployThreshold": 4.46
    },
    "hercules": {
      "comboWeight": 0.6,
      "cheapDeployBonus": 0,
      "finisherResourceTarget": 6,
      "blueBaitFloor": 3,
      "bloodPactWeight": 0.709,
      "rgbBaitPriority": 8.482,
      "bloodPactTerritoryWeight": 1.292,
      "engineBaitPriority": 8.563,
      "aquaticCheapBonus": 0.006,
      "bounceThreatThreshold": 8.814,
      "reverseSwapDelta": 3.433,
      "resourceTarget": 6,
      "aggression": 1.671,
      "directAttackWeight": 1.196,
      "tempSummonBaitFloor": 7,
      "tempSummonMinValue": 16.293,
      "preserveWeight": 1.8,
      "removalWeight": 1.591,
      "aceWeight": 1.63,
      "deployThreshold": 5.538
    },
    "sumatra": {
      "comboWeight": 0.799,
      "cheapDeployBonus": 0,
      "finisherResourceTarget": 7,
      "blueBaitFloor": 2,
      "bloodPactWeight": 1.072,
      "rgbBaitPriority": 9,
      "bloodPactTerritoryWeight": 1.15,
      "engineBaitPriority": 8,
      "aquaticCheapBonus": 1.263,
      "bounceThreatThreshold": 7.005,
      "reverseSwapDelta": 3.499,
      "resourceTarget": 6,
      "aggression": 1.2,
      "directAttackWeight": 1.599,
      "tempSummonBaitFloor": 6,
      "tempSummonMinValue": 9.688,
      "preserveWeight": 1.304,
      "removalWeight": 1.225,
      "aceWeight": 1.818,
      "deployThreshold": 5.627
    },
    "bee": {
      "comboWeight": 0.941,
      "cheapDeployBonus": 0.892,
      "finisherResourceTarget": 5,
      "blueBaitFloor": 2,
      "bloodPactWeight": 0.952,
      "rgbBaitPriority": 9.693,
      "bloodPactTerritoryWeight": 1.274,
      "engineBaitPriority": 7.307,
      "aquaticCheapBonus": 0.394,
      "bounceThreatThreshold": 6.439,
      "reverseSwapDelta": 2.943,
      "resourceTarget": 6,
      "aggression": 1.22,
      "directAttackWeight": 1.77,
      "tempSummonBaitFloor": 7,
      "tempSummonMinValue": 12.43,
      "preserveWeight": 0.879,
      "removalWeight": 0.95,
      "aceWeight": 1.837,
      "deployThreshold": 6.539
    },
    "mimicAggro": {
      "comboWeight": 1.747,
      "cheapDeployBonus": 0.9,
      "finisherResourceTarget": 5,
      "blueBaitFloor": 3,
      "bloodPactWeight": 0.822,
      "rgbBaitPriority": 8.662,
      "bloodPactTerritoryWeight": 1.043,
      "engineBaitPriority": 8.703,
      "aquaticCheapBonus": 0.164,
      "bounceThreatThreshold": 8.139,
      "reverseSwapDelta": 3.249,
      "resourceTarget": 4,
      "aggression": 1.89,
      "directAttackWeight": 1.595,
      "tempSummonBaitFloor": 5,
      "tempSummonMinValue": 16.123,
      "preserveWeight": 1.248,
      "removalWeight": 0.75,
      "aceWeight": 1.819,
      "deployThreshold": 7.179
    },
    "colorBlessing": {
      "comboWeight": 1.517,
      "cheapDeployBonus": 0,
      "finisherResourceTarget": 6,
      "blueBaitFloor": 3,
      "bloodPactWeight": 1.3,
      "rgbBaitPriority": 9.393,
      "bloodPactTerritoryWeight": 1.202,
      "aquaticCheapBonus": 0,
      "bounceThreatThreshold": 6.02,
      "reverseSwapDelta": 3.434,
      "resourceTarget": 4,
      "aggression": 1.066,
      "directAttackWeight": 1.905,
      "tempSummonBaitFloor": 4,
      "tempSummonMinValue": 14.667,
      "preserveWeight": 1.433,
      "removalWeight": 1.305,
      "aceWeight": 1.397,
      "deployThreshold": 3.713
    },
    "generic": {
      "resourceTarget": 5,
      "blueBaitFloor": 2,
      "aggression": 1.2,
      "directAttackWeight": 1.35,
      "tempSummonBaitFloor": 5,
      "tempSummonMinValue": 11,
      "preserveWeight": 1.15,
      "removalWeight": 1.15,
      "aceWeight": 1.2,
      "deployThreshold": 7
    },
    "colorCounter": {
      "comboWeight": 0.906,
      "cheapDeployBonus": 1.701,
      "finisherResourceTarget": 5,
      "blueBaitFloor": 3,
      "bloodPactWeight": 0.982,
      "rgbBaitPriority": 10.817,
      "bloodPactTerritoryWeight": 1.307,
      "engineBaitPriority": 8.35,
      "aquaticCheapBonus": 0.7,
      "bounceThreatThreshold": 6.757,
      "reverseSwapDelta": 2.029,
      "resourceTarget": 6,
      "aggression": 1.13,
      "directAttackWeight": 1.256,
      "tempSummonBaitFloor": 6,
      "tempSummonMinValue": 13.994,
      "preserveWeight": 1.22,
      "removalWeight": 1.445,
      "aceWeight": 2,
      "deployThreshold": 7.15
    }
  }
};
})();
