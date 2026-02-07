# Re-declare all module variables so they can be passed via terraform.tfvars
variable "vpc_cidr" { type = "string" }
variable "public_subnet_1_cidr" { type = "string" }
variable "public_subnet_2_cidr" { type = "string" }
variable "private_subnet_1_cidr" { type = "string" }
variable "private_subnet_2_cidr" { type = "string" }
variable "acm_certificate_arn" { type = "string" }
variable "ciso_assistant_url" { type = "string" }
variable "environment_name" { type = "string" }
variable "log_level" { type = "string" }
variable "stack_name" { type = "string" }
variable "db_instance_class" { type = "string" }
variable "db_name" { type = "string" }
variable "db_master_username" { type = "string" }
variable "db_master_password" { type = "string" }
variable "db_allocated_storage" {}
variable "use_rds_iam_auth" {}
variable "redis_node_type" { type = "string" }
variable "s3_bucket_name" { type = "string" }
variable "backend_instance_type" { type = "string" }
variable "backend_min_instances" {}
variable "backend_max_instances" {}
variable "gunicorn_workers" {}
variable "gunicorn_timeout" {}
variable "frontend_instance_type" { type = "string" }
variable "frontend_min_instances" {}
variable "frontend_max_instances" {}
variable "django_secret_key" { type = "string" }
variable "django_superuser_email" { type = "string" }
variable "key_pair_name" { type = "string" }
