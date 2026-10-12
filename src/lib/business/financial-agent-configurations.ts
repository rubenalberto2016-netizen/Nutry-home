// @polsia:user-owned

export const supervisionLevels = ['Alta', 'Media', 'Baja'] as const;
export type SupervisionLevel = (typeof supervisionLevels)[number];

export type ConfigurationStatus = 'draft' | 'active' | 'inactive' | 'archived';

export type ConfigurationVersion = {
  id: string;
  version: number;
  status: string;
};

export type NewConfigurationInput = {
  rules: string;
  instructions: string;
  supervisionLevel: SupervisionLevel;
};

export function initialConfigurationData(financialAgentId: string, createdByUserId: string) {
  return {
    financialAgentId,
    version: 1,
    rules: '',
    instructions: '',
    supervisionLevel: 'Alta' as const,
    status: 'active' as const,
    createdByUserId,
  };
}

export function nextConfigurationVersion(versions: readonly ConfigurationVersion[]) {
  return versions.reduce((max, version) => Math.max(max, version.version), 0) + 1;
}

export function newDraftConfigurationData(
  financialAgentId: string,
  createdByUserId: string,
  version: number,
  input: NewConfigurationInput,
) {
  return {
    financialAgentId,
    createdByUserId,
    version,
    ...input,
    status: 'draft' as const,
  };
}

export function canActivateConfiguration(
  configuration: ConfigurationVersion,
  activeConfigurationId: string | null,
) {
  return configuration.status !== 'archived' && configuration.id !== activeConfigurationId;
}

export function canArchiveConfiguration(
  configuration: ConfigurationVersion,
  activeConfigurationId: string | null,
) {
  return configuration.status !== 'archived' && configuration.id !== activeConfigurationId;
}
