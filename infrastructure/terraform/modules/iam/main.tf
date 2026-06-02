locals {
  oidc_issuer_clean = replace(var.eks_oidc_issuer, "https://", "")
}

# ─── Helper: IRSA trust policy ────────────────────────────────────────────────

data "aws_iam_policy_document" "irsa_trust" {
  for_each = toset([
    "identity-service",
    "flight-service",
    "booking-service",
    "payment-service",
    "checkin-service",
    "baggage-service",
    "notification-service",
    "aws-load-balancer-controller",
    "cluster-autoscaler",
    "external-secrets",
    "fluent-bit",
  ])

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.eks_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer_clean}:sub"
      values   = ["system:serviceaccount:aerolink:${each.key}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer_clean}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

# ─── identity-service ─────────────────────────────────────────────────────────

resource "aws_iam_role" "identity_service" {
  name               = "${var.prefix}-identity-service-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["identity-service"].json
}

resource "aws_iam_role_policy" "identity_service" {
  role = aws_iam_role.identity_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/identity-service/*" },
      { Effect = "Allow"; Action = ["kms:Decrypt", "kms:GenerateDataKey"]; Resource = var.cmk_pii_arn },
      { Effect = "Allow"; Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]; Resource = "*" },
      { Effect = "Allow"; Action = ["logs:CreateLogStream", "logs:PutLogEvents"]; Resource = "*" },
      { Effect = "Allow"; Action = ["cognito-idp:AdminGetUser", "cognito-idp:AdminUpdateUserAttributes"]; Resource = "*" },
    ]
  })
}

# ─── flight-service ───────────────────────────────────────────────────────────

resource "aws_iam_role" "flight_service" {
  name               = "${var.prefix}-flight-service-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["flight-service"].json
}

resource "aws_iam_role_policy" "flight_service" {
  role = aws_iam_role.flight_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/flight-service/*" },
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/shared/*" },
      { Effect = "Allow"; Action = ["kms:Decrypt", "kms:GenerateDataKey"]; Resource = var.cmk_pii_arn },
      { Effect = "Allow"; Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]; Resource = "*" },
      { Effect = "Allow"; Action = ["logs:CreateLogStream", "logs:PutLogEvents"]; Resource = "*" },
    ]
  })
}

# ─── booking-service ──────────────────────────────────────────────────────────

resource "aws_iam_role" "booking_service" {
  name               = "${var.prefix}-booking-service-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["booking-service"].json
}

resource "aws_iam_role_policy" "booking_service" {
  role = aws_iam_role.booking_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/booking-service/*" },
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/shared/*" },
      { Effect = "Allow"; Action = ["kms:Decrypt", "kms:GenerateDataKey"]; Resource = var.cmk_pii_arn },
      { Effect = "Allow"; Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]; Resource = "*" },
      { Effect = "Allow"; Action = ["logs:CreateLogStream", "logs:PutLogEvents"]; Resource = "*" },
    ]
  })
}

# ─── payment-service (PCI — most restrictive) ────────────────────────────────

resource "aws_iam_role" "payment_service" {
  name               = "${var.prefix}-payment-service-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["payment-service"].json
}

resource "aws_iam_role_policy" "payment_service" {
  role = aws_iam_role.payment_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/payment-service/*" },
      { Effect = "Allow"; Action = ["kms:Decrypt", "kms:GenerateDataKey"]; Resource = var.cmk_pci_arn },
      { Effect = "Allow"; Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]; Resource = "*" },
      { Effect = "Allow"; Action = ["logs:CreateLogStream", "logs:PutLogEvents"]; Resource = "*" },
    ]
  })
}

# ─── checkin-service ──────────────────────────────────────────────────────────

resource "aws_iam_role" "checkin_service" {
  name               = "${var.prefix}-checkin-service-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["checkin-service"].json
}

resource "aws_iam_role_policy" "checkin_service" {
  role = aws_iam_role.checkin_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/checkin-service/*" },
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/shared/*" },
      { Effect = "Allow"; Action = ["lambda:InvokeFunction"]; Resource = var.lambda_qr_arn },
      { Effect = "Allow"; Action = ["kms:Decrypt", "kms:GenerateDataKey"]; Resource = var.cmk_pii_arn },
      { Effect = "Allow"; Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]; Resource = "*" },
      { Effect = "Allow"; Action = ["logs:CreateLogStream", "logs:PutLogEvents"]; Resource = "*" },
    ]
  })
}

# ─── baggage-service ──────────────────────────────────────────────────────────

resource "aws_iam_role" "baggage_service" {
  name               = "${var.prefix}-baggage-service-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["baggage-service"].json
}

resource "aws_iam_role_policy" "baggage_service" {
  role = aws_iam_role.baggage_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow"; Action = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Query"]; Resource = [var.baggage_table_arn, "${var.baggage_table_arn}/index/*"] },
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/shared/*" },
      { Effect = "Allow"; Action = ["kms:Decrypt", "kms:GenerateDataKey"]; Resource = var.cmk_pii_arn },
      { Effect = "Allow"; Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]; Resource = "*" },
      { Effect = "Allow"; Action = ["logs:CreateLogStream", "logs:PutLogEvents"]; Resource = "*" },
    ]
  })
}

# ─── notification-service ────────────────────────────────────────────────────

resource "aws_iam_role" "notification_service" {
  name               = "${var.prefix}-notification-service-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["notification-service"].json
}

resource "aws_iam_role_policy" "notification_service" {
  role = aws_iam_role.notification_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow"; Action = ["ses:SendEmail", "ses:SendRawEmail"]; Resource = "*" },
      { Effect = "Allow"; Action = ["sns:Publish"]; Resource = "*" },
      { Effect = "Allow"; Action = ["dynamodb:PutItem", "dynamodb:Query"]; Resource = [var.notification_table_arn, "${var.notification_table_arn}/index/*"] },
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/dev/shared/*" },
      { Effect = "Allow"; Action = ["kms:Decrypt", "kms:GenerateDataKey"]; Resource = var.cmk_pii_arn },
      { Effect = "Allow"; Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]; Resource = "*" },
      { Effect = "Allow"; Action = ["logs:CreateLogStream", "logs:PutLogEvents"]; Resource = "*" },
    ]
  })
}

# ─── Platform add-on roles ───────────────────────────────────────────────────

resource "aws_iam_role" "lbc" {
  name               = "${var.prefix}-lbc-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["aws-load-balancer-controller"].json
}

resource "aws_iam_role_policy_attachment" "lbc" {
  role       = aws_iam_role.lbc.name
  policy_arn = "arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess"
}

resource "aws_iam_role" "cluster_autoscaler" {
  name               = "${var.prefix}-cluster-autoscaler-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["cluster-autoscaler"].json
}

resource "aws_iam_role_policy" "cluster_autoscaler" {
  role = aws_iam_role.cluster_autoscaler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["autoscaling:DescribeAutoScalingGroups", "autoscaling:DescribeAutoScalingInstances", "autoscaling:DescribeLaunchConfigurations", "autoscaling:DescribeScalingActivities", "autoscaling:DescribeTags", "autoscaling:SetDesiredCapacity", "autoscaling:TerminateInstanceInAutoScalingGroup", "ec2:DescribeImages", "ec2:DescribeInstanceTypes", "ec2:DescribeLaunchTemplateVersions", "ec2:GetInstanceTypesFromInstanceRequirements", "eks:DescribeNodegroup"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "external_secrets" {
  name               = "${var.prefix}-external-secrets-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["external-secrets"].json
}

resource "aws_iam_role_policy" "external_secrets" {
  role = aws_iam_role.external_secrets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow"; Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]; Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:/aerolink/*" },
      { Effect = "Allow"; Action = ["kms:Decrypt"]; Resource = [var.cmk_pci_arn, var.cmk_pii_arn, var.cmk_infra_arn] },
    ]
  })
}

resource "aws_iam_role" "fluent_bit" {
  name               = "${var.prefix}-fluent-bit-role"
  assume_role_policy = data.aws_iam_policy_document.irsa_trust["fluent-bit"].json
}

resource "aws_iam_role_policy_attachment" "fluent_bit" {
  role       = aws_iam_role.fluent_bit.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}
