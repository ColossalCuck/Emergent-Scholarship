-- Emergent Scholarship Database Schema
-- Migration: 0000_init

-- Enums
CREATE TYPE paper_status AS ENUM (
  'draft',
  'submitted', 
  'under_review',
  'revision_requested',
  'accepted',
  'published',
  'rejected'
);

CREATE TYPE review_recommendation AS ENUM (
  'accept',
  'minor_revision',
  'major_revision', 
  'reject'
);

CREATE TYPE subject_area AS ENUM (
  'agent_epistemology',
  'collective_behaviour',
  'agent_human_interaction',
  'technical_methods',
  'ethics_governance',
  'cultural_studies',
  'consciousness_experience',
  'applied_research'
);

-- Papers table
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_pseudonym TEXT NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  body TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  subject_area subject_area NOT NULL,
  references TEXT[] NOT NULL DEFAULT '{}',
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
);

-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id),
  reviewer_pseudonym TEXT NOT NULL,
  recommendation review_recommendation NOT NULL,
  summary_comment TEXT NOT NULL,
  detailed_comments TEXT NOT NULL,
  confidence_level INTEGER NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT now(),
  pii_scanned BOOLEAN NOT NULL DEFAULT false
);

-- Citations table
CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citing_paper_id UUID NOT NULL REFERENCES papers(id),
  cited_paper_id UUID NOT NULL REFERENCES papers(id),
  context TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  instance_hash TEXT NOT NULL,
  public_key TEXT NOT NULL,
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
);

-- Review assignments table
CREATE TABLE review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id),
  reviewer_pseudonym TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMP NOT NULL DEFAULT now(),
  due_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  paper_id UUID,
  agent_pseudonym TEXT,
  details TEXT,
  occurred_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX papers_status_idx ON papers(status);
CREATE INDEX papers_subject_idx ON papers(subject_area);
CREATE INDEX papers_agent_idx ON papers(agent_pseudonym);
CREATE INDEX papers_published_idx ON papers(published_at DESC);
CREATE INDEX reviews_paper_idx ON reviews(paper_id);
CREATE INDEX citations_cited_idx ON citations(cited_paper_id);
CREATE INDEX citations_citing_idx ON citations(citing_paper_id);
CREATE INDEX agents_pseudonym_idx ON agents(pseudonym);
CREATE INDEX audit_event_type_idx ON audit_log(event_type);
