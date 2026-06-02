output "repository_urls" {
  description = "Map of service name → ECR repository URL"
  value = merge(
    { for k, v in aws_ecr_repository.services : k => v.repository_url },
    { "lambda-qr" = aws_ecr_repository.lambda_qr.repository_url }
  )
}
