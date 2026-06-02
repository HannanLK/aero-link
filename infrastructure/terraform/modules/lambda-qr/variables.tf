variable "prefix"              { type = string }
variable "vpc_id"              { type = string }
variable "private_subnet_ids"  { type = list(string) }
variable "eks_sg_id"           { type = string }
variable "ecr_repository_url"  { type = string }
variable "cmk_infra_arn"       { type = string }
variable "checkin_role_arn"    { type = string }
