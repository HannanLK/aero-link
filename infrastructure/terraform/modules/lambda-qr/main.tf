# ─── IAM execution role ───────────────────────────────────────────────────────

resource "aws_iam_role" "lambda_qr" {
  name = "${var.prefix}-lambda-qr-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_qr_basic" {
  role       = aws_iam_role.lambda_qr.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_qr_extras" {
  role = aws_iam_role.lambda_qr.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow"; Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]; Resource = "*" },
    ]
  })
}

# Allow checkin-service to invoke this function
resource "aws_lambda_permission" "checkin_invoke" {
  statement_id  = "AllowCheckinServiceInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.qr_generator.function_name
  principal     = var.checkin_role_arn
  # principal_org_id not needed — same account, role-based allow
  source_arn    = null

  depends_on = [aws_lambda_function.qr_generator]
}

# ─── Security group ───────────────────────────────────────────────────────────

resource "aws_security_group" "lambda_qr" {
  name        = "${var.prefix}-lambda-qr-sg"
  description = "Lambda QR generator"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ─── Lambda function ──────────────────────────────────────────────────────────

resource "aws_lambda_function" "qr_generator" {
  function_name = "${var.prefix}-qr-generator"
  role          = aws_iam_role.lambda_qr.arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_url}:latest"
  memory_size   = 512
  timeout       = 10

  tracing_config { mode = "Active" }

  environment {
    variables = { LOG_LEVEL = "info" }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda_qr.id, var.eks_sg_id]
  }

  # CI/CD updates the image; Terraform manages config only after first deploy.
  lifecycle {
    ignore_changes = [image_uri]
  }
}
