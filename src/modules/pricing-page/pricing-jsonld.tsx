// @polsia:framework-owned — DO NOT EDIT. The one SEO piece this module governs.
//
// Render <PricingJsonLd .../> once on the pricing page. It emits a
// <script type="application/ld+json"> Product node whose Offers are built from the
// plans you pass in, so the structured data can never drift from the prices the
// page displays. KEEP THIS ELEMENT ON THE PAGE when you restyle — it is what makes
// the pricing machine-readable to search engines and AI answer engines.
//
// Schema choice: Product + Offer. One priced plan emits a single `Offer`; several
// emit an `AggregateOffer` carrying lowPrice/highPrice, which is what powers a
// "from $X" price snippet. A recurring plan additionally carries a
// `UnitPriceSpecification` so the billing period is explicit rather than implied
// by the visible "/month" suffix.

// Minimal input contract: deliberately decoupled from the user-owned PricingTier
// shape, so extending the content types in src/lib/pricing/content.ts never breaks
// the schema.
export type PricingJsonLdOffer = {
  /** Plan name, e.g. 'Pro'. */
  name: string;
  /** Price actually charged, in MAJOR currency units (29 = $29.00) — never cents. */
  price: number;
  /** Price before the discount, in MAJOR units. Emitted as a `ListPrice` spec — the
   *  strikethrough-pricing signal — but ONLY when strictly higher than `price`. */
  originalPrice?: number;
  /** Recurring billing period. OMIT for a one-time charge (lifetime deal, course,
   *  setup fee): the Offer then carries no billing period at all. */
  interval?: 'month' | 'year';
  /** URL for this plan (absolute, or the pricing page anchor). */
  url?: string;
  /** One-line plan summary. */
  description?: string;
};

// UN/CEFACT common codes for the period a subscription price is billed per.
const INTERVAL_UNIT_CODE: Record<'month' | 'year', string> = { month: 'MON', year: 'ANN' };

function buildOffer(offer: PricingJsonLdOffer, currency: string) {
  const specs = [];

  // Strikethrough pricing. Guarded: an "original" that isn't above the charged
  // price is a content mistake, and publishing it would be a false discount claim.
  if (typeof offer.originalPrice === 'number' && offer.originalPrice > offer.price) {
    specs.push({
      '@type': 'UnitPriceSpecification',
      priceType: 'https://schema.org/ListPrice',
      price: offer.originalPrice,
      priceCurrency: currency,
    });
  }

  // Recurring only. A one-time charge carries NO billing period — emitting one
  // would advertise a subscription the customer is never charged for.
  if (offer.interval) {
    specs.push({
      '@type': 'UnitPriceSpecification',
      price: offer.price,
      priceCurrency: currency,
      // How long this price is billed for: 1 MON (month) or 1 ANN (year).
      // schema.org: when billingDuration is a Number, "the unit of measurement,
      // for example month, is specified by the unitCode property".
      // Deliberately NO billingIncrement — that property is the minimal QUANTITY
      // and rounding increment for billing, not a period, so it says nothing here.
      billingDuration: 1,
      unitCode: INTERVAL_UNIT_CODE[offer.interval],
    });
  }

  return {
    '@type': 'Offer',
    name: offer.name,
    price: offer.price,
    priceCurrency: currency,
    availability: 'https://schema.org/InStock',
    ...(offer.description ? { description: offer.description } : {}),
    ...(offer.url ? { url: offer.url } : {}),
    ...(specs.length === 1 ? { priceSpecification: specs[0] } : {}),
    ...(specs.length > 1 ? { priceSpecification: specs } : {}),
  };
}

export function PricingJsonLd({
  name,
  description,
  brand,
  url,
  currency = 'USD',
  offers,
}: {
  /** Product name the plans belong to — usually the site/product name. */
  name: string;
  description?: string;
  /** Brand name, if different from the product name. */
  brand?: string;
  /** Absolute URL of the pricing page. */
  url?: string;
  /** ISO 4217 code, e.g. 'USD'. Must match the prices you pass. */
  currency?: string;
  offers: readonly PricingJsonLdOffer[];
}) {
  // Only plans with a usable, non-negative number become Offers. A "contact us"
  // tier has no machine-readable price, and an Offer whose price is missing, NaN
  // or negative is invalid structured data — never publish one.
  const priced = offers.filter((offer) => Number.isFinite(offer.price) && offer.price >= 0);
  const built = priced.map((offer) => buildOffer(offer, currency));
  const prices = priced.map((offer) => offer.price);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(description ? { description } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(url ? { url } : {}),
    ...(built.length === 1 ? { offers: built[0] } : {}),
    ...(built.length > 1
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: currency,
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: built.length,
            offers: built,
          },
        }
      : {}),
  };

  // Escape raw-text terminators before putting JSON in the script element. Rendering
  // it as a text child keeps the template compatible with the customer's Biome gate
  // without using unsafe HTML injection.
  const jsonLd = JSON.stringify(schema)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  // A type="application/ld+json" block is DATA, not an executable script, so the
  // template's strict CSP script-src does not apply and it needs no nonce.
  return <script type="application/ld+json">{jsonLd}</script>;
}
