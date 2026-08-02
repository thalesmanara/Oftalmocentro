/**
 * Mocks de domínio só podem ser usados quando explicitamente ativados.
 * Produção e desenvolvimento: false por padrão.
 * Services de produção NÃO devem consultar mocks em caso de erro de API.
 */
export function areMocksEnabled(): boolean {
  return String(import.meta.env.VITE_ENABLE_MOCKS).toLowerCase() === 'true'
}
