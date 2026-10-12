// @polsia:user-owned
import type { Metadata } from 'next';
import { CohortEnrollmentResult } from '@/components/custom/cohort-enrollment-result';

export const metadata: Metadata = {
  title: 'Estado de inscripción',
  description: 'Consulta el estado de solicitud, pago y acceso a la cohorte educativa.',
};

type PageSearchParams = {
  session_id?: string | string[];
  request_id?: string | string[];
  cancelled?: string | string[];
};

function single(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : null;
}

export default async function CohortEnrollmentResultPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto grid min-h-[65vh] w-full max-w-5xl content-center gap-8 px-5 py-12 sm:px-8">
      <CohortEnrollmentResult
        sessionId={single(params.session_id)}
        requestId={single(params.request_id)}
        cancelled={params.cancelled === '1'}
      />
    </main>
  );
}
