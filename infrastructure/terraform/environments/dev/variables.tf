variable "aws_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "project" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "aerolink"
}

variable "domain_name" {
  description = "Root domain for Route 53 hosted zone (e.g. aerolink.app)"
  type        = string
}

variable "eks_kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.30"
}

variable "eks_node_instance_type" {
  description = "EC2 instance type for EKS managed node group"
  type        = string
  default     = "t3.medium"
}

variable "eks_node_min" {
  type    = number
  default = 2
}

variable "eks_node_max" {
  type    = number
  default = 6
}

variable "eks_node_desired" {
  type    = number
  default = 2
}

variable "aurora_instance_class" {
  description = "Aurora PostgreSQL instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "aurora_engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "16.2"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t3.micro"
}

variable "msk_broker_instance_type" {
  description = "MSK Kafka broker instance type"
  type        = string
  default     = "kafka.t3.small"
}

variable "msk_kafka_version" {
  type    = string
  default = "3.6.0"
}

variable "notification_email_sender" {
  description = "Verified SES sender email address"
  type        = string
}

variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
}

variable "db_master_password" {
  description = "Aurora master password — store in CI secrets, never in tfvars"
  type        = string
  sensitive   = true
}

variable "alb_dns_name_override" {
  description = "Real ALB DNS name from the AWS Load Balancer Controller. Leave empty on first apply; set after ALB is provisioned."
  type        = string
  default     = ""
}
