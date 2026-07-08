// Black-Scholes Greeks, used to enrich option chains when the data provider
// supplies implied volatility but not Greeks. Educational estimates only.

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Abramowitz–Stegun approximation of the standard normal CDF. */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - normPdf(x) * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number; // per calendar day
  vega: number; // per 1% change in IV
  rho: number; // per 1% change in rates
}

/**
 * @param spot underlying price
 * @param strike option strike
 * @param timeYears time to expiry in years
 * @param iv implied volatility as a decimal (0.18 = 18%)
 * @param rate risk-free rate as a decimal
 */
export function blackScholesGreeks(
  type: "CALL" | "PUT",
  spot: number,
  strike: number,
  timeYears: number,
  iv: number,
  rate = 0.07
): Greeks | null {
  if (spot <= 0 || strike <= 0 || timeYears <= 0 || iv <= 0) return null;
  const sqrtT = Math.sqrt(timeYears);
  const d1 = (Math.log(spot / strike) + (rate + (iv * iv) / 2) * timeYears) / (iv * sqrtT);
  const d2 = d1 - iv * sqrtT;
  const discount = Math.exp(-rate * timeYears);
  const call = type === "CALL";

  const delta = call ? normCdf(d1) : normCdf(d1) - 1;
  const gamma = normPdf(d1) / (spot * iv * sqrtT);
  const thetaYear = call
    ? (-spot * normPdf(d1) * iv) / (2 * sqrtT) - rate * strike * discount * normCdf(d2)
    : (-spot * normPdf(d1) * iv) / (2 * sqrtT) + rate * strike * discount * normCdf(-d2);
  const vega = (spot * normPdf(d1) * sqrtT) / 100;
  const rho = call
    ? (strike * timeYears * discount * normCdf(d2)) / 100
    : (-strike * timeYears * discount * normCdf(-d2)) / 100;

  const round = (v: number) => Math.round(v * 10000) / 10000;
  return {
    delta: round(delta),
    gamma: round(gamma),
    theta: round(thetaYear / 365),
    vega: round(vega),
    rho: round(rho),
  };
}
