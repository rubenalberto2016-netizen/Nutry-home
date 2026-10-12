// @polsia:user-owned
'use client';

import type {
  WorkspaceSubmissionAccessList,
  WorkspaceSubmissionDetail,
} from '@/lib/contracts/workspace-security';

export function WorkspaceSecurityAccessPanel({
  detail,
  accessList,
  onRoleChange,
}: {
  detail: WorkspaceSubmissionDetail;
  accessList: WorkspaceSubmissionAccessList | null;
  onRoleChange: (userId: string, value: string) => void;
}) {
  function roleName(role: string) {
    if (role === 'PROPIETARIO') return 'Propietario/a';
    if (role === 'REMITENTE') return 'Remitente';
    if (role === 'LECTOR') return 'Lector';
    return 'Revisor';
  }

  return (
    <aside className="grid content-start gap-4 rounded-md border border-border/70 bg-muted/20 p-4">
      <div>
        <h2 className="font-semibold">Permisos de este expediente</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Lector consulta respuestas y metadatos. Revisor también puede abrir y descargar
          documentos. Solo la persona propietaria administra estas concesiones.
        </p>
      </div>
      <p className="rounded-md border border-border/70 p-3 text-xs leading-5 text-muted-foreground">
        Quien envió este expediente conserva su acceso propio y no aparece como una concesión que se
        pueda retirar.
      </p>
      {detail.access.canManage ? (
        accessList ? (
          accessList.members.length ? (
            <ul className="grid gap-3">
              {accessList.members.map((member) => (
                <li key={member.userId} className="grid gap-2 border-t border-border/70 pt-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {member.name ?? 'Cuenta Vardelume'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email ?? 'Correo no disponible'}
                    </p>
                  </div>
                  <label htmlFor={`access-${member.userId}`} className="text-xs font-medium">
                    Rol en este expediente
                  </label>
                  <select
                    id={`access-${member.userId}`}
                    value={member.role ?? ''}
                    onChange={(event) => onRoleChange(member.userId, event.currentTarget.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Sin acceso</option>
                    <option value="LECTOR">Lector · respuestas y metadatos</option>
                    <option value="REVISOR">Revisor · también abre documentos</option>
                  </select>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay otros miembros a quienes conceder acceso.
            </p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Cargando miembros…</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Tu acceso es {roleName(detail.access.role)}. Solo la persona propietaria cambia permisos;
          quitar una cuenta del equipo revoca también sus concesiones.
        </p>
      )}
    </aside>
  );
}
