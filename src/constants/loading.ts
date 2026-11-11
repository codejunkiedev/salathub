/** Where the loading bar stands at each real step of start-up. */
export const LoadingStep = {
  /** Shown by the static splash in index.html while the app's code downloads. */
  Bundle: 0.1,
  Session: 0.3,
  Account: 0.5,
  Page: 0.7,
} as const;
