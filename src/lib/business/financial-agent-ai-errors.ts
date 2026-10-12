// @polsia:user-owned
// Error controlado para fallos del proxy de IA en traducción y OCR.
export class FinancialAgentAiProxyError extends Error {
  constructor() {
    super('El servicio de IA no respondió correctamente.');
    this.name = 'FinancialAgentAiProxyError';
  }
}
