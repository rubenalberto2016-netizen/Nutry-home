// @polsia:user-owned
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkspaceAccessEventList } from '@/lib/contracts/workspace-security';

const actionLabels: Record<WorkspaceAccessEventList['items'][number]['action'], string> = {
  SUBMISSION_OPENED: 'Abrió un expediente',
  DOCUMENT_OPENED: 'Abrió un documento',
  ACCESS_GRANTED: 'Concedió acceso',
  ACCESS_CHANGED: 'Cambió un permiso',
  ACCESS_REVOKED: 'Revocó un permiso',
  RETENTION_CHANGED: 'Cambió la retención',
  DOCUMENT_DELETED: 'Eliminó bytes por retención',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatRole(role: string) {
  return role === 'LECTOR' ? 'Lector' : 'Revisor';
}

function formatRetention(days: number | null) {
  return days === null ? 'Sin vencimiento automático' : `${days} días desde la carga`;
}

export function WorkspaceSecurityEventsPanel({ data }: { data: WorkspaceAccessEventList | null }) {
  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="font-display text-xl">Historial de accesos</CardTitle>
        <CardDescription>
          Se registran las aperturas autorizadas, concesiones, cambios de política y eliminaciones
          automáticas. Las respuestas y los bytes no se copian al historial.
        </CardDescription>
      </CardHeader>
      <CardContent className="border-t border-border/70 pt-5">
        {!data ? (
          <p className="text-sm text-muted-foreground">Cargando historial…</p>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay eventos de acceso en este espacio.
          </p>
        ) : (
          <ol className="grid gap-3">
            {data.items.map((event) => (
              <li
                key={event.id}
                className="grid gap-1 rounded-md border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{actionLabels[event.action]}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {event.actorName ??
                      event.actorEmail ??
                      event.actorLabel ??
                      event.actorUserId ??
                      'Sistema'}
                    {event.action === 'ACCESS_GRANTED' || event.action === 'ACCESS_CHANGED'
                      ? ` · ${event.previousRole ? formatRole(event.previousRole) : 'Sin acceso'} → ${event.newRole ? formatRole(event.newRole) : 'Sin acceso'}`
                      : ''}
                    {event.action === 'ACCESS_REVOKED'
                      ? ` · ${event.previousRole ? formatRole(event.previousRole) : 'Concesión'} → Sin acceso`
                      : ''}
                    {event.action === 'RETENTION_CHANGED'
                      ? ` · ${formatRetention(event.previousRetentionDays)} → ${formatRetention(event.newRetentionDays)}`
                      : ''}
                    {event.submissionName ? ` · ${event.submissionName}` : ''}
                    {event.action === 'RETENTION_CHANGED' ? ' · Política del espacio' : ''}
                    {event.documentName ? ` · ${event.documentName}` : ''}
                    {event.subjectName || event.subjectEmail
                      ? ` · Afecta a ${event.subjectName ?? event.subjectEmail}`
                      : ''}
                  </p>
                </div>
                <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">
                  {formatDate(event.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
