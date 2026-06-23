export type FeatureConfig = {
  qualityEvaluation: boolean;
  fileUpload: boolean;
  webFetch: boolean;
};

export const featureConfig: FeatureConfig = {
  qualityEvaluation: true,
  fileUpload: true,
  webFetch: true,
};
