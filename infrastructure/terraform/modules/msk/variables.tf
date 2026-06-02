variable "prefix"               { type = string }
variable "vpc_id"               { type = string }
variable "private_subnet_ids"   { type = list(string) }
variable "eks_sg_id"            { type = string }
variable "kafka_version"        { type = string }
variable "broker_instance_type" { type = string }
variable "cmk_pii_arn"          { type = string }
