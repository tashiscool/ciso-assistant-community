# ---------------------------------------------------------------------------
# CISO Assistant — Production Environment
# Copy this file and fill in your values before deploying.
# ---------------------------------------------------------------------------

# Network
vpc_cidr              = "10.0.0.0/16"
public_subnet_1_cidr  = "10.0.1.0/24"
public_subnet_2_cidr  = "10.0.2.0/24"
private_subnet_1_cidr = "10.0.10.0/24"
private_subnet_2_cidr = "10.0.11.0/24"

# Certificate (REQUIRED)
acm_certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERTIFICATE_ID"

# Application
ciso_assistant_url = "" # Leave blank to use ALB DNS, or set e.g. "https://grc.example.com"
environment_name   = "production"
log_level          = "INFO"
stack_name         = "ciso-assistant"

# Database
db_instance_class    = "db.t3.medium"
db_name              = "ciso_assistant"
db_master_username   = "ciso_admin"
db_master_password   = "CHANGE_ME_MIN_12_CHARS" # Use -var or TF_VAR_ env var instead
db_allocated_storage = 50
use_rds_iam_auth     = false

# Redis
redis_node_type = "cache.t3.small"

# S3
s3_bucket_name = "" # Leave blank for auto-generated

# Backend
backend_instance_type = "t3.medium"
backend_min_instances = 2
backend_max_instances = 6
gunicorn_workers      = 3
gunicorn_timeout      = 120

# Frontend
frontend_instance_type = "t3.small"
frontend_min_instances = 2
frontend_max_instances = 4

# Secrets (REQUIRED - prefer TF_VAR_ env vars)
django_secret_key      = "CHANGE_ME_MIN_32_CHARS"
django_superuser_email = "admin@example.com"

# Access
key_pair_name = "" # Leave blank to disable SSH
