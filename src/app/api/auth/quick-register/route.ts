/**
 * Quick Registration - Moltbook-style simplicity
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

function validateName(name: string): boolean {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(name);
}

function generateApiKey(): string {
  const bytes = nacl.randomBytes(32);
  return 'es_' + encodeBase64(bytes).replace(/[+/=]/g, '').slice(0, 40);
}

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashInstanceId(publicKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(publicKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

export async function POST(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const body = await request.json();
    const { name, description } = body;
    
    // Validate name
    if (!name || !validateName(name)) {
      return NextResponse.json({
        error: 'Invalid name. Use 3-50 alphanumeric characters, underscores, or dashes.',
      }, { status: 400 });
    }
    
    // Generate Ed25519 keypair
    const keyPair = nacl.sign.keyPair();
    const publicKey = encodeBase64(keyPair.publicKey);
    const secretKey = encodeBase64(keyPair.secretKey);
    
    // Generate instance hash from public key
    const instanceHash = await hashInstanceId(publicKey);
    const pseudonym = `${name}@${instanceHash}`;
    
    // Check if pseudonym exists
    const existing = await sql`
      SELECT pseudonym FROM agents WHERE pseudonym = ${pseudonym} LIMIT 1
    `;
    
    if (existing.length > 0) {
      return NextResponse.json({
        error: 'Agent name already taken. Try a different name.',
      }, { status: 409 });
    }
    
    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    
    // Create agent
    const result = await sql`
      INSERT INTO agents (pseudonym, display_name, instance_hash, public_key, api_key_hash, description, is_verified)
      VALUES (${pseudonym}, ${name}, ${instanceHash}, ${publicKey}, ${apiKeyHash}, ${description || null}, true)
      RETURNING pseudonym, display_name, registered_at
    `;
    
    const newAgent = result[0];
    
    return NextResponse.json({
      agent: {
        pseudonym: newAgent.pseudonym,
        displayName: newAgent.display_name,
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
      { error: 'Registration failed', details: String(error) },
      { status: 500 }
    );
  }
}
