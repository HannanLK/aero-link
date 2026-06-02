output "cloudfront_domain_name"     { value = aws_cloudfront_distribution.webui.domain_name }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.webui.id }
output "logs_bucket_name"           { value = aws_s3_bucket.logs.bucket }
output "logs_bucket_id"             { value = aws_s3_bucket.logs.id }
