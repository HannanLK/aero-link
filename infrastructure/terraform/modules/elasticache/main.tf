resource "aws_security_group" "redis" {
  name        = "${var.prefix}-redis-sg"
  description = "ElastiCache Redis — allow from EKS nodes only"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_sg_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.prefix}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.prefix}-redis"
  description          = "AeroLink session cache, seat locks, idempotency keys"

  node_type             = var.node_type
  num_cache_clusters    = 2     # 1 primary + 1 replica for HA
  port                  = 6379
  parameter_group_name  = "default.redis7"
  engine_version        = "7.1"
  subnet_group_name     = aws_elasticache_subnet_group.main.name
  security_group_ids    = [aws_security_group.redis.id]

  at_rest_encryption_enabled  = true
  kms_key_id                  = var.cmk_pii_arn
  transit_encryption_enabled  = true
  auth_token                  = random_password.redis_auth.result

  automatic_failover_enabled  = true
  multi_az_enabled            = true

  snapshot_retention_limit    = 1
  snapshot_window             = "03:00-04:00"

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
}

resource "random_password" "redis_auth" {
  length  = 32
  special = false  # Redis AUTH token cannot contain commas or spaces
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = "/aerolink/dev/shared/redis-auth-token"
  secret_string = random_password.redis_auth.result

  lifecycle {
    ignore_changes = [secret_id]  # Secret resource created in main env module
  }
}

resource "aws_cloudwatch_log_group" "redis" {
  name              = "/aws/elasticache/${var.prefix}"
  retention_in_days = 7
  kms_key_id        = var.cmk_pii_arn
}
