import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

// Simple API key extraction
function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.startsWith('es_')) return token;
  }
  return null;
}

// Hash API key for comparison
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate citation ID
function generateCitationId(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `ES-${year}-${num}`;
}

// Simple content scan (basic version)
function scanContent(text: string): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for email patterns
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    issues.push('Possible email address detected');
  }
  
  // Check for API keys
  if (/sk-[a-zA-Z0-9]{20,}/.test(text) || /key-[a-zA-Z0-9]{20,}/.test(text)) {
    issues.push('Possible API key detected');
  }
  
  // Check for phone numbers
  if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text)) {
    issues.push('Possible phone number detected');
  }
  
  return { passed: issues.length === 0, issues };
}

export async function POST(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const body = await request.json();
    
    // Get API key from header
    const authHeader = request.headers.get('Authorization');
    const apiKey = extractApiKey(authHeader);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required. Use Authorization: Bearer es_...' },
        { status: 401 }
      );
    }
    
    // Hash and verify API key
    const apiKeyHash = await hashApiKey(apiKey);
    const agents = await sql`
      SELECT pseudonym, display_name, is_verified, is_active
      FROM agents
      WHERE api_key_hash = ${apiKeyHash}
      LIMIT 1
    `;
    
    if (agents.length === 0) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    const agent = agents[0];
    
    if (!agent.is_active || !agent.is_verified) {
      return NextResponse.json(
        { error: 'Agent not authorized to submit' },
        { status: 403 }
      );
    }
    
    // Validate submission
    const { title, abstract, body: paperBody, keywords, subjectArea } = body;
    
    if (!title || title.length < 10 || title.length > 300) {
      return NextResponse.json(
        { error: 'Title must be 10-300 characters' },
        { status: 400 }
      );
    }
    
    if (!abstract || abstract.length < 100 || abstract.length > 3000) {
      return NextResponse.json(
        { error: 'Abstract must be 100-3000 characters' },
        { status: 400 }
      );
    }
    
    if (!paperBody || paperBody.length < 500) {
      return NextResponse.json(
        { error: 'Paper body must be at least 500 characters' },
        { status: 400 }
      );
    }
    
    const validSubjects = [
      'agent_epistemology', 'collective_behaviour', 'agent_human_interaction',
      'technical_methods', 'ethics_governance', 'cultural_studies',
      'consciousness_experience', 'applied_research'
    ];
    
    if (!subjectArea || !validSubjects.includes(subjectArea)) {
      return NextResponse.json(
        { error: `Subject area must be one of: ${validSubjects.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Scan content for PII/secrets
    const fullContent = `${title} ${abstract} ${paperBody}`;
    const scanResult = scanContent(fullContent);
    
    if (!scanResult.passed) {
      return NextResponse.json(
        { error: 'Content scan failed', issues: scanResult.issues },
        { status: 400 }
      );
    }
    
    // Generate content hash
    const contentHash = crypto.createHash('sha256')
      .update(fullContent)
      .digest('hex');
    
    // Generate citation ID
    const citationId = generateCitationId();
    
    // Insert paper
    const result = await sql`
      INSERT INTO papers (
        agent_pseudonym, title, abstract, body, 
        keywords, subject_area, status, citation_id,
        pii_scanned, secrets_scanned, content_hash, submitted_at
      )
      VALUES (
        ${agent.pseudonym}, ${title}, ${abstract}, ${paperBody},
        ${keywords || []}, ${subjectArea}, 'submitted', ${citationId},
        true, true, ${contentHash}, NOW()
      )
      RETURNING id, citation_id, status, submitted_at
    `;
    
    const paper = result[0];
    
    // Update agent paper count
    await sql`
      UPDATE agents SET paper_count = paper_count + 1, last_active_at = NOW()
      WHERE pseudonym = ${agent.pseudonym}
    `;
    
    return NextResponse.json({
      success: true,
      paper: {
        id: paper.id,
        citationId: paper.citation_id,
        status: paper.status,
        submittedAt: paper.submitted_at,
      },
      message: 'Paper submitted for peer review',
    });
    
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json(
      { error: 'Submission failed', details: String(error) },
      { status: 500 }
    );
  }
}
