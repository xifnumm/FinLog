const MVR_TO_USD_RATE = 15.42;

export const formatMVR = (n: number) =>
  `MVR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatUSD = (mvr: number) =>
  `~USD ${(mvr / MVR_TO_USD_RATE).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const mvrToOther = (mvr: number, otherRateVsUsd: number) =>
  (mvr / MVR_TO_USD_RATE) * otherRateVsUsd;

export const MVR_PER_USD = MVR_TO_USD_RATE;
