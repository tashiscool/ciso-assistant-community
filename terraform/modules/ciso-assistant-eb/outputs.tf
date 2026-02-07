output "application_url" {
  description = "Application URL"
  value       = local.app_url
}

output "alb_dns_name" {
  description = "ALB DNS name - point your CNAME or alias record here"
  value       = aws_lb.alb.dns_name
}

output "backend_health_check" {
  description = "Backend health check URL"
  value       = "https://${aws_lb.alb.dns_name}/api/health/"
}

output "rds_endpoint" {
  description = "PostgreSQL endpoint"
  value       = aws_db_instance.postgres.address
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "s3_bucket_name" {
  description = "S3 bucket for attachments"
  value       = aws_s3_bucket.attachments.id
}

output "backend_environment_name" {
  description = "Backend EB environment name"
  value       = aws_elastic_beanstalk_environment.backend.name
}

output "frontend_environment_name" {
  description = "Frontend EB environment name"
  value       = aws_elastic_beanstalk_environment.frontend.name
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}
