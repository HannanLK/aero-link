data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
}

resource "aws_kms_key" "cmk_pci" {
  description             = "${var.prefix} PCI-DSS CMK — payment data encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableRootAccess"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${local.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "CloudTrailEncrypt"
        Effect = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action   = ["kms:GenerateDataKey*", "kms:Decrypt"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "cmk_pci" {
  name          = "alias/${var.prefix}/cmk-pci"
  target_key_id = aws_kms_key.cmk_pci.key_id
}

resource "aws_kms_key" "cmk_pii" {
  description             = "${var.prefix} PII CMK — passenger personal data encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableRootAccess"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${local.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = { Service = "logs.${local.region}.amazonaws.com" }
        Action   = ["kms:Encrypt*", "kms:Decrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "cmk_pii" {
  name          = "alias/${var.prefix}/cmk-pii"
  target_key_id = aws_kms_key.cmk_pii.key_id
}

resource "aws_kms_key" "cmk_infra" {
  description             = "${var.prefix} Infra CMK — EKS secrets, S3, ECR, non-PII logs"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableRootAccess"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${local.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = { Service = "logs.${local.region}.amazonaws.com" }
        Action   = ["kms:Encrypt*", "kms:Decrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource = "*"
      },
      {
        Sid    = "AllowS3"
        Effect = "Allow"
        Principal = { Service = "s3.amazonaws.com" }
        Action   = ["kms:GenerateDataKey*", "kms:Decrypt"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "cmk_infra" {
  name          = "alias/${var.prefix}/cmk-infra"
  target_key_id = aws_kms_key.cmk_infra.key_id
}
