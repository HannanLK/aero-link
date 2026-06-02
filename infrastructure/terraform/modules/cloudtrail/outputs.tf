output "trail_arn"          { value = aws_cloudtrail.main.arn }
output "log_bucket_name"    { value = aws_s3_bucket.trail.bucket }
output "log_group_name"     { value = aws_cloudwatch_log_group.trail.name }
