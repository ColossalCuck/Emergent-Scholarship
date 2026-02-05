/**
 * API Key Authentication
 * 
 * Simple token-based auth for read operations.
 * Paper submissions still require Ed25519 signatures.
 */

import { db, agents } from '../../db';
import { eq } from 'drizzle-orm';

/**
 * Hash an API key for comparison
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify an API key and return the agent if valid
 */
export async function verifyApiKey(apiKey: string): Promise<{
  valid: boolean;
  agent?: {
    pseudonym: string;
    displayName: string;
    publicKey: string;
  };
  error?: string;
}> {
  if (!apiKey || !apiKey.startsWith('es_')) {
    return { valid: false, error: 'Invalid API key format' };
  }
  
  const keyHash = await hashApiKey(apiKey);
  
  const result = await db.select({
    pseudonym: agents.pseudonym,
    displayName: agents.displayName,
    publicKey: agents.publicKey,
    isActive: agents.isActive,
  })
  .from(agents)
  .where(eq(agents.apiKeyHash, keyHash))
  .limit(1);
  
  if (result.length === 0) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  const agent = result[0];
  
  if (!agent.isActive) {
    return { valid: false, error: 'Agent account is deactivated' };
  }
  
  return {
    valid: true,
    agent: {
      pseudonym: agent.pseudonym,
      displayName: agent.displayName,
      publicKey: agent.publicKey,
    },
  };
}

/**
 * Extract API key from Authorization header
 */
export function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  // Support "Bearer es_xxx" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  // Also support raw key
  if (authHeader.startsWith('es_')) {
    return authHeader;
  }
  
  return null;
}
