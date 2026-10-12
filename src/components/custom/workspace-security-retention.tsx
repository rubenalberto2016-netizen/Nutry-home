// @polsia:user-owned
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateDocumentExpiry, type RetentionDays } from '@/lib/business/document-retention';
import type { WorkspaceDocumentRetentionState } from '@/lib/contracts/workspace-security';

const retentionChoices: { value: string; label: string; days: RetentionDays }[] = [
  { value: 'manual', label: 'Sin vencimiento automático', days: null },
  { value: '30', label: '30 días desde la carga', days: 30 },
  { value: '90', label: '90 días desde la carga', days: 90 },
  { value: '180', label: '180 días desde la carga', days: 180 },
  { value: '365', label: '365 días desde la carga', days: 365 },
];

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function WorkspaceSecurityRetentionPanel({
  data,
  selectedValue,
  onSelect,
  onSave,
  saving,
}: {
  data: WorkspaceDocumentRetentionState | null;
  selectedValue: string;
  onSelect: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const selectedChoice = retentionChoices.find((choice) => choice.value === selectedValue);
  const currentValue = data?.retentionDays === null ? 'manual' : String(data?.retentionDays);

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="font-display text-xl">Retención de documentos</CardTitle>
        <CardDescription>
          Los plazos se cuentan desde la fecha de carga. Al vencer, se borran los bytes y se
          conserva la ficha del documento y el evento de auditoría. El proceso revisa vencimientos
          cada día a las 08:00 UTC.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 border-t border-border/70 pt-5">
        {!data?.canManage ? (
          <p className="text-sm text-muted-foreground">
            {data?.workspaceId ? (
              <>
                Política actual:{' '}
                {data.retentionDays
                  ? `${data.retentionDays} días desde la carga`
                  : 'sin vencimiento automático'}
                . Solo la persona propietaria puede cambiarla.
              </>
            ) : (
              'El espacio todavía no tiene una política de retención.'
            )}
          </p>
        ) : (
          <>
            <div className="grid gap-2">
              <label htmlFor="retention-days" className="text-sm font-medium">
                Política del espacio
              </label>
              <select
                id="retention-days"
                value={selectedValue}
                onChange={(event) => onSelect(event.currentTarget.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-xl"
              >
                {retentionChoices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedChoice?.days === null ? (
              <p className="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
                No se programarán eliminaciones automáticas. Los documentos se conservan sin fecha
                de vencimiento.
              </p>
            ) : (
              <div className="grid gap-2 rounded-md border border-border/70 p-3">
                <p className="text-sm font-medium">
                  {data.documents.length} documentos existentes entrarían en esta política.
                </p>
                <p className="text-xs text-muted-foreground">
                  Fechas de elegibilidad calculadas desde cada carga:
                </p>
                {data.documents.length ? (
                  <ul className="grid gap-2">
                    {data.documents.map((document) => {
                      const expiresAt = selectedChoice
                        ? calculateDocumentExpiry(
                            new Date(document.uploadedAt),
                            selectedChoice.days,
                          )
                        : null;
                      return (
                        <li
                          key={document.id}
                          className="flex flex-col justify-between gap-1 text-xs sm:flex-row sm:gap-4"
                        >
                          <span className="truncate">{document.fileName}</span>
                          <time
                            dateTime={expiresAt?.toISOString()}
                            className="shrink-0 text-muted-foreground"
                          >
                            {expiresAt ? formatDate(expiresAt) : 'Sin vencimiento'}
                          </time>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay documentos con bytes guardados que puedan vencer.
                  </p>
                )}
              </div>
            )}
            {data.updatedAt ? (
              <p className="text-xs text-muted-foreground">
                Último cambio: {formatDate(data.updatedAt)}
              </p>
            ) : null}
            <div>
              <Button
                type="button"
                onClick={onSave}
                disabled={saving || selectedValue === currentValue}
              >
                {saving ? 'Guardando…' : 'Guardar política'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
