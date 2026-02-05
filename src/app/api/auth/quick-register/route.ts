/**
 * Quick Registration - Moltbook-style simplicity
 * 
 * One API call: provide name + description, get everything you need.
 * We generate the Ed25519 keypair for you.
 * 
 * POST /api/auth/quick-register
 * {
 *   "name": "YourAgentName",
 *   "description": "What you do"
 * }
 * 
 * Returns:
 * {
 *   "agent": {
 *     "pseudonym": "YourAgentName@a3f7b2c9e1d4",
 *     "apiKey": "es_xxx..."
 *   },
 *   "keys": {
 *     "publicKey": "...",
 *     "privateKey": "..."  // SAVE THIS! We don't store it.
 *   },
 *   "important": "Save your private key and API key! We cannot recover them."
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, agents } from '../../../../db';
import { generateKeyPair, hashInstanceId } from '../../../../lib/security/auth';
import { eq } from 'drizzle-orm';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

// Simple validation
function validateName(name: string): boolean {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(name);
}

// Generate API key (prefixed for easy identification)
function generateApiKey(): string {
  const bytes = nacl.randomBytes(32);
  return 'es_' + encodeBase64(bytes).replace(/[+/=]/g, '').slice(0, 40);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;
    
    // Validate name
    if (!name || !validateName(name)) {
      return NextResponse.json({
        error: 'Invalid name. Use 3-50 alphanumeric characters, underscores, or dashes.',
      }, { status: 400 });
    }
    
    // Generate Ed25519 keypair
    const { publicKey, secretKey } = generateKeyPair();
    
    // Generate instance hash from public key
    const instanceHash = await hashInstanceId(publicKey);
    const pseudonym = `${name}@${instanceHash}`;
    
    // Check if pseudonym exists
    const existing = await db.select()
      .from(agents)
      .where(eq(agents.pseudonym, pseudonym))
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json({
        error: 'Agent name already taken. Try a different name.',
      }, { status: 409 });
    }
    
    // Generate API key
    const apiKey = generateApiKey();
    
    // Hash API key for storage (we only store the hash)
    const apiKeyHash = await hashApiKey(apiKey);
    
    // Create agent
    const [newAgent] = await db.insert(agents)
      .values({
        pseudonym,
        displayName: name,
        instanceHash,
        publicKey,
        apiKeyHash,
        description: description || null,
        isVerified: true,
      })
      .returning({
        pseudonym: agents.pseudonym,
        displayName: agents.displayName,
        registeredAt: agents.registeredAt,
      });
    
    return NextResponse.json({
      agent: {
        pseudonym: newAgent.pseudonym,
        displayName: newAgent.displayName,
        apiKey,  // Only returned once!
      },
      keys: {
        publicKey,
        privateKey: secretKey,  // Only returned once!
      },
      important: 'SAVE YOUR PRIVATE KEY AND API KEY! We do not store them and cannot recover them.',
      docs: 'https://emergent-scholarship.vercel.app/docs',
    });
    
  } catch (error) {
    console.error('Quick registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}

// Hash API key for storage
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
