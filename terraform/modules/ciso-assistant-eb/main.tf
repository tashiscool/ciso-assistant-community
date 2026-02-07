# ===========================================================================
# CISO Assistant — Elastic Beanstalk on AWS
# Terraform 0.12 compatible
#
# Deployment Prerequisites (checked into the repo):
#   backend/  — Procfile, .ebextensions/01_packages.config,
#               .platform/hooks/postdeploy/01_migrate.sh,
#               requirements.txt (poetry export -f requirements.txt -o requirements.txt)
#   frontend/ — Procfile, build output from "npm run build"
# ===========================================================================

provider "aws" {
  version = "~> 2.0"
  region  = "us-east-1"
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  az_a           = data.aws_availability_zones.available.names[0]
  az_b           = data.aws_availability_zones.available.names[1]
  has_key_pair   = var.key_pair_name != ""
  has_custom_url = var.ciso_assistant_url != ""
  has_s3_name    = var.s3_bucket_name != ""
  app_url        = local.has_custom_url ? var.ciso_assistant_url : "https://${aws_lb.alb.dns_name}"
  backend_api    = "${local.app_url}/api"
}

# ===========================================================================
# Tier 1 — Networking
# ===========================================================================
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${var.stack_name}-vpc" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.stack_name}-igw" }
}

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_1_cidr
  availability_zone       = local.az_a
  map_public_ip_on_launch = true
  tags                    = { Name = "${var.stack_name}-public-1" }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_2_cidr
  availability_zone       = local.az_b
  map_public_ip_on_launch = true
  tags                    = { Name = "${var.stack_name}-public-2" }
}

resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_1_cidr
  availability_zone = local.az_a
  tags              = { Name = "${var.stack_name}-private-1" }
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_2_cidr
  availability_zone = local.az_b
  tags              = { Name = "${var.stack_name}-private-2" }
}

resource "aws_eip" "nat" {
  vpc  = true
  tags = { Name = "${var.stack_name}-nat-eip" }
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_1.id
  tags          = { Name = "${var.stack_name}-nat" }
  depends_on    = [aws_internet_gateway.igw]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.stack_name}-public-rt" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.stack_name}-private-rt" }
}

resource "aws_route" "private_nat" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.nat.id
}

resource "aws_route_table_association" "private_1" {
  subnet_id      = aws_subnet.private_1.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_2" {
  subnet_id      = aws_subnet.private_2.id
  route_table_id = aws_route_table.private.id
}

# ===========================================================================
# Tier 2 — Security Groups
# ===========================================================================
resource "aws_security_group" "alb" {
  name_prefix = "${var.stack_name}-alb-"
  description = "ALB - allow HTTP/HTTPS from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.stack_name}-alb-sg" }
}

resource "aws_security_group" "backend" {
  name_prefix = "${var.stack_name}-backend-"
  description = "Backend instances - allow 8000 from ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.stack_name}-backend-sg" }
}

resource "aws_security_group" "frontend" {
  name_prefix = "${var.stack_name}-frontend-"
  description = "Frontend instances - allow 3000 from ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.stack_name}-frontend-sg" }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.stack_name}-rds-"
  description = "RDS - allow 5432 from backend only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  tags = { Name = "${var.stack_name}-rds-sg" }
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.stack_name}-redis-"
  description = "Redis - allow 6379 from backend only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  tags = { Name = "${var.stack_name}-redis-sg" }
}

# ===========================================================================
# Tier 3 — Data Tier
# ===========================================================================
resource "aws_db_subnet_group" "main" {
  name       = "${var.stack_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
  tags       = { Name = "${var.stack_name}-db-subnet-group" }
}

resource "aws_db_instance" "postgres" {
  identifier                          = "${var.stack_name}-postgres"
  engine                              = "postgres"
  engine_version                      = "16.6"
  instance_class                      = var.db_instance_class
  allocated_storage                   = var.db_allocated_storage
  storage_type                        = "gp3"
  storage_encrypted                   = true
  name                                = var.db_name
  username                            = var.db_master_username
  password                            = var.db_master_password
  iam_database_authentication_enabled = var.use_rds_iam_auth
  db_subnet_group_name                = aws_db_subnet_group.main.name
  vpc_security_group_ids              = [aws_security_group.rds.id]
  multi_az                            = false
  backup_retention_period             = 7
  preferred_backup_window             = "03:00-04:00"
  preferred_maintenance_window        = "sun:04:30-sun:05:30"
  deletion_protection                 = true
  copy_tags_to_snapshot               = true
  skip_final_snapshot                 = false
  final_snapshot_identifier           = "${var.stack_name}-postgres-final"
  tags                                = { Name = "${var.stack_name}-rds" }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.stack_name}-redis-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id                 = "${var.stack_name}-redis"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  num_cache_nodes            = 1
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  transit_encryption_enabled = true
  tags                       = { Name = "${var.stack_name}-redis" }
}

resource "aws_s3_bucket" "attachments" {
  bucket = local.has_s3_name ? var.s3_bucket_name : null
  acl    = "private"

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  tags = { Name = "${var.stack_name}-attachments" }
}

resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket                  = aws_s3_bucket.attachments.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ===========================================================================
# Tier 4 — IAM
# ===========================================================================
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "eb_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["elasticbeanstalk.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backend" {
  name               = "${var.stack_name}-backend-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "backend_eb" {
  role       = aws_iam_role.backend.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
}

resource "aws_iam_role_policy" "backend_s3" {
  name   = "S3Access"
  role   = aws_iam_role.backend.id
  policy = <<-POLICY
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": ["${aws_s3_bucket.attachments.arn}", "${aws_s3_bucket.attachments.arn}/*"]
    }]
  }
  POLICY
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_role_policy" "backend_cloudwatch" {
  name   = "CloudWatchLogs"
  role   = aws_iam_role.backend.id
  policy = <<-POLICY
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
      "Resource": "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/elasticbeanstalk/*"
    }]
  }
  POLICY
}

resource "aws_iam_role_policy" "backend_rds_iam" {
  count  = var.use_rds_iam_auth ? 1 : 0
  name   = "RDSIAMConnect"
  role   = aws_iam_role.backend.id
  policy = <<-POLICY
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "rds-db:connect",
      "Resource": "arn:aws:rds-db:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbuser:${aws_db_instance.postgres.resource_id}/${var.db_master_username}"
    }]
  }
  POLICY
}

resource "aws_iam_instance_profile" "backend" {
  name = "${var.stack_name}-backend-ip"
  role = aws_iam_role.backend.name
}

resource "aws_iam_role" "frontend" {
  name               = "${var.stack_name}-frontend-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "frontend_eb" {
  role       = aws_iam_role.frontend.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
}

resource "aws_iam_role_policy" "frontend_cloudwatch" {
  name   = "CloudWatchLogs"
  role   = aws_iam_role.frontend.id
  policy = <<-POLICY
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
      "Resource": "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/elasticbeanstalk/*"
    }]
  }
  POLICY
}

resource "aws_iam_instance_profile" "frontend" {
  name = "${var.stack_name}-frontend-ip"
  role = aws_iam_role.frontend.name
}

resource "aws_iam_role" "eb_service" {
  name               = "${var.stack_name}-eb-service-role"
  assume_role_policy = data.aws_iam_policy_document.eb_assume.json
}

resource "aws_iam_role_policy_attachment" "eb_health" {
  role       = aws_iam_role.eb_service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth"
}

resource "aws_iam_role_policy_attachment" "eb_updates" {
  role       = aws_iam_role.eb_service.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy"
}

# ===========================================================================
# Tier 5 — Application Load Balancer
# ===========================================================================
resource "aws_lb" "alb" {
  name               = "${var.stack_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]
  tags               = { Name = "${var.stack_name}-alb" }
}

resource "aws_lb_target_group" "backend" {
  name     = "${var.stack_name}-backend-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/api/health/"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = { Name = "${var.stack_name}-backend-tg" }
}

resource "aws_lb_target_group" "frontend" {
  name     = "${var.stack_name}-frontend-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = { Name = "${var.stack_name}-frontend-tg" }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.acm_certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    field  = "path-pattern"
    values = ["/api/*"]
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      protocol    = "HTTPS"
      port        = "443"
      status_code = "HTTP_301"
    }
  }
}

# ===========================================================================
# Tier 6 — Elastic Beanstalk
# ===========================================================================
resource "aws_elastic_beanstalk_application" "app" {
  name        = "${var.stack_name}-app"
  description = "CISO Assistant GRC Platform"
}

resource "aws_elastic_beanstalk_environment" "backend" {
  name                = "${var.stack_name}-backend"
  application         = aws_elastic_beanstalk_application.app.name
  solution_stack_name = "64bit Amazon Linux 2023 v4.3.0 running Python 3.11"
  tier                = "WebServer"

  # -- Instance --
  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "InstanceType"
    value     = var.backend_instance_type
  }
  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = aws_iam_instance_profile.backend.name
  }
  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.backend.id
  }

  # -- Auto Scaling --
  setting {
    namespace = "aws:autoscaling:asg"
    name      = "MinSize"
    value     = var.backend_min_instances
  }
  setting {
    namespace = "aws:autoscaling:asg"
    name      = "MaxSize"
    value     = var.backend_max_instances
  }

  # -- VPC --
  setting {
    namespace = "aws:ec2:vpc"
    name      = "VPCId"
    value     = aws_vpc.main.id
  }
  setting {
    namespace = "aws:ec2:vpc"
    name      = "Subnets"
    value     = "${aws_subnet.private_1.id},${aws_subnet.private_2.id}"
  }
  setting {
    namespace = "aws:ec2:vpc"
    name      = "ELBSubnets"
    value     = "${aws_subnet.public_1.id},${aws_subnet.public_2.id}"
  }
  setting {
    namespace = "aws:ec2:vpc"
    name      = "AssociatePublicIpAddress"
    value     = "false"
  }

  # -- Shared ALB --
  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "LoadBalancerType"
    value     = "application"
  }
  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "LoadBalancerIsShared"
    value     = "true"
  }
  setting {
    namespace = "aws:elbv2:loadbalancer"
    name      = "SharedLoadBalancer"
    value     = aws_lb.alb.arn
  }
  setting {
    namespace = "aws:elbv2:listener:default"
    name      = "ListenerEnabled"
    value     = "false"
  }

  # -- Process --
  setting {
    namespace = "aws:elasticbeanstalk:environment:process:default"
    name      = "Port"
    value     = "8000"
  }
  setting {
    namespace = "aws:elasticbeanstalk:environment:process:default"
    name      = "Protocol"
    value     = "HTTP"
  }
  setting {
    namespace = "aws:elasticbeanstalk:environment:process:default"
    name      = "HealthCheckPath"
    value     = "/api/health/"
  }

  # -- Enhanced Health --
  setting {
    namespace = "aws:elasticbeanstalk:healthreporting:system"
    name      = "SystemType"
    value     = "enhanced"
  }
  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "ServiceRole"
    value     = aws_iam_role.eb_service.name
  }

  # -- Managed Updates --
  setting {
    namespace = "aws:elasticbeanstalk:managedactions"
    name      = "ManagedActionsEnabled"
    value     = "true"
  }
  setting {
    namespace = "aws:elasticbeanstalk:managedactions"
    name      = "PreferredStartTime"
    value     = "Sun:06:00"
  }
  setting {
    namespace = "aws:elasticbeanstalk:managedactions:platformupdate"
    name      = "UpdateLevel"
    value     = "minor"
  }

  # -- Environment Variables --
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DJANGO_SETTINGS_MODULE"
    value     = "ciso_assistant.settings"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DJANGO_SECRET_KEY"
    value     = var.django_secret_key
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DJANGO_DEBUG"
    value     = "False"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "ALLOWED_HOSTS"
    value     = local.has_custom_url ? var.ciso_assistant_url : aws_lb.alb.dns_name
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "CISO_ASSISTANT_URL"
    value     = local.app_url
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DB_HOST"
    value     = aws_db_instance.postgres.address
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DB_PORT"
    value     = aws_db_instance.postgres.port
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DB_NAME"
    value     = var.db_name
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "POSTGRES_USER"
    value     = var.db_master_username
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "POSTGRES_PASSWORD"
    value     = var.db_master_password
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "REDIS_HOST"
    value     = aws_elasticache_cluster.redis.cache_nodes[0].address
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "REDIS_PORT"
    value     = aws_elasticache_cluster.redis.cache_nodes[0].port
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "USE_REDIS"
    value     = "True"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "REDIS_SSL"
    value     = "True"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "AWS_STORAGE_BUCKET_NAME"
    value     = aws_s3_bucket.attachments.id
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "USE_S3"
    value     = "True"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "AWS_AUTH_MODE"
    value     = "iam"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "GUNICORN_WORKERS"
    value     = var.gunicorn_workers
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "GUNICORN_TIMEOUT"
    value     = var.gunicorn_timeout
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "LOG_LEVEL"
    value     = var.log_level
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DJANGO_SUPERUSER_EMAIL"
    value     = var.django_superuser_email
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "ENVIRONMENT"
    value     = var.environment_name
  }
}

resource "aws_elastic_beanstalk_environment" "frontend" {
  name                = "${var.stack_name}-frontend"
  application         = aws_elastic_beanstalk_application.app.name
  solution_stack_name = "64bit Amazon Linux 2023 v6.4.0 running Node.js 20"
  tier                = "WebServer"

  depends_on = [aws_elastic_beanstalk_environment.backend]

  # -- Instance --
  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "InstanceType"
    value     = var.frontend_instance_type
  }
  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = aws_iam_instance_profile.frontend.name
  }
  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.frontend.id
  }

  # -- Auto Scaling --
  setting {
    namespace = "aws:autoscaling:asg"
    name      = "MinSize"
    value     = var.frontend_min_instances
  }
  setting {
    namespace = "aws:autoscaling:asg"
    name      = "MaxSize"
    value     = var.frontend_max_instances
  }

  # -- VPC --
  setting {
    namespace = "aws:ec2:vpc"
    name      = "VPCId"
    value     = aws_vpc.main.id
  }
  setting {
    namespace = "aws:ec2:vpc"
    name      = "Subnets"
    value     = "${aws_subnet.private_1.id},${aws_subnet.private_2.id}"
  }
  setting {
    namespace = "aws:ec2:vpc"
    name      = "ELBSubnets"
    value     = "${aws_subnet.public_1.id},${aws_subnet.public_2.id}"
  }
  setting {
    namespace = "aws:ec2:vpc"
    name      = "AssociatePublicIpAddress"
    value     = "false"
  }

  # -- Shared ALB --
  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "LoadBalancerType"
    value     = "application"
  }
  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "LoadBalancerIsShared"
    value     = "true"
  }
  setting {
    namespace = "aws:elbv2:loadbalancer"
    name      = "SharedLoadBalancer"
    value     = aws_lb.alb.arn
  }
  setting {
    namespace = "aws:elbv2:listener:default"
    name      = "ListenerEnabled"
    value     = "false"
  }

  # -- Process --
  setting {
    namespace = "aws:elasticbeanstalk:environment:process:default"
    name      = "Port"
    value     = "3000"
  }
  setting {
    namespace = "aws:elasticbeanstalk:environment:process:default"
    name      = "Protocol"
    value     = "HTTP"
  }
  setting {
    namespace = "aws:elasticbeanstalk:environment:process:default"
    name      = "HealthCheckPath"
    value     = "/"
  }

  # -- Enhanced Health --
  setting {
    namespace = "aws:elasticbeanstalk:healthreporting:system"
    name      = "SystemType"
    value     = "enhanced"
  }
  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "ServiceRole"
    value     = aws_iam_role.eb_service.name
  }

  # -- Managed Updates --
  setting {
    namespace = "aws:elasticbeanstalk:managedactions"
    name      = "ManagedActionsEnabled"
    value     = "true"
  }
  setting {
    namespace = "aws:elasticbeanstalk:managedactions"
    name      = "PreferredStartTime"
    value     = "Sun:06:00"
  }
  setting {
    namespace = "aws:elasticbeanstalk:managedactions:platformupdate"
    name      = "UpdateLevel"
    value     = "minor"
  }

  # -- Environment Variables --
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "PUBLIC_BACKEND_API_URL"
    value     = local.backend_api
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "BODY_SIZE_LIMIT"
    value     = "25000000"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "PROTOCOL_HEADER"
    value     = "x-forwarded-proto"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "HOST_HEADER"
    value     = "x-forwarded-host"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "ORIGIN"
    value     = local.app_url
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NODE_ENV"
    value     = "production"
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "PORT"
    value     = "3000"
  }
}
