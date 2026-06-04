locals {
  prefix = "${var.project}-${var.environment}"
  azs    = ["${var.aws_region}a", "${var.aws_region}b"]

  services = [
    "identity-service",
    "flight-service",
    "booking-service",
    "payment-service",
    "checkin-service",
    "baggage-service",
    "notification-service",
    "webui",
  ]
}

data "aws_caller_identity" "current" {}

# ─── KMS ─────────────────────────────────────────────────────────────────────

module "kms" {
  source     = "../../modules/kms"
  prefix     = local.prefix
  aws_region = var.aws_region
}

# ─── Route 53 hosted zone (created first — ACM needs zone_id for DNS validation) ─

module "route53" {
  source      = "../../modules/route53"
  prefix      = local.prefix
  domain_name = var.domain_name
}

# ─── ACM Certificates ────────────────────────────────────────────────────────
# Regional cert: ALB + API Gateway (default aws provider)
module "acm_regional" {
  source      = "../../modules/acm"
  domain_name = var.domain_name
  zone_id     = module.route53.zone_id
  depends_on  = [module.route53]
}

# CloudFront cert: must live in us-east-1 (aws.us_east_1 provider alias)
module "acm" {
  source      = "../../modules/acm"
  domain_name = var.domain_name
  zone_id     = module.route53.zone_id
  providers   = { aws = aws.us_east_1 }
  depends_on  = [module.route53]
}

# ─── WAF WebACLs ─────────────────────────────────────────────────────────────
# Regional WAF for API Gateway (default provider)
module "waf" {
  source = "../../modules/waf"
  prefix = local.prefix
  scope  = "REGIONAL"
}

# CloudFront WAF — must be in us-east-1
module "waf_cloudfront" {
  source    = "../../modules/waf"
  prefix    = "${local.prefix}-cf"
  scope     = "CLOUDFRONT"
  providers = { aws = aws.us_east_1 }
}

# ─── VPC ─────────────────────────────────────────────────────────────────────

module "vpc" {
  source           = "../../modules/vpc"
  prefix           = local.prefix
  cidr_block       = "10.0.0.0/16"
  azs              = local.azs
  public_subnets   = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets  = ["10.0.10.0/24", "10.0.11.0/24"]
  database_subnets = ["10.0.20.0/24", "10.0.21.0/24"]
  eks_cluster_name = "${local.prefix}-eks"
  cmk_infra_arn    = module.kms.cmk_infra_arn
}

# ─── ECR Repositories ────────────────────────────────────────────────────────

module "ecr" {
  source        = "../../modules/ecr"
  prefix        = local.prefix
  services      = local.services
  cmk_infra_arn = module.kms.cmk_infra_arn
}

# ─── EKS Cluster ─────────────────────────────────────────────────────────────

module "eks" {
  source             = "../../modules/eks"
  prefix             = local.prefix
  kubernetes_version = var.eks_kubernetes_version
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_instance_type = var.eks_node_instance_type
  node_min           = var.eks_node_min
  node_max           = var.eks_node_max
  node_desired       = var.eks_node_desired
  cmk_infra_arn      = module.kms.cmk_infra_arn
}

# ─── DynamoDB ────────────────────────────────────────────────────────────────

module "dynamodb" {
  source      = "../../modules/dynamodb"
  prefix      = local.prefix
  cmk_pii_arn = module.kms.cmk_pii_arn
}

# ─── IAM — IRSA roles ─────────────────────────────────────────────────────────

module "iam" {
  source                 = "../../modules/iam"
  prefix                 = local.prefix
  eks_oidc_provider_arn  = module.eks.oidc_provider_arn
  eks_oidc_issuer        = module.eks.oidc_issuer
  cmk_pci_arn            = module.kms.cmk_pci_arn
  cmk_pii_arn            = module.kms.cmk_pii_arn
  cmk_infra_arn          = module.kms.cmk_infra_arn
  baggage_table_arn      = module.dynamodb.baggage_table_arn
  notification_table_arn = module.dynamodb.notification_table_arn
  lambda_qr_arn          = module.lambda_qr.function_arn
  aws_region             = var.aws_region
  aws_account_id         = data.aws_caller_identity.current.account_id
}

# ─── Lambda QR Generator ─────────────────────────────────────────────────────

module "lambda_qr" {
  source             = "../../modules/lambda-qr"
  prefix             = local.prefix
  ecr_repository_url = module.ecr.repository_urls["lambda-qr"]
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  eks_sg_id          = module.eks.node_security_group_id
  cmk_infra_arn      = module.kms.cmk_infra_arn
  checkin_role_arn   = module.iam.checkin_service_role_arn
}

# ─── EKS Platform Add-ons ────────────────────────────────────────────────────

module "eks_addons" {
  source                         = "../../modules/eks-addons"
  prefix                         = local.prefix
  eks_cluster_name               = module.eks.cluster_name
  eks_cluster_endpoint           = module.eks.cluster_endpoint
  eks_cluster_ca                 = module.eks.cluster_ca_certificate
  aws_region                     = var.aws_region
  vpc_id                         = module.vpc.vpc_id
  public_subnet_ids              = module.vpc.public_subnet_ids
  lbc_role_arn                   = module.iam.lbc_role_arn
  cluster_autoscaler_role_arn    = module.iam.cluster_autoscaler_role_arn
  external_secrets_role_arn      = module.iam.external_secrets_role_arn
  fluent_bit_role_arn            = module.iam.fluent_bit_role_arn
  argocd_ingress_certificate_arn = module.acm_regional.certificate_arn
  domain_name                    = var.domain_name
  depends_on                     = [module.eks, module.iam]
}

# ─── Cognito ─────────────────────────────────────────────────────────────────

module "cognito" {
  source      = "../../modules/cognito"
  prefix      = local.prefix
  domain_name = var.domain_name
  alert_email = var.alert_email
}

# ─── API Gateway ─────────────────────────────────────────────────────────────

module "api_gateway" {
  source                = "../../modules/api-gateway"
  prefix                = local.prefix
  aws_region            = var.aws_region
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  alb_dns_name          = module.eks_addons.alb_dns_name
  cognito_user_pool_arn = module.cognito.user_pool_arn
  cognito_user_pool_id  = module.cognito.user_pool_id
  cognito_app_client_id = module.cognito.app_client_id
  waf_web_acl_arn       = module.waf.web_acl_arn
  domain_name           = var.domain_name
  certificate_arn       = module.acm_regional.certificate_arn
  zone_id               = module.route53.zone_id
  cmk_infra_arn         = module.kms.cmk_infra_arn
}

# ─── Aurora PostgreSQL ────────────────────────────────────────────────────────

module "rds_aurora" {
  source              = "../../modules/rds-aurora"
  prefix              = local.prefix
  vpc_id              = module.vpc.vpc_id
  database_subnet_ids = module.vpc.database_subnet_ids
  eks_sg_id           = module.eks.node_security_group_id
  engine_version      = var.aurora_engine_version
  instance_class      = var.aurora_instance_class
  master_password     = var.db_master_password
  cmk_pii_arn         = module.kms.cmk_pii_arn
  cmk_pci_arn         = module.kms.cmk_pci_arn
  databases           = ["identity_db", "flight_db", "booking_db", "payment_db", "checkin_db"]
}

# ─── ElastiCache Redis ────────────────────────────────────────────────────────

module "elasticache" {
  source             = "../../modules/elasticache"
  prefix             = local.prefix
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  eks_sg_id          = module.eks.node_security_group_id
  node_type          = var.redis_node_type
  cmk_pii_arn        = module.kms.cmk_pii_arn
}

# ─── MSK (Kafka) ─────────────────────────────────────────────────────────────

module "msk" {
  source               = "../../modules/msk"
  prefix               = local.prefix
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  eks_sg_id            = module.eks.node_security_group_id
  kafka_version        = var.msk_kafka_version
  broker_instance_type = var.msk_broker_instance_type
  cmk_pii_arn          = module.kms.cmk_pii_arn
}

# ─── S3 + CloudFront (webui CDN) ─────────────────────────────────────────────

module "s3_cloudfront" {
  source          = "../../modules/s3-cloudfront"
  prefix          = local.prefix
  domain_name     = var.domain_name
  alb_dns_name    = module.eks_addons.alb_dns_name
  certificate_arn = module.acm.certificate_arn
  waf_web_acl_arn = module.waf_cloudfront.web_acl_arn
  zone_id         = module.route53.zone_id
  cmk_infra_arn   = module.kms.cmk_infra_arn
  providers       = { aws = aws.us_east_1 }
}

# ─── CloudTrail ───────────────────────────────────────────────────────────────

module "cloudtrail" {
  source         = "../../modules/cloudtrail"
  prefix         = local.prefix
  aws_account_id = data.aws_caller_identity.current.account_id
  cmk_infra_arn  = module.kms.cmk_infra_arn
}

# ─── GuardDuty ────────────────────────────────────────────────────────────────

module "guardduty" {
  source              = "../../modules/guardduty"
  prefix              = local.prefix
  sns_alert_topic_arn = aws_sns_topic.alerts.arn
}

# ─── SNS Topic for CloudWatch Alarms ─────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name              = "${local.prefix}-alerts"
  kms_master_key_id = module.kms.cmk_infra_arn
}

resource "aws_sns_topic_subscription" "alert_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ─── Secrets Manager — initial secret placeholders ───────────────────────────

resource "aws_secretsmanager_secret" "service_secrets" {
  for_each = toset([
    "identity-service/db-url",
    "flight-service/db-url",
    "booking-service/db-url",
    "payment-service/db-url",
    "payment-service/stripe-api-key",
    "checkin-service/db-url",
    "shared/jwt-public-key",
    "shared/aurora-admin-url",
    "shared/kafka-brokers",
    "shared/redis-url",
    "shared/elastic-apm-server-url",
    "shared/elastic-apm-secret-token",
  ])

  name                    = "/${var.project}/${var.environment}/${each.key}"
  description             = "AeroLink ${each.key} secret"
  kms_key_id              = startswith(each.key, "payment") ? module.kms.cmk_pci_arn : module.kms.cmk_pii_arn
  recovery_window_in_days = 0
}

# ─── SSM Parameter Store — non-secret config ─────────────────────────────────

resource "aws_ssm_parameter" "kafka_brokers" {
  name  = "/${var.project}/${var.environment}/shared/kafka-brokers"
  type  = "String"
  value = module.msk.bootstrap_brokers_tls
}

resource "aws_ssm_parameter" "api_gateway_url" {
  name  = "/${var.project}/${var.environment}/shared/api-gateway-url"
  type  = "String"
  value = module.api_gateway.http_api_url
}

resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name  = "/${var.project}/${var.environment}/shared/cognito-user-pool-id"
  type  = "String"
  value = module.cognito.user_pool_id
}

resource "aws_ssm_parameter" "cognito_app_client_id" {
  name  = "/${var.project}/${var.environment}/shared/cognito-app-client-id"
  type  = "String"
  value = module.cognito.app_client_id
}

# ─── SES Email Identity Verification ─────────────────────────────────────────

resource "aws_ses_email_identity" "sender" {
  email = var.notification_email_sender
}

resource "aws_ses_email_identity" "alert" {
  email = var.alert_email
}
