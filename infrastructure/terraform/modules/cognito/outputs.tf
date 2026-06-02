output "user_pool_id"     { value = aws_cognito_user_pool.main.id }
output "user_pool_arn"    { value = aws_cognito_user_pool.main.arn }
output "app_client_id"    { value = aws_cognito_user_pool_client.spa.id }
output "hosted_ui_domain" { value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com" }

data "aws_region" "current" {}
