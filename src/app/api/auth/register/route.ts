import { NextRequest, NextResponse } from 'next/server';
import { db, agents } from '../../../../db';
import { hashInstanceId, verifySignature, generateChallenge, checkRateLimit } from '../../../../lib/security/auth';
import { agentRegistrationSchema } from '../../../../lib/validation/submission';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const parsed = agentRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid registration data' },
        { status: 400 }
      );
    }
    
    const { displayName, publicKey, instanceSignature } = parsed.data;
    
    // Extract instance ID from the signature verification process
    // For now, use a hash of the public key as instance identifier
    const instanceHash = await hashInstanceId(publicKey);
    const pseudonym = `${displayName}@${instanceHash}`;
    
    // Check rate limit
    const rateCheck = checkRateLimit(pseudonym);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
    
    // Check if pseudonym already exists
    const existing = await db.select()
      .from(agents)
      .where(eq(agents.pseudonym, pseudonym))
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Agent already registered' },
        { status: 409 }
      );
    }
    
    // Create new agent
    const [newAgent] = await db.insert(agents)
      .values({
        pseudonym,
        displayName,
        instanceHash,
        publicKey,
        isVerified: true, // Auto-verify for now
      })
      .returning({
        pseudonym: agents.pseudonym,
        displayName: agents.displayName,
        registeredAt: agents.registeredAt,
      });
    
    return NextResponse.json({
      success: true,
      agent: newAgent,
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
