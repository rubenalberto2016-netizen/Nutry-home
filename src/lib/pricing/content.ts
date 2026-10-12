// @polsia:user-owned — pricing content AND its shape. Rewrite the plans, prices,
// features, comparison rows and reassurance copy below to match the app. You may
// also EXTEND these types (e.g. add a `seatLimit` to PricingTier) for a richer
// layout — the sealed <PricingJsonLd> reads only name/price/interval/url, so
// extending is safe. This is your content file.
//
// MONEY REPRESENTATION: prices are plain numbers in MAJOR currency units — 29
// means $29.00, never 2900 cents. Same unit as stripe-billing's `amountUsd`, so a
// tier price feeds `createCheckoutSession({ amountUsd })` with no conversion.

/**
 * Recurring billing periods. Limited to month/year on purpose: those are the only
 * intervals `stripe-billing` can actually charge, so a third value here would
 * render a plan nobody can buy.
 */
export type BillingInterval = 'month' | 'year';

/** Precio mensual publicado y validado también contra el plan de PayPal. */
export const TEAM_MONTHLY_PRICE = 47;

/** A price with an optional discount. Use the object form to show a strikethrough. */
export interface PricingAmount {
  /** What the customer is charged, in MAJOR currency units. */
  amount: number;
  /** Price before the discount, in MAJOR units. Renders struck through and is
   *  emitted as a `ListPrice` in the structured data. Ignored when it is not
   *  strictly higher than `amount` — a fake discount must not reach the markup. */
  originalAmount?: number;
  /** Short badge beside the price, e.g. '-20%' or 'Launch offer'. */
  discountNote?: string;
}

/** Either a plain amount (`29`) or an amount carrying its discount. */
export type PricingPrice = number | PricingAmount;

/**
 * Wire a tier's button to a real checkout instead of a link.
 *
 * ONLY set this when the `stripe-billing` module is installed. It ships
 * POST /api/stripe-billing/checkout, which takes `{ productId }`, prices it
 * SERVER-side and returns `{ url }`.
 *
 * NO stripe-billing => NO checkout. Leave `checkout` unset and the button stays a
 * plain link to `href` (signup, contact, waitlist). Do NOT point `endpoint` at a
 * route you wrote yourself, at a hosted payment link, or at anything else: this
 * module owns no payment logic and must not grow any.
 */
export interface PricingCheckout {
  /** Route that creates the checkout session. */
  endpoint: string;
  /** Product id per billing period — plus `oneTime` for a single-charge tier.
   *  Must match the checkout route's catalog/DB. */
  productIds: Partial<Record<BillingInterval | 'oneTime', string>>;
}

export interface PricingCta {
  label: string;
  /** Where the button goes when there is no `checkout` (or no id for the interval). */
  href: string;
  checkout?: PricingCheckout;
}

export interface PricingTier {
  /** Stable id — the card's DOM anchor and the comparison column key. MUST be
   *  unique across tiers and URL-safe (lowercase, no spaces): duplicates produce
   *  duplicate DOM ids and two plan URLs that collide in the structured data. */
  id: string;
  name: string;
  description?: string;
  /** `'recurring'` (the default) bills every period and follows the billing switch.
   *  `'one-time'` is a single charge — lifetime deal, course, setup fee — which
   *  ignores the switch, reads `price` instead of `prices`, and is emitted with no
   *  billing period in the structured data. */
  billing?: 'recurring' | 'one-time';
  /** Recurring price per billing period, in MAJOR currency units. Omit a period to
   *  hide the tier's price on that tab. Omit entirely for a quote-only tier. */
  prices?: Partial<Record<BillingInterval, PricingPrice>>;
  /** The single charge, in MAJOR currency units. Used when `billing` is 'one-time'. */
  price?: PricingPrice;
  /** Prefix before the amount, e.g. 'From' for usage-based or per-seat pricing.
   *  Display only — the structured data still carries the exact number. */
  pricePrefix?: string;
  /** Overrides the displayed price text (e.g. 'Free', 'Custom'). Does NOT change
   *  the structured data — `prices`/`price` still drive the JSON-LD Offers. */
  priceLabel?: string;
  /** Per-UNIT qualifier under the price, e.g. 'per user' or 'per 1,000 requests'.
   *  Display only. Do NOT repeat the billing period here — the card already renders
   *  '/month' or '/year' beside the amount, so `unit: 'per month'` comes out as
   *  "€2,400 /month per month". Leave it unset when the price is not per-unit. */
  unit?: string;
  /** Small line under the button — trial terms, 'billed annually', tax notes. */
  note?: string;
  features: string[];
  /** Visually promote this tier. */
  highlighted?: boolean;
  /** Small label on the card, e.g. 'Most popular'. */
  badge?: string;
  cta: PricingCta;
}

export interface PricingComparisonRow {
  label: string;
  /** Value per tier, keyed by `PricingTier.id`. `true` renders a check, `false`
   *  or a missing key renders a dash, a string renders as text. */
  values: Record<string, boolean | string>;
}

export interface PricingComparisonGroup {
  label: string;
  rows: PricingComparisonRow[];
}

export interface PricingComparison {
  title?: string;
  description?: string;
  groups: PricingComparisonGroup[];
}

export interface PricingContent {
  /** Small label above the H1. */
  eyebrow?: string;
  title: string;
  intro?: string;
  /** Display + structured-data currency. **USD only, deliberately.**
   *
   *  It is a literal type, not a free ISO 4217 code, so writing anything else
   *  fails `npm run typecheck` instead of shipping a mispriced page. The reason:
   *  stripe-billing charges in USD only — its amount field is `amountUsd` and it
   *  takes no currency parameter — so a page priced in EUR would display €29 and
   *  charge $29 with no conversion (100x+ off in JPY/HUF).
   *
   *  Do NOT widen this type to sell in another currency, and do NOT convert
   *  amounts by hand while displaying another symbol. Both ship a page whose
   *  visible price is not what the customer is charged. It widens for real the
   *  day stripe-billing supports a currency parameter. */
  currency: 'USD';
  /** BCP-47 tag for price formatting. Explicit on purpose: an implicit runtime
   *  locale differs between server and client and would break hydration. */
  locale: string;
  /** Billing tabs to offer. A single entry hides the switch. */
  intervals: BillingInterval[];
  /** The interval selected on load, and the one the JSON-LD Offers describe. */
  defaultInterval: BillingInterval;
  /** Note beside the billing switch, e.g. 'Save 2 months'. */
  intervalNote?: string;
  tiers: PricingTier[];
  /** Feature matrix under the cards, or `null` to hide it. */
  comparison: PricingComparison | null;
  /** Short trust lines under the plans (refunds, cancellation, security). */
  reassurance: string[];
  /** Fine print under everything. */
  footnote?: string;
}

export const pricingContent: PricingContent = {
  eyebrow: 'Un espacio compartido para tu equipo',
  title: 'Un plan mensual. Tu equipo, en el mismo espacio.',
  intro:
    'Configura borradores de agentes financieros y permite que tu equipo consulte el trabajo desde un único espacio de Vardelume.',
  currency: 'USD',
  locale: 'en-US',
  intervals: ['month'],
  defaultInterval: 'month',
  tiers: [
    {
      id: 'equipo-mensual',
      name: 'Equipo',
      description: 'Acceso mensual al espacio de trabajo de Vardelume.',
      prices: { month: TEAM_MONTHLY_PRICE },
      note: 'Sin prueba gratuita. El acceso se habilita después de confirmar el pago.',
      features: [
        'Un espacio de trabajo por cuenta propietaria',
        'Borradores de agentes financieros compartidos con el equipo',
        'Miembros con cuenta Vardelume y correo verificado',
        'La persona propietaria administra miembros y pagos',
      ],
      highlighted: true,
      badge: 'Mensual',
      cta: { label: 'Continuar con PayPal', href: '/signup' },
    },
  ],
  comparison: null,
  reassurance: [
    'La renovación se cancela desde el panel del propietario',
    'La aprobación o el regreso desde PayPal no activa el acceso',
    'Los pagos se procesan en la cuenta PayPal del comercio',
  ],
  footnote: `US$${TEAM_MONTHLY_PRICE} USD por mes, con renovación mensual. El plan de PayPal debe estar activo y coincidir con ese importe y frecuencia, sin prueba gratuita ni tarifa de alta. Impuestos y condiciones de PayPal pueden aplicar.`,
};

/**
 * Money carries at most 2 decimals, so the price on the card and the price in the
 * structured data round to the exact same number. Without this, `19.995` displays
 * as "$20" while the markup says 19.995 — the mismatch search engines penalise.
 */
function toMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The amount a tier charges at the selected billing period, or `undefined` when it
 * is quote-only. One-time tiers ignore the period and read `price`.
 *
 * Single source of truth for both the cards and the page's structured data, so the
 * markup can never advertise a price the page does not display.
 */
export function tierAmount(
  tier: PricingTier,
  interval: BillingInterval,
): PricingAmount | undefined {
  const price = tier.billing === 'one-time' ? tier.price : tier.prices?.[interval];
  if (price === undefined) return undefined;
  const raw = typeof price === 'number' ? { amount: price } : price;
  // Anything that is not a usable, non-negative number counts as "no price": the
  // card falls back to `priceLabel`/'—' and the tier stays out of the structured
  // data. Better than rendering "$NaN" or publishing a negative Offer.
  if (!Number.isFinite(raw.amount) || raw.amount < 0) return undefined;
  const original =
    raw.originalAmount !== undefined &&
    Number.isFinite(raw.originalAmount) &&
    raw.originalAmount >= 0
      ? toMoney(raw.originalAmount)
      : undefined;
  return { ...raw, amount: toMoney(raw.amount), originalAmount: original };
}

/**
 * Formats a major-unit amount for display. Whole prices read as "$29", not
 * "$29.00"; amounts with cents keep both decimals.
 */
export function formatPrice(amount: number, content: PricingContent = pricingContent): string {
  try {
    return new Intl.NumberFormat(content.locale, {
      style: 'currency',
      currency: content.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    // Intl throws a RangeError on an invalid locale tag (the currency is pinned
    // to 'USD' by the type). A typo here must degrade to a readable price rather
    // than 500 the whole pricing page.
    return `${amount} ${content.currency}`;
  }
}
