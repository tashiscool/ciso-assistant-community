# CISO Assistant - Ubuntu FIPS Deployment

Deploy CISO Assistant on Ubuntu 20.04/22.04 LTS with FIPS 140-2/140-3 validated cryptography for federal and government compliance.

## Features

- **FIPS-Validated Cryptography**: Ubuntu Pro FIPS packages
- **AWS GovCloud Support**: Default region us-gov-west-1
- **RDS PostgreSQL**: IAM authentication support
- **S3 Storage**: IAM role-based access
- **ElastiCache/SQS**: Redis or SQS task queue options

## Prerequisites

### Ubuntu Pro Subscription

FIPS packages require Ubuntu Pro. Options:

1. **Commercial Subscription**: https://ubuntu.com/pro
2. **AWS GovCloud AMIs**: Some include Ubuntu Pro
3. **Free Personal**: 5 machines at https://ubuntu.com/pro/dashboard

### AWS Infrastructure

1. **EC2 Instance**
   - Ubuntu 20.04 or 22.04 LTS AMI
   - Instance type: t3.medium+ (recommended: m5.large)
   - IAM role with required permissions

2. **RDS PostgreSQL**
   - PostgreSQL 14+
   - IAM authentication enabled
   - Security group allowing port 5432

3. **S3 Bucket**
   - Private bucket for file storage

4. **ElastiCache Redis** (Optional)
   - Redis 6.x+
   - In-transit encryption enabled

### IAM Role Policy

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "RDSIAMAuth",
            "Effect": "Allow",
            "Action": "rds-db:connect",
            "Resource": "arn:aws-us-gov:rds-db:us-gov-west-1:ACCOUNT_ID:dbuser:DB_RESOURCE_ID/ciso_app"
        },
        {
            "Sid": "S3Access",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws-us-gov:s3:::YOUR_BUCKET",
                "arn:aws-us-gov:s3:::YOUR_BUCKET/*"
            ]
        }
    ]
}
```

## Deployment

### Quick Start

```bash
# SSH to your instance
ssh ubuntu@your-instance

# Download and run deployment script
curl -O https://raw.githubusercontent.com/tashiscool/ciso-assistant-community/main/deploy/ubuntu-fips/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

### Deployment Phases

The script runs through these phases:

1. **FIPS Setup**: Enables Ubuntu Pro FIPS packages
2. **System Packages**: Installs Python 3.11, Node.js 20
3. **Application**: Clones repo, sets up backend/frontend
4. **Configuration**: Interactive configuration wizard
5. **Services**: Creates systemd services, configures nginx

### FIPS Enablement

If FIPS is not already enabled:

```bash
# Attach Ubuntu Pro (if needed)
sudo pro attach <your-token>

# Enable FIPS
sudo pro enable fips-updates

# Reboot required!
sudo reboot

# Verify after reboot
cat /proc/sys/crypto/fips_enabled  # Should be 1
```

## Management Console

After deployment, use the management console:

```bash
# Interactive menu
sudo ciso-assistant

# Direct commands
sudo ciso-assistant status     # Service status
sudo ciso-assistant restart    # Restart services
sudo ciso-assistant ssl        # Setup SSL (Let's Encrypt)
sudo ciso-assistant fips       # Check FIPS compliance
sudo ciso-assistant health     # Health checks
```

## FIPS Compliance Check

Verify FIPS compliance:

```bash
sudo ciso-assistant fips

# Or directly:
sudo /opt/ciso-assistant/scripts/check-fips.sh --verbose
```

This checks:
- Kernel FIPS mode
- Ubuntu Pro status
- OpenSSL FIPS provider
- FIPS-approved algorithms
- Python cryptography backend
- Nginx SSL configuration

## Configuration

### Environment Variables

Edit `/etc/ciso-assistant/env`:

```bash
# Django
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=False
ALLOWED_HOSTS=your-domain.gov

# Application URL
CISO_ASSISTANT_URL=https://your-domain.gov

# Database (RDS IAM Auth)
POSTGRES_NAME=ciso_assistant
POSTGRES_USER=ciso_app
DB_HOST=your-db.xxx.rds.amazonaws.com
DB_PORT=5432
RDS_IAM_AUTH=True
DB_SSL_MODE=require

# AWS
AWS_REGION=us-gov-west-1

# S3
USE_S3=True
AWS_AUTH_MODE=iam
AWS_STORAGE_BUCKET_NAME=your-bucket

# Redis (optional)
USE_REDIS=True
REDIS_HOST=your-redis.cache.amazonaws.com
REDIS_PORT=6379
REDIS_SSL=True

# FIPS Mode
FIPS_MODE=True
```

### SSL Certificates (Let's Encrypt Recommended)

```bash
# Interactive setup
sudo ciso-assistant ssl

# Direct Let's Encrypt
sudo ciso-assistant ssl --letsencrypt

# Check certificate status
sudo ciso-assistant ssl --check
```

## Helper Scripts

Located in `/opt/ciso-assistant/scripts/`:

| Script | Purpose |
|--------|---------|
| `check-fips.sh` | FIPS compliance verification |
| `setup-ssl.sh` | SSL certificate management |
| `test-db.sh` | Database connection testing |
| `run-migrations.sh` | Database migrations |
| `create-admin.sh` | Admin user management |
| `manage-services.sh` | Service management |

## Troubleshooting

### FIPS Not Enabled After Reboot

```bash
# Check kernel command line
cat /proc/cmdline | grep fips

# Check Ubuntu Pro status
pro status

# Re-enable if needed
sudo pro enable fips-updates --assume-yes
sudo reboot
```

### Database Connection Issues

```bash
# Full diagnostic
sudo ciso-assistant db --verbose

# Test IAM auth token generation
sudo /opt/ciso-assistant/scripts/test-db.sh
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo ciso-assistant ssl --check

# Renew Let's Encrypt
sudo certbot renew

# View nginx config
sudo nginx -t
```

### Service Issues

```bash
# Check all services
sudo ciso-assistant health

# View specific logs
sudo journalctl -u ciso-assistant-backend -f

# Restart services
sudo ciso-assistant restart
```

## Security Considerations

- FIPS mode must be enabled for federal compliance
- Use Let's Encrypt or agency-issued certificates
- Keep Ubuntu Pro subscription active for security updates
- Enable VPC endpoints for AWS services
- Configure AWS WAF for additional protection
- Regular security patching: `sudo apt update && sudo apt upgrade`

## Updates

```bash
# Update CISO Assistant
sudo ciso-assistant update

# Or directly
sudo /opt/ciso-assistant/update.sh
```

## Comparison: Ubuntu FIPS vs RHEL 8

| Feature | Ubuntu FIPS | RHEL 8 |
|---------|-------------|--------|
| FIPS Source | Ubuntu Pro | Built-in |
| Package Manager | apt | dnf |
| SSL Path | /etc/ssl/ | /etc/pki/tls/ |
| SELinux | AppArmor | SELinux |
| Firewall | ufw | firewalld |
| Cost | Ubuntu Pro subscription | RHEL subscription |
