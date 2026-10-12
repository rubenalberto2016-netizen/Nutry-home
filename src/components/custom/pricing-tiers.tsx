// @polsia:user-owned — the plan cards and the monthly/yearly switch. Restyle this
// freely: change the grid, the card chrome, swap the tabs for a toggle. It renders
// the SAME prices the page emits as JSON-LD, so changing the LOOK here never
// affects the structured data. Edit the plans in src/lib/pricing/content.ts.
//
// ONE LAYOUT RULE, and it is about vertical rhythm. A plan card is a dense,
// scannable list that a visitor compares against the card next to it — not a page
// section. Restyle colors, borders, radii, typography and the highlight treatment
// as much as you like (none of that changes the card's height), but keep the
// INSIDE spacing on the small end of the scale (gap-2/gap-3). Bumping the feature
// list to gap-6+ doubles the card height for no information gained and pushes the
// CTA below the fold. Seen in production: gap-8 on both the list and its rows.
'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type BillingInterval,
  formatPrice,
  type PricingContent,
  type PricingTier,
  tierAmount,
} from '@/lib/pricing/content';
import { cn } from '@/lib/utils';

const INTERVAL_LABEL: Record<BillingInterval, string> = { month: 'Monthly', year: 'Yearly' };
const INTERVAL_SUFFIX: Record<BillingInterval, string> = { month: '/month', year: '/year' };
const ONE_TIME_SUFFIX = 'one-time';

export function PricingTiers({ content }: { content: PricingContent }) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(content.defaultInterval);
  // Which tier is mid-redirect to checkout, so only its button shows a pending state.
  const [pendingTierId, setPendingTierId] = useState<string | null>(null);

  // Posts to the checkout route (stripe-billing prices the plan SERVER-side and
  // returns the hosted checkout URL), then hands the browser over to it.
  //
  // This is the ONLY payment path. If the response isn't a usable `{ url }`, the
  // click ends here: no fallback, no improvised payment page. A 404 in particular
  // means the checkout route does not exist — stripe-billing is not installed — so
  // it says so instead of inviting a pointless retry. The fix is to install
  // stripe-billing, never to hand-roll a checkout.
  async function startCheckout(tier: PricingTier, endpoint: string, productId: string) {
    setPendingTierId(tier.id);
    let message = 'Checkout is unavailable right now. Please try again.';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data: { url?: string } | null = await response.json().catch(() => null);
      if (response.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      if (response.status === 404) message = 'Checkout is not set up yet.';
    } catch {
      // Network failure — keep the generic message.
    }
    toast.error(message);
    setPendingTierId(null);
  }

  // The switch only makes sense when something is actually billed per period. An
  // all-one-time page (lifetime deals, courses) shows no switch at all.
  const hasRecurringTier = content.tiers.some((tier) => tier.billing !== 'one-time');

  // Backstop. `PricingContent['currency']` is the literal 'USD', so this is already
  // guaranteed by the type — but the content file is user-owned, and widening that
  // type is the one edit that would silently misprice every plan: stripe-billing
  // charges `amountUsd` and takes no currency parameter, so €2,400 displayed would
  // be $2,400 taken (100x+ off in JPY/HUF). If the type is ever widened, the CTA
  // falls back to a plain link rather than charging the wrong money. See AGENT.md.
  const checkoutCurrencySupported = String(content.currency).toUpperCase() === 'USD';

  return (
    <div className="flex flex-col gap-8">
      {content.intervals.length > 1 && hasRecurringTier ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Tabs
            value={billingInterval}
            onValueChange={(value) => setBillingInterval(value as BillingInterval)}
          >
            <TabsList aria-label="Billing period">
              {content.intervals.map((interval) => (
                <TabsTrigger key={interval} value={interval}>
                  {INTERVAL_LABEL[interval]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {content.intervalNote ? <Badge variant="secondary">{content.intervalNote}</Badge> : null}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {content.tiers.map((tier) => {
          const isOneTime = tier.billing === 'one-time';
          const amount = tierAmount(tier, billingInterval);
          const priceText =
            tier.priceLabel ?? (amount === undefined ? '—' : formatPrice(amount.amount, content));
          // The "/month" suffix belongs to a real number, not to 'Free' or 'Custom'.
          const suffix = tier.priceLabel === undefined && amount !== undefined;
          // Only a genuine markdown renders struck through — same rule the sealed
          // JSON-LD applies, so the badge and the markup can never disagree.
          const original =
            amount?.originalAmount !== undefined && amount.originalAmount > amount.amount
              ? amount.originalAmount
              : undefined;
          const endpoint = tier.cta.checkout?.endpoint;
          // A one-time tier is a different product id than any subscription.
          const productId = tier.cta.checkout?.productIds[isOneTime ? 'oneTime' : billingInterval];
          const isPending = pendingTierId === tier.id;

          return (
            <Card
              key={tier.id}
              id={tier.id}
              className={cn(
                'flex h-full scroll-mt-20 flex-col',
                tier.highlighted ? 'border-primary shadow-md' : 'shadow-sm',
              )}
            >
              <CardHeader className="gap-3">
                <div className="flex min-h-6 items-center justify-between gap-3">
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  {tier.badge ? (
                    <Badge variant={tier.highlighted ? 'default' : 'secondary'}>{tier.badge}</Badge>
                  ) : null}
                </div>
                {tier.description ? <CardDescription>{tier.description}</CardDescription> : null}
                <div className="flex flex-wrap items-end gap-2 pt-2">
                  {tier.pricePrefix && !tier.priceLabel ? (
                    <span className="pb-1 text-sm font-medium text-muted-foreground">
                      {tier.pricePrefix}
                    </span>
                  ) : null}
                  {original !== undefined ? (
                    <span className="pb-1 text-lg text-muted-foreground">
                      <span className="sr-only">Regular price</span>
                      <s className="line-through">{formatPrice(original, content)}</s>
                    </span>
                  ) : null}
                  <span className="font-display text-4xl font-semibold tracking-tight">
                    {priceText}
                  </span>
                  {suffix ? (
                    <span className="pb-1 text-sm font-medium text-muted-foreground">
                      {isOneTime ? ONE_TIME_SUFFIX : INTERVAL_SUFFIX[billingInterval]}
                    </span>
                  ) : null}
                  {amount?.discountNote ? (
                    <Badge variant="secondary" className="mb-1">
                      {amount.discountNote}
                    </Badge>
                  ) : null}
                </div>
                {tier.unit ? <p className="text-sm text-muted-foreground">{tier.unit}</p> : null}
              </CardHeader>

              <CardContent className="flex-1">
                {/* gap-3 between rows, gap-2 between the check and its label. Keep
                    both small: the icon gap BINDS the tick to its text (a wide one
                    unpairs them), and the row gap drives the whole card's height. */}
                <ul className="grid gap-3 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="flex-col items-stretch gap-2">
                {endpoint && productId && checkoutCurrencySupported ? (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    variant={tier.highlighted ? 'default' : 'secondary'}
                    disabled={isPending}
                    onClick={() => {
                      startCheckout(tier, endpoint, productId);
                    }}
                  >
                    {isPending ? 'Redirecting…' : tier.cta.label}
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    className="w-full"
                    variant={tier.highlighted ? 'default' : 'secondary'}
                  >
                    <Link href={tier.cta.href}>{tier.cta.label}</Link>
                  </Button>
                )}
                {tier.note ? (
                  <p className="text-center text-xs text-muted-foreground">{tier.note}</p>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
