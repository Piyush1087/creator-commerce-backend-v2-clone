/**
 * Input for {@link IndustryClassifier}. `normalizedUrl` is used for Parallel landing fetch.
 */
export type IndustryClassifyInput = {
  hostname: string;
  normalizedUrl: string;
};
