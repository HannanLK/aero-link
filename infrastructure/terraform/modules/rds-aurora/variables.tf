variable "prefix"              { type = string }
variable "vpc_id"              { type = string }
variable "database_subnet_ids" { type = list(string) }
variable "eks_sg_id"           { type = string }
variable "engine_version"      { type = string }
variable "instance_class"      { type = string }
variable "master_password"     { type = string; sensitive = true }
variable "cmk_pii_arn"         { type = string }
variable "cmk_pci_arn"         { type = string }
variable "databases"           { type = list(string) }
