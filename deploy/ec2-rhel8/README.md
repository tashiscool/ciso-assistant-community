# CISO Assistant - EC2 RHEL 8 Deployment

Deploy CISO Assistant on AWS EC2 with RHEL 8, using:
- RDS PostgreSQL with IAM authentication
- S3 for file storage
- ElastiCache Redis for caching and task queue (optional)
- Nginx reverse proxy
- Systemd services

## Prerequisites

### AWS Infrastructure

1. **EC2 Instance**
   - RHEL 8 AMI
   - Instance type: t3.medium or larger (recommended: m5.large for production)
   - IAM role attached with required permissions
   - Security group allowing ports 80, 443

2. **RDS PostgreSQL**
   - PostgreSQL 14+
   - IAM authentication enabled
   - Security group allowing port 5432 from EC2

3. **S3 Bucket**
   - Private bucket for file storage
   - Versioning enabled (recommended)

4. **ElastiCache Redis** (Optional)
   - Redis 6.x+
   - Cluster mode disabled (single node or replication group)
   - Security group allowing port 6379 from EC2

### IAM Role Permissions

Attach this policy to your EC2 instance role:

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
                "arn:aws-us-gov:s3:::YOUR_BUCKET_NAME",
                "arn:aws-us-gov:s3:::YOUR_BUCKET_NAME/*"
            ]
        }
    ]
}
```

### RDS Database Setup

Connect to RDS as master user and run:

```sql
-- Create application user for IAM auth
CREATE USER ciso_app WITH LOGIN;
GRANT rds_iam TO ciso_app;

-- Create database
CREATE DATABASE ciso_assistant OWNER ciso_app;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ciso_assistant TO ciso_app;
```

## Deployment

### Quick Start

```bash
# SSH to your EC2 instance
ssh ec2-user@your-instance

# Download deployment script
curl -O https://raw.githubusercontent.com/tashiscool/ciso-assistant-community/main/deploy/ec2-rhel8/deploy.sh
chmod +x deploy.sh

# Run deployment
sudo ./deploy.sh
```

### Post-Deployment Configuration

1. **Edit configuration:**
   ```bash
   sudo vi /etc/ciso-assistant/env
   ```

2. **Add SSL certificates:**
   ```bash
   # Option 1: Use Let's Encrypt (if public DNS)
   sudo dnf install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.gov

   # Option 2: Use your own certificates
   sudo cp your-cert.crt /etc/pki/tls/certs/server.crt
   sudo cp your-key.key /etc/pki/tls/private/server.key
   ```

3. **Run migrations:**
   ```bash
   source /opt/ciso-assistant/venv/bin/activate
   cd /opt/ciso-assistant/app/backend
   source /etc/ciso-assistant/env
   python manage.py migrate
   ```

4. **Create admin user:**
   ```bash
   python manage.py createsuperuser
   ```

5. **Restart services:**
   ```bash
   sudo systemctl restart ciso-assistant-backend
   sudo systemctl restart ciso-assistant-frontend
   sudo systemctl restart ciso-assistant-worker
   sudo systemctl restart nginx
   ```

## Configuration

### Environment Variables

Edit `/etc/ciso-assistant/env`:

```bash
# Django
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=False
ALLOWED_HOSTS=your-domain.gov,your-ip

# Application URL
CISO_ASSISTANT_URL=https://your-domain.gov

# Database (RDS IAM Auth)
POSTGRES_NAME=ciso_assistant
POSTGRES_USER=ciso_app
DB_HOST=your-db.xxx.us-gov-west-1.rds.amazonaws.com
DB_PORT=5432
RDS_IAM_AUTH=True
DB_SSL_MODE=require
CONN_MAX_AGE=840

# AWS
AWS_REGION=us-gov-west-1

# S3
USE_S3=True
AWS_AUTH_MODE=iam
AWS_STORAGE_BUCKET_NAME=your-bucket-name

# ElastiCache (Optional)
USE_REDIS=True
REDIS_HOST=your-redis.xxx.cache.amazonaws.com
REDIS_PORT=6379
REDIS_SSL=True

# Admin
CISO_ASSISTANT_SUPERUSER_EMAIL=admin@your-domain.gov

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
```

### ElastiCache Configuration

If using ElastiCache Redis:

1. Create ElastiCache Redis cluster in same VPC
2. Configure security group to allow port 6379 from EC2
3. Enable in-transit encryption (TLS)
4. Set environment variables:
   ```bash
   USE_REDIS=True
   REDIS_HOST=your-cluster.xxx.cache.amazonaws.com
   REDIS_PORT=6379
   REDIS_SSL=True
   ```

## Service Management

```bash
# View status
sudo systemctl status ciso-assistant-backend
sudo systemctl status ciso-assistant-frontend
sudo systemctl status ciso-assistant-worker

# Restart services
sudo systemctl restart ciso-assistant-backend
sudo systemctl restart ciso-assistant-frontend
sudo systemctl restart ciso-assistant-worker

# View logs
sudo journalctl -u ciso-assistant-backend -f
sudo journalctl -u ciso-assistant-frontend -f
tail -f /var/log/ciso-assistant/*.log
```

## Updating

```bash
sudo /opt/ciso-assistant/update.sh
```

## Troubleshooting

### Test RDS IAM Connection

```bash
sudo -u ciso-assistant /opt/ciso-assistant/venv/bin/python \
    /opt/ciso-assistant/app/backend/manage.py test_rds_iam --json
```

### Test Redis Connection

```bash
redis-cli -h your-redis.cache.amazonaws.com -p 6379 --tls ping
```

### Check SELinux

```bash
# View denials
sudo ausearch -m avc -ts recent

# If needed, generate policy
sudo ausearch -c 'nginx' --raw | audit2allow -M nginx-ciso
sudo semodule -i nginx-ciso.pp
```

### Common Issues

1. **502 Bad Gateway**: Backend not running
   ```bash
   sudo systemctl status ciso-assistant-backend
   sudo journalctl -u ciso-assistant-backend -n 50
   ```

2. **Database connection failed**: Check IAM permissions and security groups
   ```bash
   python manage.py test_rds_iam
   ```

3. **S3 upload failed**: Check IAM role and bucket policy
   ```bash
   aws s3 ls s3://your-bucket/ --region us-gov-west-1
   ```

## Security Considerations

- Keep the EC2 instance in a private subnet with NAT gateway
- Use VPC endpoints for S3 and other AWS services
- Enable CloudWatch logging
- Configure AWS WAF in front of ALB (if using)
- Regularly update the application and system packages
- Use AWS Secrets Manager for sensitive configuration (optional enhancement)
