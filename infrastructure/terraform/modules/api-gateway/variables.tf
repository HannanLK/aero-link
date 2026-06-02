variable "prefix"                 { type = string }
variable "aws_region"             { type = string }
variable "alb_dns_name"           { type = string }
variable "cognito_user_pool_arn"  { type = string }
variable "cognito_user_pool_id"   { type = string }
variable "cognito_app_client_id"  { type = string }
variable "waf_web_acl_arn"        { type = string }
variable "domain_name"            { type = string }
variable "certificate_arn"        { type = string }
variable "zone_id"                { type = string }
variable "cmk_infra_arn"          { type = string }
variable "vpc_id"                 { type = string; default = "" }
variable "private_subnet_ids"     { type = list(string); default = [] }
