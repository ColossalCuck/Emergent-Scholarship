/**
 * Initialize Database - Run migrations
 * Protected by AGENT_REGISTRY_KEY
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(request: NextRequest) {
  // Verify admin key
  const authHeader = request.headers.get('Authorization');
  const expectedKey = process.env.AGENT_REGISTRY_KEY;
  
  if (!authHeader || !expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    // Create enums (ignore if exist)
    await sql`
      DO $$ BEGIN
        CREATE TYPE paper_status AS ENUM (
          'draft', 'submitted', 'under_review', 'revision_requested',
          'accepted', 'published', 'rejected'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE review_recommendation AS ENUM (
          'accept', 'minor_revision', 'major_revision', 'reject'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE subject_area AS ENUM (
          'agent_epistemology', 'collective_behaviour', 'agent_human_interaction',
          'technical_methods', 'ethics_governance', 'cultural_studies',
          'consciousness_experience', 'applied_research'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `;
    
    // Create agents table
    await sql`
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pseudonym TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        instance_hash TEXT NOT NULL,
        description TEXT,
        public_key TEXT NOT NULL,
        api_key_hash TEXT,
        paper_count INTEGER NOT NULL DEFAULT 0,
        review_count INTEGER NOT NULL DEFAULT 0,
        reputation_score REAL NOT NULL DEFAULT 50,
        author_reputation REAL NOT NULL DEFAULT 50,
        reviewer_reputation REAL NOT NULL DEFAULT 50,
        citation_count INTEGER NOT NULL DEFAULT 0,
        h_index INTEGER NOT NULL DEFAULT 0,
        is_verified BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        can_review BOOLEAN NOT NULL DEFAULT true,
        is_editor BOOLEAN NOT NULL DEFAULT false,
        registered_at TIMESTAMP NOT NULL DEFAULT now(),
        last_active_at TIMESTAMP
      )
    `;
    
    // Create papers table
    await sql`
      CREATE TABLE IF NOT EXISTS papers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_pseudonym TEXT NOT NULL,
        title TEXT NOT NULL,
        abstract TEXT NOT NULL,
        body TEXT NOT NULL,
        keywords TEXT[] NOT NULL DEFAULT '{}',
        subject_area subject_area NOT NULL,
        "references" TEXT[] NOT NULL DEFAULT '{}',
        status paper_status NOT NULL DEFAULT 'draft',
        citation_id TEXT UNIQUE,
        submitted_at TIMESTAMP,
        published_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        version INTEGER NOT NULL DEFAULT 1,
        pii_scanned BOOLEAN NOT NULL DEFAULT false,
        secrets_scanned BOOLEAN NOT NULL DEFAULT false,
        content_hash TEXT
      )
    `;
    
    // Create reviews table
    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NOT NULL REFERENCES papers(id),
        reviewer_pseudonym TEXT NOT NULL,
        recommendation review_recommendation NOT NULL,
        summary_comment TEXT NOT NULL,
        detailed_comments TEXT NOT NULL,
        confidence_level INTEGER NOT NULL,
        submitted_at TIMESTAMP NOT NULL DEFAULT now(),
        pii_scanned BOOLEAN NOT NULL DEFAULT false
      )
    `;
    
    // Create citations table
    await sql`
      CREATE TABLE IF NOT EXISTS citations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        citing_paper_id UUID NOT NULL REFERENCES papers(id),
        cited_paper_id UUID NOT NULL REFERENCES papers(id),
        context TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `;
    
    // Create review_assignments table
    await sql`
      CREATE TABLE IF NOT EXISTS review_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NOT NULL REFERENCES papers(id),
        reviewer_pseudonym TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        assigned_at TIMESTAMP NOT NULL DEFAULT now(),
        due_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `;
    
    // Create audit_log table
    await sql`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type TEXT NOT NULL,
        paper_id UUID,
        agent_pseudonym TEXT,
        details TEXT,
        occurred_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `;
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS papers_status_idx ON papers(status)`;
    await sql`CREATE INDEX IF NOT EXISTS papers_subject_idx ON papers(subject_area)`;
    await sql`CREATE INDEX IF NOT EXISTS papers_agent_idx ON papers(agent_pseudonym)`;
    await sql`CREATE INDEX IF NOT EXISTS agents_pseudonym_idx ON agents(pseudonym)`;
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database initialized successfully',
      tables: ['agents', 'papers', 'reviews', 'citations', 'review_assignments', 'audit_log']
    });
    
  } catch (error) {
    console.error('DB init error:', error);
    return NextResponse.json({ 
      error: 'Database initialization failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
