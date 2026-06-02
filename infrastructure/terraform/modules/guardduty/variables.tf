variable "prefix"              { type = string }
variable "sns_alert_topic_arn" {
  type    = string
  default = ""
  description = "SNS topic ARN for high-severity finding alerts. Leave empty to skip."
}
