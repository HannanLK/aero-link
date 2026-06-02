output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_name" {
  description = "EKS cluster name — used by kubectl and GitHub Actions"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "ecr_repository_urls" {
  description = "ECR repo URLs keyed by service name — used by CI to push images"
  value       = module.ecr.repository_urls
}

output "api_gateway_url" {
  description = "HTTP API Gateway base URL — set as VITE_API_BASE_URL in webui build"
  value       = module.api_gateway.http_api_url
}

output "api_gateway_websocket_url" {
  description = "WebSocket API Gateway URL — set as VITE_WS_BASE_URL in webui build"
  value       = module.api_gateway.websocket_api_url
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_app_client_id" {
  value = module.cognito.app_client_id
}

output "aurora_cluster_endpoint" {
  description = "Aurora writer endpoint"
  value       = module.rds_aurora.cluster_endpoint
  sensitive   = true
}

output "aurora_reader_endpoint" {
  value     = module.rds_aurora.reader_endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.elasticache.primary_endpoint
  sensitive = true
}

output "msk_bootstrap_brokers_tls" {
  description = "MSK Kafka TLS bootstrap brokers — used by all services"
  value       = module.msk.bootstrap_brokers_tls
  sensitive   = true
}

output "cloudfront_distribution_domain" {
  description = "CloudFront domain name for the frontend"
  value       = module.s3_cloudfront.cloudfront_domain_name
}

output "kms_cmk_pci_arn" {
  value     = module.kms.cmk_pci_arn
  sensitive = true
}

output "kms_cmk_pii_arn" {
  value     = module.kms.cmk_pii_arn
  sensitive = true
}

output "kms_cmk_infra_arn" {
  value     = module.kms.cmk_infra_arn
  sensitive = true
}

output "lambda_qr_function_arn" {
  value = module.lambda_qr.function_arn
}

output "alb_dns_name" {
  description = "ALB DNS name — Route 53 A alias target"
  value       = module.eks_addons.alb_dns_name
}
