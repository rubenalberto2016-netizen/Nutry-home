// @polsia:user-owned
//
// POST /api/contact — plain REST route handler that writes a ContactMessage and
// then surfaces it in the founder's Polsia dashboard, so a submission is actually
// READ by someone — and can be answered.
// Lives under /api, which proxy.ts's matcher excludes (no CSP/nonce, not proxied).
// PUBLIC — no auth check.
//
// Requires the `email` module (@/lib/email/submissions + send + templates).

import 'server-only';
import { NextResponse } from 'next/server';
import { contactSchema } from '@/lib/contact/schema';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { recordSubmission } from '@/lib/email/submissions';
import { notificationEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json();
  const result = contactSchema.safeParse({
    name: body.name,
    email: body.email,
    message: body.message,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return NextResponse.json(
      {
        errors: {
          name: fieldErrors.name?.[0],
          email: fieldErrors.email?.[0],
          message: fieldErrors.message?.[0],
        },
      },
      { status: 400 },
    );
  }

  let saved: { id: string };
  try {
    saved = await prisma.contactMessage.create({ data: result.data });
  } catch {
    return NextResponse.json(
      { errors: { message: 'Something went wrong. Please try again.' } },
      { status: 500 },
    );
  }

  await notifyCompany(result.data, saved.id);

  return NextResponse.json({ ok: true }, { status: 201 });
}

/**
 * Surface the message to the founder. The row above is already committed and is
 * the source of truth, so this whole function is best-effort by design: a
 * rate-limited or failing call must never turn a captured message into an error
 * for the visitor.
 *
 * Two paths, in order:
 *
 *  1. `recordSubmission` — the good one. Records the message in the Polsia
 *     dashboard as a message FROM the visitor, so it lands in the dashboard's
 *     contact-form view and the founder can REPLY to the person who wrote it.
 *  2. The email fallback, used only when step 1 recorded nothing (`recorded:
 *     false` = company not ramped, or a deployment older than the endpoint) or
 *     threw. Mails the company's own inbox (`{slug}@polsia.app`). The founder
 *     still hears about the message, but cannot reply from the dashboard: the
 *     proxy sets no custom Reply-To, so the mail arrives From the company
 *     itself. That is why the sender's address goes in the BODY.
 *
 * Never a made-up brand address (`contact@brand.com`) or a placeholder — both go
 * nowhere.
 */
async function notifyCompany(
  input: { name: string; email: string; message: string },
  submissionId: string,
) {
  try {
    const { recorded } = await recordSubmission({
      source: 'contact_form',
      email: input.email,
      name: input.name,
      message: input.message,
      // The row id — dedupes a retried submission on the platform side.
      idempotencyKey: submissionId,
    });
    if (recorded) return;
  } catch {
    // Anomaly (validation, cap, transport). Fall through to the email fallback
    // rather than lose the notification.
  }

  // Absent when the company has no inbox address yet — nothing to fall back to.
  const to = env.POLSIA_COMPANY_EMAIL;
  if (!to) return;

  try {
    await sendEmail({
      to,
      ...notificationEmail({
        subject: `New contact message from ${input.name}`,
        title: 'New contact message',
        lines: [`From: ${input.name} <${input.email}>`, input.message],
      }),
    });
  } catch {
    // Deliberately swallowed — see the best-effort note above.
  }
}
