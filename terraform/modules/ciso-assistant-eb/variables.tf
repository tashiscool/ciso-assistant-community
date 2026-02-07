# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_1_cidr" {
  description = "Public subnet 1 (AZ-a)"
  type        = string
  default     = "10.0.1.0/24"
}

variable "public_subnet_2_cidr" {
  description = "Public subnet 2 (AZ-b)"
  type        = string
  default     = "10.0.2.0/24"
}

variable "private_subnet_1_cidr" {
  description = "Private subnet 1 (AZ-a)"
  type        = string
  default     = "10.0.10.0/24"
}

variable "private_subnet_2_cidr" {
  description = "Private subnet 2 (AZ-b)"
  type        = string
  default     = "10.0.11.0/24"
}

# ---------------------------------------------------------------------------
# Certificate
# ---------------------------------------------------------------------------
variable "acm_certificate_arn" {
  description = "ARN of an ACM certificate for HTTPS on the ALB"
  type        = string
}

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
variable "ciso_assistant_url" {
  description = "Public URL (e.g. https://grc.example.com). Leave blank to use ALB DNS."
  type        = string
  default     = ""
}

variable "environment_name" {
  description = "Deployment environment name"
  type        = string
  default     = "production"
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "INFO"
}

variable "stack_name" {
  description = "Prefix for all resource names"
  type        = string
  default     = "ciso-assistant"
}

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "ciso_assistant"
}

variable "db_master_username" {
  description = "RDS master username"
  type        = string
  default     = "ciso_admin"
}

variable "db_master_password" {
  description = "RDS master password (min 12 characters)"
  type        = string
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 50
}

variable "use_rds_iam_auth" {
  description = "Enable IAM authentication for RDS"
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.small"
}

# ---------------------------------------------------------------------------
# S3
# ---------------------------------------------------------------------------
variable "s3_bucket_name" {
  description = "S3 bucket name for attachments. Leave blank for auto-generated."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------
variable "backend_instance_type" {
  description = "EC2 instance type for backend"
  type        = string
  default     = "t3.medium"
}

variable "backend_min_instances" {
  description = "Minimum backend instances"
  type        = number
  default     = 2
}

variable "backend_max_instances" {
  description = "Maximum backend instances"
  type        = number
  default     = 6
}

variable "gunicorn_workers" {
  description = "Number of Gunicorn worker processes"
  type        = number
  default     = 3
}

variable "gunicorn_timeout" {
  description = "Gunicorn request timeout in seconds"
  type        = number
  default     = 120
}

# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
variable "frontend_instance_type" {
  description = "EC2 instance type for frontend"
  type        = string
  default     = "t3.small"
}

variable "frontend_min_instances" {
  description = "Minimum frontend instances"
  type        = number
  default     = 2
}

variable "frontend_max_instances" {
  description = "Maximum frontend instances"
  type        = number
  default     = 4
}

# ---------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------
variable "django_secret_key" {
  description = "Django SECRET_KEY (min 32 characters)"
  type        = string
}

variable "django_superuser_email" {
  description = "Email address for the initial Django superuser"
  type        = string
}

# ---------------------------------------------------------------------------
# Access
# ---------------------------------------------------------------------------
variable "key_pair_name" {
  description = "EC2 key pair name for SSH. Leave blank to disable."
  type        = string
  default     = ""
}
