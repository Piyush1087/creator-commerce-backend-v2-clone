export type AssetMixPercents = {
  product: number;
  collection: number;
  sale: number;
};

export type TierMixPercents = {
  nano: number;
  micro: number;
  midTier: number;
  mega: number;
  celebrity: number;
};

export type ObjectiveMixPercents = {
  pulse: number;
  proof: number;
  push: number;
  production: number;
};

export type StrategyMixPercents = {
  assetMix: AssetMixPercents;
  tierMix: TierMixPercents;
  objectiveMix: ObjectiveMixPercents;
};
