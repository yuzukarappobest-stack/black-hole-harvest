(() => {
  window.MUSHI_AI_POLICY = {
  "version": 5,
  "source": "color-blessing-strategy-selfplay-v2",
  "training": {
    "seed": 20260924,
    "focusedArchetypes": [
      "colorBlessing"
    ],
    "aquaticPreserved": true,
    "generations": 12,
    "population": 36,
    "approximateSimulator": true,
    "games": 104472,
    "summary": {
      "colorBlessing": {
        "baselineScore": 1.9502,
        "baselineWinRate": 0.65,
        "chosenScore": 1.9942,
        "chosenWinRate": 0.6639,
        "improved": true,
        "candidates": 240,
        "finalists": 12,
        "generations": [
          {
            "gen": 0,
            "score": 2.0719,
            "winRate": 0.6875
          },
          {
            "gen": 1,
            "score": 2.1084,
            "winRate": 0.6974
          },
          {
            "gen": 2,
            "score": 2.089,
            "winRate": 0.6937
          },
          {
            "gen": 3,
            "score": 2.126,
            "winRate": 0.7083
          },
          {
            "gen": 4,
            "score": 2.0905,
            "winRate": 0.6932
          },
          {
            "gen": 5,
            "score": 2.0823,
            "winRate": 0.6932
          },
          {
            "gen": 6,
            "score": 2.09,
            "winRate": 0.6932
          },
          {
            "gen": 7,
            "score": 2.0355,
            "winRate": 0.6761
          },
          {
            "gen": 8,
            "score": 2.1193,
            "winRate": 0.7045
          },
          {
            "gen": 9,
            "score": 2.0014,
            "winRate": 0.6648
          },
          {
            "gen": 10,
            "score": 2.0455,
            "winRate": 0.6818
          },
          {
            "gen": 11,
            "score": 2.0059,
            "winRate": 0.6648
          }
        ]
      }
    }
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
      "comboWeight": 0.882,
      "cheapDeployBonus": 0.675,
      "finisherResourceTarget": 4,
      "blueBaitFloor": 2,
      "bloodPactWeight": 1.682,
      "aquaticCheapBonus": 0,
      "bounceThreatThreshold": 8.053,
      "reverseSwapDelta": 3.832,
      "resourceTarget": 5,
      "aggression": 1.45,
      "directAttackWeight": 1.533,
      "tempSummonBaitFloor": 7,
      "tempSummonMinValue": 10.714,
      "preserveWeight": 1.086,
      "removalWeight": 0.75,
      "aceWeight": 1.768,
      "deployThreshold": 4.041
    },
    "hercules": {
      "comboWeight": 1.003,
      "cheapDeployBonus": 0,
      "finisherResourceTarget": 6,
      "blueBaitFloor": 3,
      "bloodPactWeight": 0.916,
      "aquaticCheapBonus": 0.082,
      "bounceThreatThreshold": 7.947,
      "reverseSwapDelta": 3.192,
      "resourceTarget": 6,
      "aggression": 1.563,
      "directAttackWeight": 1.186,
      "tempSummonBaitFloor": 6,
      "tempSummonMinValue": 12.544,
      "preserveWeight": 1.66,
      "removalWeight": 1.44,
      "aceWeight": 1.717,
      "deployThreshold": 6.379
    },
    "sumatra": {
      "comboWeight": 0.799,
      "cheapDeployBonus": 0.395,
      "finisherResourceTarget": 7,
      "blueBaitFloor": 2,
      "bloodPactWeight": 1.072,
      "aquaticCheapBonus": 1.263,
      "bounceThreatThreshold": 7.005,
      "reverseSwapDelta": 3.499,
      "resourceTarget": 6,
      "aggression": 1.279,
      "directAttackWeight": 1.599,
      "tempSummonBaitFloor": 6,
      "tempSummonMinValue": 9.688,
      "preserveWeight": 1.304,
      "removalWeight": 1.225,
      "aceWeight": 1.818,
      "deployThreshold": 5.627
    },
    "bee": {
      "comboWeight": 1,
      "cheapDeployBonus": 0.146,
      "finisherResourceTarget": 5,
      "blueBaitFloor": 2,
      "bloodPactWeight": 1,
      "aquaticCheapBonus": 0.23,
      "bounceThreatThreshold": 7.354,
      "reverseSwapDelta": 2.383,
      "resourceTarget": 6,
      "aggression": 1.357,
      "directAttackWeight": 1.657,
      "tempSummonBaitFloor": 7,
      "tempSummonMinValue": 13.485,
      "preserveWeight": 1.068,
      "removalWeight": 1.146,
      "aceWeight": 1.719,
      "deployThreshold": 6.845
    },
    "mimicAggro": {
      "comboWeight": 1.441,
      "cheapDeployBonus": 0,
      "finisherResourceTarget": 5,
      "blueBaitFloor": 3,
      "bloodPactWeight": 0.7,
      "aquaticCheapBonus": 0.237,
      "bounceThreatThreshold": 7.81,
      "reverseSwapDelta": 3.249,
      "resourceTarget": 5,
      "aggression": 1.693,
      "directAttackWeight": 1.66,
      "tempSummonBaitFloor": 5,
      "tempSummonMinValue": 13.623,
      "preserveWeight": 1.016,
      "removalWeight": 1.018,
      "aceWeight": 1.37,
      "deployThreshold": 4.783
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
    }
  }
};
})();
