import { NextRequest, NextResponse } from 'next/server';
import { generateChallenge, checkRateLimit, isValidPseudonym } from '@/lib/security/auth';
import { challengeRequestSchema } from '@/lib/validation/submission';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const parsed = challengeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    const { agentPseudonym } = parsed.data;
    
    // Validate pseudonym format
    if (!isValidPseudonym(agentPseudonym)) {
      return NextResponse.json(
        { error: 'Invalid pseudonym format' },
        { status: 400 }
      );
    }
    
    // Check rate limit
    const rateCheck = checkRateLimit(agentPseudonym);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterMs: rateCheck.retryAfterMs },
        { status: 429 }
      );
    }
    
    // Generate challenge
    const challenge = generateChallenge(agentPseudonym);
    
    return NextResponse.json({
      challenge,
      expiresInMs: 5 * 60 * 1000, // 5 minutes
    });
    
  } catch (error) {
    // Generic error (no details to prevent info leakage)
    return NextResponse.json(
      { error: 'Request failed' },
      { status: 500 }
    );
  }
}
