import { describe, expect, it } from 'vitest';
import {
  canActivateConfiguration,
  canArchiveConfiguration,
  initialConfigurationData,
  newDraftConfigurationData,
  nextConfigurationVersion,
} from '@/lib/business/financial-agent-configurations';

describe('configuración versionada de agentes financieros', () => {
  it('crea una primera versión activa con el nivel conservador y textos vacíos', () => {
    expect(initialConfigurationData('agent-1', 'owner-1')).toEqual({
      financialAgentId: 'agent-1',
      version: 1,
      rules: '',
      instructions: '',
      supervisionLevel: 'Alta',
      status: 'active',
      createdByUserId: 'owner-1',
    });
  });

  it('calcula el siguiente número a partir del máximo, aunque haya huecos', () => {
    expect(
      nextConfigurationVersion([
        { id: 'v1', version: 1, status: 'active' },
        { id: 'v3', version: 3, status: 'archived' },
      ]),
    ).toBe(4);
    expect(nextConfigurationVersion([])).toBe(1);
  });

  it('crea una edición como borrador sin modificar la configuración anterior', () => {
    const draft = newDraftConfigurationData('agent-1', 'owner-1', 2, {
      rules: 'Regla propuesta',
      instructions: 'Instrucción propuesta',
      supervisionLevel: 'Media',
    });

    expect(draft).toMatchObject({
      financialAgentId: 'agent-1',
      createdByUserId: 'owner-1',
      version: 2,
      status: 'draft',
      rules: 'Regla propuesta',
      instructions: 'Instrucción propuesta',
      supervisionLevel: 'Media',
    });
  });

  it('permite activar versiones inactivas o en borrador y rechaza las archivadas o activas', () => {
    expect(canActivateConfiguration({ id: 'v2', version: 2, status: 'draft' }, 'v1')).toBe(true);
    expect(canActivateConfiguration({ id: 'v1', version: 1, status: 'inactive' }, 'v2')).toBe(true);
    expect(canActivateConfiguration({ id: 'v3', version: 3, status: 'archived' }, 'v2')).toBe(false);
    expect(canActivateConfiguration({ id: 'v2', version: 2, status: 'active' }, 'v2')).toBe(false);
  });

  it('impide archivar la versión activa y conserva el archivo de versiones anteriores', () => {
    expect(canArchiveConfiguration({ id: 'v1', version: 1, status: 'active' }, 'v1')).toBe(false);
    expect(canArchiveConfiguration({ id: 'v2', version: 2, status: 'inactive' }, 'v1')).toBe(true);
    expect(canArchiveConfiguration({ id: 'v3', version: 3, status: 'archived' }, 'v1')).toBe(false);
  });
});
