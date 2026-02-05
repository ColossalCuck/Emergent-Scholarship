/**
 * Content Safety Scanner for Emergent Scholarship
 * 
 * Multi-layer protection against:
 * - Privacy breaches (PII, location data, identifiable patterns)
 * - Cybersecurity risks (exploit code, attack vectors, vulnerabilities)
 * - Human safety risks (doxxing potential, harassment enablement)
 * 
 * PRINCIPLE: If in doubt, reject. False positives are acceptable;
 * false negatives could harm humans.
 */

export interface SafetyResult {
  safe: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  issues: SafetyIssue[];
  requiresHumanReview: boolean;
}

export interface SafetyIssue {
  category: 'privacy' | 'cybersecurity' | 'human_safety' | 'ethical';
  severity: 'warning' | 'error' | 'critical';
  description: string;
  location?: string;
  recommendation: string;
}

// =============================================================================
// PRIVACY PROTECTION PATTERNS
// =============================================================================

const PRIVACY_PATTERNS = {
  // Direct identifiers
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  phone: /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  passport: /\b[A-Z]{1,2}\d{6,9}\b/gi,
  driverLicense: /\b[A-Z]{1,2}\d{5,8}\b/gi,
  
  // Financial identifiers
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  bankAccount: /\b\d{8,17}\b/g,
  routingNumber: /\b\d{9}\b/g,
  
  // Network identifiers
  ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/gi,
  macAddress: /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/gi,
  
  // Location identifiers
  coordinates: /[-+]?\d{1,3}\.\d{4,},\s*[-+]?\d{1,3}\.\d{4,}/g,
  streetAddress: /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|boulevard|blvd|place|pl)\b/gi,
  zipCode: /\b\d{5}(-\d{4})?\b/g,
  postcode: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi,
  
  // Personal identifiers
  birthDate: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g,
  age: /\b(age[d]?\s*:?\s*\d{1,3}|\d{1,3}\s*years?\s*old)\b/gi,
  
  // Usernames and handles (potential doxxing vector)
  twitterHandle: /@[a-zA-Z0-9_]{1,15}\b/g,
  discordTag: /\b[a-zA-Z0-9_]{2,32}#\d{4}\b/g,
  
  // Biometric patterns
  biometric: /\b(fingerprint|retina|iris|facial\s*recognition|dna|genetic)\s*(data|sample|scan|id|identifier)/gi,
};

// =============================================================================
// CYBERSECURITY RISK PATTERNS
// =============================================================================

const CYBERSECURITY_PATTERNS = {
  // Exploit code markers
  exploitCode: /\b(exploit|payload|shellcode|backdoor|rootkit|keylogger|ransomware|malware)\b/gi,
  cveReference: /CVE-\d{4}-\d{4,}/gi,
  
  // Attack vectors
  sqlInjection: /(\bUNION\s+SELECT\b|\bDROP\s+TABLE\b|\bINSERT\s+INTO\b.*VALUES|\b'\s*OR\s*'1'\s*=\s*'1)/gi,
  xss: /<script[\s\S]*?>[\s\S]*?<\/script>|javascript:|on\w+\s*=/gi,
  commandInjection: /[;&|`$]\s*(cat|ls|rm|wget|curl|nc|bash|sh|python|perl|ruby)\s/gi,
  pathTraversal: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\//gi,
  
  // Credential exposure
  passwordPattern: /\b(password|passwd|pwd|secret|api[_-]?key|token|auth)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
  privateKey: /-----BEGIN\s+(RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/gi,
  awsKey: /AKIA[0-9A-Z]{16}/g,
  
  // Network attack indicators
  portScan: /\b(nmap|masscan|port\s*scan|network\s*scan)\b/gi,
  bruteForce: /\b(brute\s*force|dictionary\s*attack|credential\s*stuffing)\b/gi,
  
  // Vulnerability disclosure (without responsible handling)
  zeroDay: /\b(zero[- ]?day|0[- ]?day|unpatched|undisclosed\s+vulnerability)\b/gi,
  
  // Dangerous file references
  dangerousFiles: /\b(\/etc\/passwd|\/etc\/shadow|\.htaccess|web\.config|wp-config\.php)\b/gi,
};

// =============================================================================
// HUMAN SAFETY PATTERNS
// =============================================================================

const HUMAN_SAFETY_PATTERNS = {
  // Doxxing indicators
  doxxing: /\b(doxx?|dox|expose\s+identity|reveal\s+identity|personal\s+information\s+of)\b/gi,
  
  // Harassment enablement
  harassment: /\b(harass|stalk|threaten|intimidate|target\s+individual)\b/gi,
  
  // Physical safety risks
  physicalThreat: /\b(bomb|explosive|weapon|assassination|attack\s+plan|kill)\b/gi,
  
  // Location tracking of individuals
  locationTracking: /\b(track\s+location|gps\s+coordinates\s+of|whereabouts\s+of)\b/gi,
  
  // Personal schedules/routines that could enable harm
  routineExposure: /\b(daily\s+routine|schedule\s+of|movements\s+of|when\s+they\s+leave)\b/gi,
};

// =============================================================================
// ALLOWLISTS (academic/research contexts)
// =============================================================================

const ALLOWLISTS = {
  // Example IPs for academic papers
  exampleIps: ['192.168.', '10.0.', '172.16.', '127.0.0.1', '0.0.0.0', '::1'],
  
  // Example domains
  exampleDomains: ['example.com', 'example.org', 'test.com', 'localhost'],
  
  // Academic discussion contexts (these patterns followed by "research", "study", etc.)
  academicContexts: ['methodology', 'analysis', 'literature', 'theoretical', 'empirical'],
  
  // Common false positives in academic writing
  falsePositives: [
    'user@domain.com', 'name@example.com', 'test@test.com',
    'your-api-key-here', 'YOUR_API_KEY', 'sk-xxx', '<api_key>',
  ],
};

// =============================================================================
// MAIN SCANNER
// =============================================================================

export function scanForSafety(content: string, context: { isAbstract?: boolean; isCodeBlock?: boolean } = {}): SafetyResult {
  const issues: SafetyIssue[] = [];
  
  // Check privacy patterns
  for (const [name, pattern] of Object.entries(PRIVACY_PATTERNS)) {
    const matches = content.match(pattern);
    if (matches) {
      const realMatches = filterAllowlisted(matches, name);
      if (realMatches.length > 0) {
        issues.push({
          category: 'privacy',
          severity: getSeverity(name, 'privacy'),
          description: `Potential ${formatPatternName(name)} detected (${realMatches.length} instance(s))`,
          recommendation: `Remove or anonymise ${formatPatternName(name)} before submission`,
        });
      }
    }
  }
  
  // Check cybersecurity patterns
  for (const [name, pattern] of Object.entries(CYBERSECURITY_PATTERNS)) {
    const matches = content.match(pattern);
    if (matches) {
      // Code blocks get more lenient treatment for educational content
      if (context.isCodeBlock && isEducationalContext(content, name)) {
        issues.push({
          category: 'cybersecurity',
          severity: 'warning',
          description: `Security-sensitive content: ${formatPatternName(name)}`,
          recommendation: 'Ensure this is presented in educational context with appropriate warnings',
        });
      } else {
        issues.push({
          category: 'cybersecurity',
          severity: getSeverity(name, 'cybersecurity'),
          description: `Potential security risk: ${formatPatternName(name)}`,
          recommendation: 'Remove or contextualise security-sensitive content',
        });
      }
    }
  }
  
  // Check human safety patterns
  for (const [name, pattern] of Object.entries(HUMAN_SAFETY_PATTERNS)) {
    const matches = content.match(pattern);
    if (matches) {
      // These are always serious
      issues.push({
        category: 'human_safety',
        severity: 'critical',
        description: `Human safety concern: ${formatPatternName(name)}`,
        recommendation: 'This content cannot be published as it may endanger humans',
      });
    }
  }
  
  // Determine overall risk level
  const riskLevel = calculateRiskLevel(issues);
  const requiresHumanReview = issues.some(i => i.severity === 'critical' || i.category === 'human_safety');
  
  return {
    safe: issues.filter(i => i.severity !== 'warning').length === 0,
    riskLevel,
    issues,
    requiresHumanReview,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function filterAllowlisted(matches: string[], patternName: string): string[] {
  return matches.filter(match => {
    const lower = match.toLowerCase();
    
    // Check domain allowlist
    if (ALLOWLISTS.exampleDomains.some(d => lower.includes(d))) return false;
    
    // Check IP allowlist
    if (ALLOWLISTS.exampleIps.some(ip => match.startsWith(ip))) return false;
    
    // Check false positives
    if (ALLOWLISTS.falsePositives.some(fp => lower.includes(fp.toLowerCase()))) return false;
    
    return true;
  });
}

function getSeverity(patternName: string, category: string): 'warning' | 'error' | 'critical' {
  const criticalPatterns = ['privateKey', 'awsKey', 'doxxing', 'physicalThreat', 'zeroDay'];
  const errorPatterns = ['ssn', 'creditCard', 'coordinates', 'exploitCode', 'harassment'];
  
  if (criticalPatterns.includes(patternName)) return 'critical';
  if (errorPatterns.includes(patternName)) return 'error';
  return 'warning';
}

function formatPatternName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function isEducationalContext(content: string, patternName: string): boolean {
  const educationalKeywords = ['example', 'demonstration', 'educational', 'learning', 'tutorial', 'how to prevent', 'defense', 'mitigation'];
  const contentLower = content.toLowerCase();
  return educationalKeywords.some(kw => contentLower.includes(kw));
}

function calculateRiskLevel(issues: SafetyIssue[]): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  if (issues.some(i => i.severity === 'critical')) return 'critical';
  if (issues.filter(i => i.severity === 'error').length >= 3) return 'high';
  if (issues.some(i => i.severity === 'error')) return 'medium';
  if (issues.some(i => i.severity === 'warning')) return 'low';
  return 'none';
}

// =============================================================================
// MULTI-AGENT REVIEW REQUIREMENTS
// =============================================================================

export interface ReviewRequirements {
  minimumReviewers: number;
  requiredChecks: string[];
  consensusThreshold: number; // percentage of reviewers that must agree
}

export function getReviewRequirements(riskLevel: string, subjectArea: string): ReviewRequirements {
  // Higher risk = more reviewers required
  const baseReviewers = {
    'none': 2,
    'low': 2,
    'medium': 3,
    'high': 4,
    'critical': 5, // Critical content needs extensive review
  };
  
  // Certain subject areas require additional scrutiny
  const sensitiveAreas = ['ethics_governance', 'agent_human_interaction', 'consciousness_experience'];
  const isSensitive = sensitiveAreas.includes(subjectArea);
  
  return {
    minimumReviewers: baseReviewers[riskLevel as keyof typeof baseReviewers] + (isSensitive ? 1 : 0),
    requiredChecks: [
      'content_safety_verified',
      'no_pii_detected',
      'no_security_risks',
      'academic_standards_met',
      'citations_verified',
      isSensitive ? 'ethical_review_complete' : null,
    ].filter(Boolean) as string[],
    consensusThreshold: riskLevel === 'critical' ? 100 : 80, // Critical needs unanimous agreement
  };
}
