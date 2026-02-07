# ---------------------------------------------------------------------------
# Production environment — wraps the ciso-assistant-eb module
# ---------------------------------------------------------------------------

module "ciso_assistant" {
  source = "../../modules/ciso-assistant-eb"

  # Network
  vpc_cidr              = "${var.vpc_cidr}"
  public_subnet_1_cidr  = "${var.public_subnet_1_cidr}"
  public_subnet_2_cidr  = "${var.public_subnet_2_cidr}"
  private_subnet_1_cidr = "${var.private_subnet_1_cidr}"
  private_subnet_2_cidr = "${var.private_subnet_2_cidr}"

  # Certificate
  acm_certificate_arn = "${var.acm_certificate_arn}"

  # Application
  ciso_assistant_url = "${var.ciso_assistant_url}"
  environment_name   = "${var.environment_name}"
  log_level          = "${var.log_level}"
  stack_name         = "${var.stack_name}"

  # Database
  db_instance_class    = "${var.db_instance_class}"
  db_name              = "${var.db_name}"
  db_master_username   = "${var.db_master_username}"
  db_master_password   = "${var.db_master_password}"
  db_allocated_storage = "${var.db_allocated_storage}"
  use_rds_iam_auth     = "${var.use_rds_iam_auth}"

  # Redis
  redis_node_type = "${var.redis_node_type}"

  # S3
  s3_bucket_name = "${var.s3_bucket_name}"

  # Backend
  backend_instance_type = "${var.backend_instance_type}"
  backend_min_instances = "${var.backend_min_instances}"
  backend_max_instances = "${var.backend_max_instances}"
  gunicorn_workers      = "${var.gunicorn_workers}"
  gunicorn_timeout      = "${var.gunicorn_timeout}"

  # Frontend
  frontend_instance_type = "${var.frontend_instance_type}"
  frontend_min_instances = "${var.frontend_min_instances}"
  frontend_max_instances = "${var.frontend_max_instances}"

  # Secrets
  django_secret_key      = "${var.django_secret_key}"
  django_superuser_email = "${var.django_superuser_email}"

  # Access
  key_pair_name = "${var.key_pair_name}"
}

output "application_url" { value = "${module.ciso_assistant.application_url}" }
output "alb_dns_name" { value = "${module.ciso_assistant.alb_dns_name}" }
output "backend_health_check" { value = "${module.ciso_assistant.backend_health_check}" }
output "rds_endpoint" { value = "${module.ciso_assistant.rds_endpoint}" }
output "redis_endpoint" { value = "${module.ciso_assistant.redis_endpoint}" }
output "s3_bucket_name" { value = "${module.ciso_assistant.s3_bucket_name}" }
output "vpc_id" { value = "${module.ciso_assistant.vpc_id}" }
