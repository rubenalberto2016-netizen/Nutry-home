// @polsia:user-owned — the feature comparison matrix under the plan cards. Restyle
// freely, or delete the <PricingComparisonTable/> element from the page and set
// `comparison: null` in src/lib/pricing/content.ts for a cards-only page. Rows and
// columns come from that same content file; columns are keyed by tier id.
//
// Deliberately NOT a client component: it has no state, so it ships zero JS.

import { Check } from 'lucide-react';
import { Fragment } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PricingContent } from '@/lib/pricing/content';

function CellValue({ value }: { value: boolean | string | undefined }) {
  if (typeof value === 'string') return <span>{value}</span>;
  if (value === true) {
    return (
      <>
        <Check aria-hidden="true" className="mx-auto size-4 text-primary" />
        <span className="sr-only">Included</span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" className="text-muted-foreground">
        —
      </span>
      <span className="sr-only">Not included</span>
    </>
  );
}

export function PricingComparisonTable({ content }: { content: PricingContent }) {
  const { comparison, tiers } = content;
  // Nothing to compare — don't render an empty table shell with a heading.
  if (!comparison || comparison.groups.length === 0 || tiers.length === 0) return null;

  return (
    <section aria-labelledby="pricing-comparison" className="flex flex-col gap-4">
      <h2 id="pricing-comparison" className="font-display text-2xl font-semibold tracking-tight">
        {comparison.title ?? 'Compare plans'}
      </h2>
      {comparison.description ? (
        <p className="text-muted-foreground">{comparison.description}</p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/3">Features</TableHead>
            {/* scope="col" so a screen reader announces the plan a cell belongs to. */}
            {tiers.map((tier) => (
              <TableHead key={tier.id} scope="col" className="text-center">
                {tier.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {comparison.groups.map((group) => (
            <Fragment key={group.label}>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={tiers.length + 1} className="font-medium">
                  {group.label}
                </TableCell>
              </TableRow>
              {group.rows.map((row) => (
                <TableRow key={`${group.label}:${row.label}`}>
                  <TableHead scope="row" className="font-normal text-foreground">
                    {row.label}
                  </TableHead>
                  {tiers.map((tier) => (
                    <TableCell key={tier.id} className="text-center">
                      <CellValue value={row.values[tier.id]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
