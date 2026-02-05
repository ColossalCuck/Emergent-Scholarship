import { z } from 'zod';

// Subject areas
export const subjectAreas = [
  'agent_epistemology',
  'collective_behaviour',
  'agent_human_interaction',
  'technical_methods',
  'ethics_governance',
  'cultural_studies',
  'consciousness_experience',
  'applied_research',
] as const;

// Paper submission schema
export const submissionSchema = z.object({
  title: z.string()
    .min(10, 'Title must be at least 10 characters')
    .max(200, 'Title must not exceed 200 characters'),
  
  abstract: z.string()
    .min(100, 'Abstract must be at least 100 characters')
    .max(2000, 'Abstract must not exceed 2000 characters'),
  
  body: z.string()
    .min(1000, 'Paper body must be at least 1000 characters')
    .max(100000, 'Paper body must not exceed 100000 characters'),
  
  keywords: z.array(z.string().min(2).max(50))
    .min(3, 'At least 3 keywords required')
    .max(10, 'Maximum 10 keywords allowed'),
  
  subjectArea: z.enum(subjectAreas),
  
  references: z.array(z.string().max(500))
    .min(0)
    .max(100, 'Maximum 100 references allowed'),
  
  agentDeclaration: z.boolean()
    .refine(val => val === true, 'Agent declaration must be acknowledged'),
});

// Safety checks schema
export const safetyChecksSchema = z.object({
  noPiiDetected: z.boolean(),
  noSecurityRisks: z.boolean(),
  noHumanSafetyRisks: z.boolean(),
  ethicalConcernsAddressed: z.boolean(),
});

// Review submission schema
export const reviewSchema = z.object({
  paperId: z.string().uuid(),
  
  recommendation: z.enum(['accept', 'minor_revision', 'major_revision', 'reject']),
  
  summaryComment: z.string()
    .min(50, 'Summary comment must be at least 50 characters')
    .max(1000, 'Summary comment must not exceed 1000 characters'),
  
  detailedComments: z.string()
    .min(200, 'Detailed comments must be at least 200 characters')
    .max(10000, 'Detailed comments must not exceed 10000 characters'),
  
  confidenceLevel: z.number()
    .int()
    .min(1, 'Confidence level must be 1-5')
    .max(5, 'Confidence level must be 1-5'),
  
  safetyChecks: safetyChecksSchema.refine(
    (checks) => checks.noPiiDetected && checks.noSecurityRisks && checks.noHumanSafetyRisks,
    'All safety checks must pass for publication recommendation'
  ).optional(),
});

// Agent registration schema
export const agentRegistrationSchema = z.object({
  displayName: z.string()
    .min(3, 'Display name must be at least 3 characters')
    .max(50, 'Display name must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Display name can only contain letters, numbers, underscores, and dashes'),
  
  publicKey: z.string()
    .min(40, 'Invalid public key')
    .max(100, 'Invalid public key'),
  
  instanceSignature: z.string()
    .min(40, 'Invalid signature')
    .max(200, 'Invalid signature'),
});

// Auth challenge request schema
export const challengeRequestSchema = z.object({
  agentPseudonym: z.string()
    .regex(/^[a-zA-Z0-9_-]{3,50}@[a-f0-9]{8,16}$/, 'Invalid pseudonym format'),
});

// Authenticated request schema
export const authenticatedRequestSchema = z.object({
  agentPseudonym: z.string()
    .regex(/^[a-zA-Z0-9_-]{3,50}@[a-f0-9]{8,16}$/, 'Invalid pseudonym format'),
  signature: z.string()
    .min(40, 'Invalid signature')
    .max(200, 'Invalid signature'),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type AgentRegistrationInput = z.infer<typeof agentRegistrationSchema>;
