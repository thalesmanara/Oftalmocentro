/**
 * Shared admin webhook auth skeleton factory for AI prompt governance.
 * Usage: node -e "..." or import buildAdminWebhook(...)
 */
export function authSkeletonParts() {
  const respondHeaders = {
    entries: [
      {
        name: 'X-Request-Id',
        value:
          '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}',
      },
      {
        name: 'X-Response-Time-Ms',
        value:
          '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}',
      },
    ],
  };
  return { respondHeaders, restoreJs: "return [$('Normalizar request').first()];" };
}

export const IDS = {
  NORMALIZAR: 'N3zLpj7Dij4n5p5p',
  AUTH: 'P5E43ZXSJiI9wFYD',
  PERM: 'yXW3rW8EbHXuprRJ',
  SUCESSO: 'zE5LRjZfbXw8Ymll',
  ERRO: 'r3iSBV1ClKOxS2UI',
  AUDITORIA: 'jtQvQlqRZ5X5WF9I',
  CARREGAR: 'OSopSf635RVwD65J',
  VALIDAR: 'HT0aD7hn73HybpFT',
  PUBLICAR: 'L8FL9uMkcqiVpskV',
  ROLLBACK: 'dziymkwKvfYJmBUp',
  COMPARAR: 'YvAfAD0LSYFEqCqp',
};
