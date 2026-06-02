variable "prefix"           { type = string }
variable "cidr_block"       { type = string }
variable "azs"              { type = list(string) }
variable "public_subnets"   { type = list(string) }
variable "private_subnets"  { type = list(string) }
variable "database_subnets" { type = list(string) }
variable "eks_cluster_name" { type = string }
variable "cmk_infra_arn"    { type = string }
