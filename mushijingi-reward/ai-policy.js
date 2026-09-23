(() => {
  window.MUSHI_AI_POLICY = {
  "version": 3,
  "source": "aquatic-intensive-selfplay-v2",
  "training": {
    "seed": 20260924,
    "focusedArchetype": "aquatic",
    "generations": 18,
    "population": 48,
    "approximateSimulator": true,
    "games": 520128,
    "previousBenchmark": {
      "score": 2.5348,
      "winRate": 0.8424,
      "games": 768
    },
    "championBenchmark": {
      "score": 2.4969,
      "winRate": 0.8307,
      "games": 768
    },
    "microSearch": {
      "candidates": 720,
      "finalists": 24,
      "baselineScore": 2.5348,
      "baselineWinRate": 0.8424,
      "bestScore": 2.5195,
      "bestWinRate": 0.8385
    },
    "generationStats": [
      {
        "gen": 0,
        "score": 2.6206,
        "winRate": 0.8715
      },
      {
        "gen": 1,
        "score": 2.5406,
        "winRate": 0.8467
      },
      {
        "gen": 2,
        "score": 2.5107,
        "winRate": 0.8365
      },
      {
        "gen": 3,
        "score": 2.459,
        "winRate": 0.8179
      },
      {
        "gen": 4,
        "score": 2.4683,
        "winRate": 0.8214
      },
      {
        "gen": 5,
        "score": 2.4924,
        "winRate": 0.8276
      },
      {
        "gen": 6,
        "score": 2.5074,
        "winRate": 0.8333
      },
      {
        "gen": 7,
        "score": 2.4932,
        "winRate": 0.8305
      },
      {
        "gen": 8,
        "score": 2.5148,
        "winRate": 0.8362
      },
      {
        "gen": 9,
        "score": 2.4622,
        "winRate": 0.819
      },
      {
        "gen": 10,
        "score": 2.4634,
        "winRate": 0.8218
      },
      {
        "gen": 11,
        "score": 2.5708,
        "winRate": 0.8563
      },
      {
        "gen": 12,
        "score": 2.4934,
        "winRate": 0.8276
      },
      {
        "gen": 13,
        "score": 2.5198,
        "winRate": 0.8391
      },
      {
        "gen": 14,
        "score": 2.4972,
        "winRate": 0.8305
      },
      {
        "gen": 15,
        "score": 2.5413,
        "winRate": 0.8448
      },
      {
        "gen": 16,
        "score": 2.4663,
        "winRate": 0.8218
      },
      {
        "gen": 17,
        "score": 2.4951,
        "winRate": 0.8305
      }
    ]
  },
  "archetypes": {
    "aquatic": {
      "resourceTarget": 4,
      "finisherResourceTarget": 6,
      "blueBaitFloor": 5,
      "aggression": 1.495,
      "directAttackWeight": 1.497,
      "tempSummonBaitFloor": 5,
      "tempSummonMinValue": 16.284,
      "preserveWeight": 1.256,
      "removalWeight": 1.133,
      "aceWeight": 1.059,
      "deployThreshold": 5.7,
      "bloodPactWeight": 1.4,
      "aquaticCheapBonus": 2.5,
      "bounceThreatThreshold": 7,
      "reverseSwapDelta": 3
    },
    "armyAnt": {
      "resourceTarget": 3,
      "blueBaitFloor": 2,
      "aggression": 1.75,
      "directAttackWeight": 1.657,
      "tempSummonBaitFloor": 5,
      "tempSummonMinValue": 10.923,
      "preserveWeight": 1.113,
      "removalWeight": 0.861,
      "aceWeight": 1.357,
      "deployThreshold": 4.438
    },
    "hercules": {
      "resourceTarget": 7,
      "blueBaitFloor": 2,
      "aggression": 1.169,
      "directAttackWeight": 1.506,
      "tempSummonBaitFloor": 6,
      "tempSummonMinValue": 12.428,
      "preserveWeight": 1.597,
      "removalWeight": 1.305,
      "aceWeight": 1.709,
      "deployThreshold": 7.218
    },
    "sumatra": {
      "resourceTarget": 6,
      "blueBaitFloor": 2,
      "aggression": 1.237,
      "directAttackWeight": 1.439,
      "tempSummonBaitFloor": 6,
      "tempSummonMinValue": 11.15,
      "preserveWeight": 1.22,
      "removalWeight": 1.19,
      "aceWeight": 1.685,
      "deployThreshold": 6.222
    },
    "bee": {
      "resourceTarget": 6,
      "blueBaitFloor": 2,
      "aggression": 1.357,
      "directAttackWeight": 1.437,
      "tempSummonBaitFloor": 7,
      "tempSummonMinValue": 13.485,
      "preserveWeight": 1.123,
      "removalWeight": 1.28,
      "aceWeight": 1.653,
      "deployThreshold": 7.414
    },
    "mimicAggro": {
      "resourceTarget": 4,
      "blueBaitFloor": 2,
      "aggression": 1.744,
      "directAttackWeight": 1.972,
      "tempSummonBaitFloor": 4,
      "tempSummonMinValue": 13.537,
      "preserveWeight": 1.035,
      "removalWeight": 1.055,
      "aceWeight": 1.118,
      "deployThreshold": 5.515
    },
    "colorBlessing": {
      "resourceTarget": 4,
      "blueBaitFloor": 2,
      "aggression": 1.072,
      "directAttackWeight": 1.515,
      "tempSummonBaitFloor": 6,
      "tempSummonMinValue": 12.435,
      "preserveWeight": 1.282,
      "removalWeight": 1.38,
      "aceWeight": 1.275,
      "deployThreshold": 5.751
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
