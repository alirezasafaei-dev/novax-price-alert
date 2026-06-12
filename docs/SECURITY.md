# Security Policy

## Overview

This document outlines the security policies, practices, and guidelines for the Novax Price Alert system.

## Security Principles

1. **Zero Trust**: Never assume implicit trust; verify explicitly
2. **Defense in Depth**: Multiple layers of security controls
3. **Least Privilege**: Grant only necessary access
4. **Secure by Default**: Security as the default state
5. **Encryption**: Encrypt data at rest and in transit
6. **Audit Everything**: Log and monitor security-relevant events

## Secrets Management

### Required Secrets

All secrets must be stored in environment variables or secret management systems:

- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `ADMIN_ACCESS_TOKEN`: Admin panel access token (strong, random)
- `INGEST_API_TOKEN`: API token for price ingestion
- `GEMINI_API_KEY`: Google Gemini API key (optional, for AI features)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `VPS_SSH_KEY`: SSH private key for VPS deployment (CI/CD only)

### Secret Requirements

- **Length**: Minimum 32 characters for tokens
- **Complexity**: Mix of uppercase, lowercase, numbers, and symbols
- **Rotation**: Rotate secrets every 90 days
- **Storage**: Never commit secrets to git
- **Environment**: Use `.env` file (gitignored) or secret management

### Secret Rotation Process

1. Generate new secret
2. Update in secret management system
3. Update `.env` files on all environments
4. Restart services
5. Verify functionality
6. Destroy old secret after 24 hours

## Authentication & Authorization

### Admin Panel

- **Access**: `/admin?token=ADMIN_ACCESS_TOKEN`
- **Token**: Must be strong random string (64+ chars)
- **Exposure**: Never log or display the token
- **Rate Limiting**: IP-based rate limiting (100 req/min)

### API Endpoints

- **Authentication**: Bearer token in `Authorization` header
- **Token Validation**: HMAC compare_digest for timing-safe comparison
- **Public Endpoints**: `/health`, `/api/v1/prices/latest`
- **Protected Endpoints**: All other endpoints

## Network Security

### VPS Configuration

- **SSH**: Key-based authentication only (no passwords)
- **Firewall**: UFW with strict rules
  - SSH (22): Limited to specific IPs
  - HTTP (80): Redirect to HTTPS
  - HTTPS (443): Open
  - Others: Closed
- **SSL/TLS**: Let's Encrypt with automatic renewal

### API Security

- **Rate Limiting**: Per IP and per user
- **CORS**: Strict origin allowlist
- **Headers**: Security headers (CSP, HSTS, X-Frame-Options)
- **Input Validation**: All inputs validated and sanitized

## Data Security

### Encryption

- **Database**: PostgreSQL encryption at rest
- **Transmission**: TLS 1.3 for all connections
- **Secrets**: Encrypted at rest using key management

### Sensitive Data

- **User Data**: Minimal PII collection (only Telegram ID)
- **Logs**: Sanitized (no tokens, secrets, or PII)
- **Backups**: Encrypted and stored securely

### Data Retention

- **Alert Rules**: Retain for 1 year after deletion
- **Price History**: Retain for 90 days
- **Logs**: Retain for 30 days
- **Events**: Retain for 90 days

## Dependency Security

### Vulnerability Management

- **Automated Scanning**: GitHub Dependabot enabled
- **Manual Review**: Monthly dependency review
- **Updates**: Security updates within 7 days
- **Testing**: Full test suite after dependency updates

### Supply Chain

- **Pin Dependencies**: Use exact versions
- **Verify Integrity**: Check hashes for critical packages
- **SBoM**: Software Bill of Materials maintained

## Operational Security

### Deployment

- **CI/CD**: Automated with security checks
- **Secrets**: Never in CI/CD logs
- **Access**: Minimal access, time-limited tokens
- **Audit**: All deployment actions logged

### Monitoring

- **Security Events**: Logged and alerted
- **Anomaly Detection**: Automated anomaly detection
- **Incident Response**: 24/7 response process
- **Post-Mortem**: After security incidents

### Access Control

- **VPS Access**: SSH keys only, 2FA where possible
- **Database**: Network-level restrictions
- **GitHub**: Branch protection, code review required
- **Admin Access**: Role-based access control

## Testing & Validation

### Security Testing

- **Static Analysis**: Bandit for Python, ESLint security plugins for JS
- **Dependency Scanning**: Regular automated scans
- **Penetration Testing**: Annual penetration testing
- **Code Review**: Security-focused code review

### Test Coverage

- **Unit Tests**: 100% for security-critical code
- **Integration Tests**: Authentication and authorization flows
- **E2E Tests**: Critical security paths

## Incident Response

### Incident Classification

- **P0 - Critical**: Active exploitation, data breach
- **P1 - High**: Vulnerability with known exploit
- **P2 - Medium**: Vulnerability without exploit
- **P3 - Low**: Minor security issue

### Response Times

- **P0**: 1 hour response, 4 hour resolution
- **P1**: 4 hour response, 24 hour resolution
- **P2**: 24 hour response, 7 day resolution
- **P3**: 7 day response, 30 day resolution

### Communication

- **Internal**: Immediate notification to security team
- **External**: Within 24 hours for P0/P1 incidents
- **Public**: Post-mortem after resolution

## Compliance

### Privacy

- **GDPR**: Compliance for EU users
- **Data Minimization**: Collect only necessary data
- **User Rights**: Data access, deletion, portability

### Standards

- **OWASP**: OWASP Top 10 compliance
- **NIST**: NIST Cybersecurity Framework
- **Industry Best Practices**: Regular security assessments

## Security Checklist

### Before Deployment

- [ ] No secrets in code or git history
- [ ] All dependencies up to date
- [ ] Security tests passing
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring configured
- [ ] Backup/restore tested

### Ongoing

- [ ] Monthly security audit
- [ ] Quarterly penetration test
- [ ] Regular secret rotation
- [ ] Security training for team
- [ ] Update security documentation

## Contact

**Security Issues**: Report via GitHub Security Advisories or direct contact

## Version History

- 2026-06-12: Initial security policy document
