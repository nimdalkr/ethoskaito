import { z } from "zod";

import { fetchJson, toIsoString } from "@/lib/providers/shared";
import type { ProjectOutcomeSnapshot, ProjectOutcomeSnapshotInput, ProviderRequestOptions } from "@/lib/types/provider";

const defaultBaseUrl = process.env.PRICE_API_BASE_URL ?? "https://api.coingecko.com/api/v3";

const searchSchema = z.object({
  coins: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      symbol: z.string(),
      market_cap_rank: z.number().nullable().optional()
    })
  )
});

const marketChartSchema = z.object({
  prices: z.array(z.tuple([z.number(), z.number()]))
});

const simplePriceSchema = z.record(
  z.string(),
  z.record(z.string(), z.union([z.number(), z.string(), z.null()]).optional())
);

function normalizePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function resolveCoinId(searchResults: z.infer<typeof searchSchema>["coins"], symbol: string) {
  const lower = symbol.toLowerCase();
  const exact = searchResults.find((coin) => coin.symbol.toLowerCase() === lower || coin.id.toLowerCase() === lower);
  if (exact) {
    return exact.id;
  }
  return searchResults[0]?.id ?? null;
}

export class PriceClient {
  readonly baseUrl: string;

  constructor(baseUrl = defaultBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async getProjectOutcomeSnapshot(input: ProjectOutcomeSnapshotInput, options: ProviderRequestOptions = {}): Promise<ProjectOutcomeSnapshot> {
    const currency = input.currency ?? "usd";
    const fromIso = toIsoString(input.from);
    const fromUnix = Math.floor(new Date(fromIso).getTime() / 1000);
    const nowUnix = Math.floor(Date.now() / 1000);

    const { data: searchResult } = await fetchJson(
      "price",
      `${this.baseUrl}/search`,
      {
        ...options,
        query: {
          query: input.symbol
        }
      },
      (value) => searchSchema.parse(value)
    );

    const resolvedCoinId = resolveCoinId(searchResult.coins, input.symbol);
    if (!resolvedCoinId) {
      return {
        symbol: input.symbol,
        currency,
        resolvedCoinId: null,
        from: fromIso,
        asOf: new Date().toISOString(),
        priceAtFrom: null,
        currentPrice: null,
        returnPct: null,
        absoluteChange: null,
        points: []
      };
    }

    const [{ data: chart }, { data: current }] = await Promise.all([
      fetchJson(
        "price",
        `${this.baseUrl}/coins/${encodeURIComponent(resolvedCoinId)}/market_chart/range`,
        {
          ...options,
          query: {
            vs_currency: currency,
            from: fromUnix,
            to: nowUnix
          }
        },
        (value) => marketChartSchema.parse(value)
      ),
      fetchJson(
        "price",
        `${this.baseUrl}/simple/price`,
        {
          ...options,
          query: {
            ids: resolvedCoinId,
            vs_currencies: currency,
            include_last_updated_at: true
          }
        },
        (value) => simplePriceSchema.parse(value)
      )
    ]);

    const points = chart.prices.map(([timestamp, price]) => ({
      at: new Date(timestamp).toISOString(),
      price
    }));

    const priceAtFrom = points[0]?.price ?? null;
    const currentPrice = normalizePrice(current[resolvedCoinId]?.[currency]) ?? null;
    const absoluteChange = priceAtFrom !== null && currentPrice !== null ? currentPrice - priceAtFrom : null;
    const returnPct = priceAtFrom !== null && currentPrice !== null && priceAtFrom !== 0 ? ((currentPrice - priceAtFrom) / priceAtFrom) * 100 : null;

    return {
      symbol: input.symbol,
      currency,
      resolvedCoinId,
      from: fromIso,
      asOf: new Date().toISOString(),
      priceAtFrom,
      currentPrice,
      returnPct,
      absoluteChange,
      points
    };
  }
}

export const priceClient = new PriceClient();

