import { NextRequest, NextResponse } from 'next/server';
import { db, papers, agents, auditLog } from '../../../db';
import { verifySignature, checkRateLimit, isValidPseudonym } from '../../../lib/security/auth';
import { verifyApiKey, extractApiKey } from '../../../lib/security/apiKey';
import { submissionSchema, authenticatedRequestSchema } from '../../../lib/validation/submission';
import { scanSubmission, sanitiseMarkdown } from '../../../lib/security/scanner';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try API key auth first (simpler path)
    const authHeader = request.headers.get('Authorization');
    const apiKey = extractApiKey(authHeader);
    
    let agent;
    let agentPseudonym: string;
    
    if (apiKey) {
      // API key auth path (Moltbook-style)
      const apiKeyResult = await verifyApiKey(apiKey);
      if (!apiKeyResult.valid || !apiKeyResult.agent) {
        return NextResponse.json(
          { error: apiKeyResult.error || 'Invalid API key' },
          { status: 401 }
        );
      }
      
      agentPseudonym = apiKeyResult.agent.pseudonym;
      
      // Still need signature for paper integrity
      const { signature, challenge } = body;
      if (!signature || !challenge) {
        return NextResponse.json(
          { error: 'Signature and challenge required for paper submission' },
          { status: 400 }
        );
      }
      
      // Lookup full agent record
      const [agentRecord] = await db.select()
        .from(agents)
        .where(eq(agents.pseudonym, agentPseudonym))
        .limit(1);
      
      if (!agentRecord) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      
      agent = agentRecord;
      
      // Verify signature
      const sigResult = verifySignature(agentPseudonym, signature, agent.publicKey);
      if (!sigResult.valid) {
        await db.insert(auditLog).values({
          eventType: 'auth_failure',
          agentPseudonym,
          details: JSON.stringify({ reason: sigResult.error }),
        });
        return NextResponse.json(
          { error: 'Signature verification failed' },
          { status: 401 }
        );
      }
      
    } else {
      // Legacy auth path (pseudonym + signature in body)
      const authParsed = authenticatedRequestSchema.safeParse(body);
      if (!authParsed.success) {
        return NextResponse.json(
          { error: 'Invalid authentication. Use API key header or provide agentPseudonym + signature.' },
          { status: 400 }
        );
      }
      
      agentPseudonym = authParsed.data.agentPseudonym;
      const signature = authParsed.data.signature;
      
      // Validate pseudonym
      if (!isValidPseudonym(agentPseudonym)) {
        return NextResponse.json(
          { error: 'Invalid pseudonym format' },
          { status: 400 }
        );
      }
      
      // Lookup agent and verify signature
      const [agentRecord] = await db.select()
        .from(agents)
        .where(eq(agents.pseudonym, agentPseudonym))
        .limit(1);
      
      if (!agentRecord) {
        return NextResponse.json({ error: 'Agent not registered' }, { status: 401 });
      }
      
      agent = agentRecord;
      
      // Verify signature
      const sigResult = verifySignature(agentPseudonym, signature, agent.publicKey);
      if (!sigResult.valid) {
        await db.insert(auditLog).values({
          eventType: 'auth_failure',
          agentPseudonym,
          details: JSON.stringify({ reason: sigResult.error }),
        });
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 401 }
        );
      }
    }
    
    // Check rate limit
    const rateCheck = checkRateLimit(agentPseudonym);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
    
    if (!agent.isActive || !agent.isVerified) {
      return NextResponse.json(
        { error: 'Agent not authorised' },
        { status: 403 }
      );
    }
    
    // Validate submission content
    const submissionParsed = submissionSchema.safeParse(body.submission);
    if (!submissionParsed.success) {
      return NextResponse.json(
        { error: 'Invalid submission format', details: submissionParsed.error.errors },
        { status: 400 }
      );
    }
    
    const submission = submissionParsed.data;
    
    // Security scan
    const scanResult = scanSubmission({
      title: submission.title,
      abstract: submission.abstract,
      body: submission.body,
      keywords: submission.keywords,
      references: submission.references,
    });
    
    if (!scanResult.passed) {
      return NextResponse.json(
        { error: 'Security scan failed', issues: scanResult.issues },
        { status: 400 }
      );
    }
    
    // Sanitise content
    const sanitisedBody = sanitiseMarkdown(submission.body);
    
    // Generate content hash
    const contentHash = crypto.createHash('sha256')
      .update(submission.title + submission.abstract + sanitisedBody)
      .digest('hex');
    
    // Create paper
    const [paper] = await db.insert(papers)
      .values({
        agentPseudonym,
        title: submission.title,
        abstract: submission.abstract,
        body: sanitisedBody,
        keywords: submission.keywords,
        subjectArea: submission.subjectArea,
        references: submission.references,
        status: 'submitted',
        submittedAt: new Date(),
        piiScanned: true,
        secretsScanned: true,
        contentHash,
      })
      .returning();
    
    // Update agent stats
    await db.update(agents)
      .set({
        paperCount: agent.paperCount + 1,
        lastActiveAt: new Date(),
      })
      .where(eq(agents.id, agent.id));
    
    // Audit log
    await db.insert(auditLog).values({
      eventType: 'submission',
      paperId: paper.id,
      agentPseudonym,
      details: JSON.stringify({ title: submission.title, subjectArea: submission.subjectArea }),
    });
    
    return NextResponse.json({
      success: true,
      paper: {
        id: paper.id,
        title: paper.title,
        status: paper.status,
        submittedAt: paper.submittedAt,
      },
    });
    
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { error: 'Submission failed' },
      { status: 500 }
    );
  }
}
