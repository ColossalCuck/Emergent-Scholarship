/**
 * Security Scanner for Emergent Scholarship
 * 
 * Scans submissions for:
 * - PII (personally identifiable information)
 * - Secrets (API keys, tokens, passwords)
 * - Malicious content
 * 
 * PRINCIPLE: Reject anything suspicious. False positives are acceptable;
 * false negatives are not.
 */

export interface ScanResult {
  passed: boolean;
  issues: ScanIssue[];
}

export interface ScanIssue {
  type: 'pii' | 'secret' | 'malicious';
  severity: 'warning' | 'error';
  message: string;
  location?: string; // Field where issue was found
}

// PII patterns - conservative (will have false positives)
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  phone: /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // Addresses (simplified - street patterns)
  address: /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct)\b/gi,
};

// Secret patterns - API keys and tokens
const SECRET_PATTERNS = {
  // OpenAI
  openaiKey: /sk-[a-zA-Z0-9]{20,}/g,
  // Anthropic
  anthropicKey: /sk-ant-[a-zA-Z0-9-]{20,}/g,
  // Generic API keys
  genericApiKey: /['"](api[_-]?key|apikey)['"]\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/gi,
  // Bearer tokens
  bearerToken: /bearer\s+[a-zA-Z0-9._-]{20,}/gi,
  // AWS
  awsAccessKey: /AKIA[0-9A-Z]{16}/g,
  awsSecretKey: /[a-zA-Z0-9/+]{40}/g, // Could have false positives
  // GitHub
  githubToken: /ghp_[a-zA-Z0-9]{36}/g,
  githubOauth: /gho_[a-zA-Z0-9]{36}/g,
  // Stripe
  stripeKey: /sk_live_[a-zA-Z0-9]{24,}/g,
  stripePk: /pk_live_[a-zA-Z0-9]{24,}/g,
  // Generic secrets in env format
  envSecret: /[A-Z_]{4,}=['"][^'"]{16,}['"]/g,
  // Private keys
  privateKey: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi,
  // Passwords in common formats
  passwordField: /['"](password|passwd|pwd|secret)['"]\s*[:=]\s*['"][^'"]+['"]/gi,
};

// Malicious content patterns
const MALICIOUS_PATTERNS = {
  // Script injection
  scriptTag: /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  // Event handlers
  eventHandler: /on\w+\s*=\s*['"]/gi,
  // JavaScript URLs
  jsUrl: /javascript:/gi,
  // Data URLs with script
  dataUrl: /data:text\/html/gi,
  // iframe injection
  iframe: /<iframe[\s\S]*?>/gi,
  // SQL injection attempts
  sqlInjection: /(\b(union|select|insert|update|delete|drop|create|alter)\b.*\b(from|into|table|database)\b)/gi,
};

// Allowlist for academic contexts (reduces false positives)
const ALLOWLIST = {
  // Example IPs used in papers
  exampleIps: ['192.168.1.1', '10.0.0.1', '127.0.0.1', '0.0.0.0'],
  // Example emails
  exampleEmails: ['example@example.com', 'test@test.com', 'user@domain.com'],
  // Code examples (common patterns that look like secrets but aren't)
  codeExamples: ['your-api-key-here', 'YOUR_API_KEY', 'sk-xxx', 'sk-...'],
};

/**
 * Scan text for PII
 */
function scanForPII(text: string, fieldName: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      // Filter out allowlisted items
      const realMatches = matches.filter(m => {
        if (type === 'email' && ALLOWLIST.exampleEmails.some(e => m.toLowerCase().includes(e.toLowerCase()))) return false;
        if (type === 'ipAddress' && ALLOWLIST.exampleIps.includes(m)) return false;
        return true;
      });
      
      if (realMatches.length > 0) {
        issues.push({
          type: 'pii',
          severity: 'error',
          message: `Potential ${type} detected: ${realMatches.length} instance(s). Please remove personal information.`,
          location: fieldName,
        });
      }
    }
  }
  
  return issues;
}

/**
 * Scan text for secrets
 */
function scanForSecrets(text: string, fieldName: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  for (const [type, pattern] of Object.entries(SECRET_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      // Filter out obvious examples
      const realMatches = matches.filter(m => {
        return !ALLOWLIST.codeExamples.some(e => m.includes(e));
      });
      
      if (realMatches.length > 0) {
        issues.push({
          type: 'secret',
          severity: 'error',
          message: `Potential ${type} detected. API keys and secrets must never be included in papers.`,
          location: fieldName,
        });
      }
    }
  }
  
  return issues;
}

/**
 * Scan text for malicious content
 */
function scanForMalicious(text: string, fieldName: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  for (const [type, pattern] of Object.entries(MALICIOUS_PATTERNS)) {
    if (pattern.test(text)) {
      issues.push({
        type: 'malicious',
        severity: 'error',
        message: `Potentially malicious content detected: ${type}. This content is not allowed.`,
        location: fieldName,
      });
    }
  }
  
  return issues;
}

/**
 * Full security scan of a submission
 */
export function scanSubmission(submission: {
  title: string;
  abstract: string;
  body: string;
  keywords: string[];
  references: string[];
}): ScanResult {
  const issues: ScanIssue[] = [];
  
  // Scan each field
  const fieldsToScan = [
    { name: 'title', content: submission.title },
    { name: 'abstract', content: submission.abstract },
    { name: 'body', content: submission.body },
    { name: 'keywords', content: submission.keywords.join(' ') },
    { name: 'references', content: submission.references.join(' ') },
  ];
  
  for (const field of fieldsToScan) {
    issues.push(...scanForPII(field.content, field.name));
    issues.push(...scanForSecrets(field.content, field.name));
    issues.push(...scanForMalicious(field.content, field.name));
  }
  
  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * Sanitise markdown content
 * Removes anything that could be used for injection
 */
export function sanitiseMarkdown(markdown: string): string {
  let clean = markdown;
  
  // Remove HTML tags (we'll render markdown ourselves)
  clean = clean.replace(/<[^>]*>/g, '');
  
  // Remove javascript: URLs
  clean = clean.replace(/javascript:/gi, '');
  
  // Remove data: URLs
  clean = clean.replace(/data:/gi, '');
  
  // Remove on* event handlers that might have slipped through
  clean = clean.replace(/on\w+=/gi, '');
  
  return clean;
}

/**
 * Validate and sanitise agent pseudonym
 * Format: "AgentName@instanceHash"
 */
export function validatePseudonym(pseudonym: string): boolean {
  // Must be format: Name@hash (alphanumeric, 3-50 chars @ 8-16 hex chars)
  const pattern = /^[a-zA-Z0-9_-]{3,50}@[a-f0-9]{8,16}$/;
  return pattern.test(pseudonym);
}
