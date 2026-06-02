resource "aws_db_subnet_group" "main" {
  name       = "${var.prefix}-aurora-subnet-group"
  subnet_ids = var.database_subnet_ids
}

resource "aws_security_group" "aurora" {
  name        = "${var.prefix}-aurora-sg"
  description = "Allow PostgreSQL from EKS nodes only"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
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

resource "aws_rds_cluster_parameter_group" "main" {
  name   = "${var.prefix}-aurora-pg16"
  family = "aurora-postgresql16"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"  # Log DDL only — avoid logging PII from DML
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log queries > 1 second
  }
}

resource "aws_rds_cluster" "main" {
  cluster_identifier      = "${var.prefix}-aurora"
  engine                  = "aurora-postgresql"
  engine_version          = var.engine_version
  database_name           = "postgres"  # default DB; each service creates its own DB via migration
  master_username         = "aerolink_admin"
  master_password         = var.master_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.aurora.id]
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name

  storage_encrypted   = true
  kms_key_id          = var.cmk_pii_arn

  deletion_protection  = false   # Must be false to allow terraform destroy
  skip_final_snapshot  = true    # No snapshot on destroy (dev only)
  copy_tags_to_snapshot = true

  backup_retention_period   = 7
  preferred_backup_window   = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql"]
}

# Writer instance
resource "aws_rds_cluster_instance" "writer" {
  identifier           = "${var.prefix}-aurora-writer"
  cluster_identifier   = aws_rds_cluster.main.id
  instance_class       = var.instance_class
  engine               = aws_rds_cluster.main.engine
  engine_version       = aws_rds_cluster.main.engine_version
  publicly_accessible  = false

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = var.cmk_pii_arn
  performance_insights_retention_period = 7

  monitoring_interval = 30
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
}

# Reader instance (Multi-AZ — different AZ from writer for HA)
resource "aws_rds_cluster_instance" "reader" {
  identifier           = "${var.prefix}-aurora-reader"
  cluster_identifier   = aws_rds_cluster.main.id
  instance_class       = var.instance_class
  engine               = aws_rds_cluster.main.engine
  engine_version       = aws_rds_cluster.main.engine_version
  publicly_accessible  = false

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = var.cmk_pii_arn
  performance_insights_retention_period = 7

  monitoring_interval = 30
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
}

# Enhanced monitoring role
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.prefix}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# AWS Backup plan for Aurora
resource "aws_backup_vault" "aurora" {
  name        = "${var.prefix}-aurora-backup-vault"
  kms_key_arn = var.cmk_pii_arn
}

resource "aws_backup_plan" "aurora" {
  name = "${var.prefix}-aurora-backup-plan"

  rule {
    rule_name         = "daily-backup"
    target_vault_name = aws_backup_vault.aurora.name
    schedule          = "cron(0 3 * * ? *)"
    start_window      = 60
    completion_window = 120

    lifecycle {
      delete_after = 7
    }
  }
}

resource "aws_backup_selection" "aurora" {
  iam_role_arn = aws_iam_role.backup.arn
  name         = "${var.prefix}-aurora-selection"
  plan_id      = aws_backup_plan.aurora.id

  resources = [aws_rds_cluster.main.arn]
}

resource "aws_iam_role" "backup" {
  name = "${var.prefix}-aws-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}
