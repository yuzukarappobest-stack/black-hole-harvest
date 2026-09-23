(() => {
  window.MUSHI_AI_POLICY = {
    version: 1,
    source: "expert-seed",
    archetypes: {
      aquatic: {resourceTarget:4, blueBaitFloor:4, aggression:1.35, directAttackWeight:1.45, tempSummonBaitFloor:5, tempSummonMinValue:15, preserveWeight:1.2, removalWeight:1.25},
      armyAnt: {resourceTarget:4, aggression:1.55, directAttackWeight:1.65, tempSummonBaitFloor:4, tempSummonMinValue:11, preserveWeight:1.05, removalWeight:1.0},
      hercules: {resourceTarget:6, aggression:1.15, directAttackWeight:1.35, tempSummonBaitFloor:6, tempSummonMinValue:12, preserveWeight:1.35, removalWeight:1.35},
      sumatra: {resourceTarget:6, aggression:1.25, directAttackWeight:1.45, tempSummonBaitFloor:6, tempSummonMinValue:13, preserveWeight:1.35, removalWeight:1.25},
      bee: {resourceTarget:6, aggression:1.2, directAttackWeight:1.35, tempSummonBaitFloor:6, tempSummonMinValue:12, preserveWeight:1.3, removalWeight:1.25},
      mimicAggro: {resourceTarget:4, aggression:1.6, directAttackWeight:1.8, tempSummonBaitFloor:4, tempSummonMinValue:10, preserveWeight:0.95, removalWeight:0.95},
      colorBlessing: {resourceTarget:5, aggression:1.25, directAttackWeight:1.4, tempSummonBaitFloor:5, tempSummonMinValue:11, preserveWeight:1.2, removalWeight:1.2},
      generic: {resourceTarget:5, aggression:1.2, directAttackWeight:1.35, tempSummonBaitFloor:5, tempSummonMinValue:11, preserveWeight:1.15, removalWeight:1.15}
    }
  };
})();