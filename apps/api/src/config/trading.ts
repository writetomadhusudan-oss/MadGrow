import { DEFAULT_FEE_CONFIG, type FeeConfig } from "@market-cap/shared";

/**
 * Fee/slippage configuration. Every value can be overridden via env, e.g.
 * TRADING_STARTING_BALANCE=500000 TRADING_BROKERAGE_PCT=0
 */
function envNum(key: string, fallback: number): number {
  const raw = process.env[key];
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const FEE_CONFIG: FeeConfig = {
  startingBalance: envNum("TRADING_STARTING_BALANCE", DEFAULT_FEE_CONFIG.startingBalance),
  brokeragePct: envNum("TRADING_BROKERAGE_PCT", DEFAULT_FEE_CONFIG.brokeragePct),
  brokerageCap: envNum("TRADING_BROKERAGE_CAP", DEFAULT_FEE_CONFIG.brokerageCap),
  sttPct: envNum("TRADING_STT_PCT", DEFAULT_FEE_CONFIG.sttPct),
  exchangePct: envNum("TRADING_EXCHANGE_PCT", DEFAULT_FEE_CONFIG.exchangePct),
  sebiPct: envNum("TRADING_SEBI_PCT", DEFAULT_FEE_CONFIG.sebiPct),
  gstPct: envNum("TRADING_GST_PCT", DEFAULT_FEE_CONFIG.gstPct),
  stampDutyPctBuy: envNum("TRADING_STAMP_DUTY_PCT_BUY", DEFAULT_FEE_CONFIG.stampDutyPctBuy),
  slippageMaxPct: envNum("TRADING_SLIPPAGE_MAX_PCT", DEFAULT_FEE_CONFIG.slippageMaxPct),
};

/** How often open orders and SL/targets are evaluated against prices (ms). */
export const MONITOR_INTERVAL_MS = envNum("TRADING_MONITOR_INTERVAL_MS", 60_000);
