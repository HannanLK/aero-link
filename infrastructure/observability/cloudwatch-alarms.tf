# CloudWatch Alarms — deploy as a separate Terraform module or include in environments/dev
# All alarms route to the SNS alerts topic created in main.tf.

variable "prefix"              { type = string }
variable "sns_alert_topic_arn" { type = string }

# ─── API Gateway ─────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  alarm_name          = "${var.prefix}-api-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "API Gateway 5XX errors > 10 in 2 minutes"
  alarm_actions       = [var.sns_alert_topic_arn]
  ok_actions          = [var.sns_alert_topic_arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "api_p99_latency" {
  alarm_name          = "${var.prefix}-api-p99-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "IntegrationLatency"
  namespace           = "AWS/ApiGateway"
  extended_statistic  = "p99"
  period              = 60
  threshold           = 3000
  alarm_description   = "API GW P99 latency > 3s"
  alarm_actions       = [var.sns_alert_topic_arn]
  treat_missing_data  = "notBreaching"
}

# ─── Aurora ───────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "aurora_cpu" {
  alarm_name          = "${var.prefix}-aurora-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Aurora CPU > 80% for 3 minutes"
  alarm_actions       = [var.sns_alert_topic_arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "aurora_storage" {
  alarm_name          = "${var.prefix}-aurora-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120  # 5 GB
  alarm_description   = "Aurora free storage < 5 GB"
  alarm_actions       = [var.sns_alert_topic_arn]
  treat_missing_data  = "notBreaching"
}

# ─── ElastiCache ──────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "${var.prefix}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis memory > 80%"
  alarm_actions       = [var.sns_alert_topic_arn]
  treat_missing_data  = "notBreaching"
}

# ─── MSK Kafka lag ────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "kafka_booking_lag" {
  alarm_name          = "${var.prefix}-kafka-booking-lag-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "OffsetLag"
  namespace           = "AWS/Kafka"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1000
  dimensions = {
    "Cluster Name"   = "${var.prefix}-msk"
    "Consumer Group" = "booking-service-group"
  }
  alarm_description   = "Booking saga consumer lag > 1000 messages"
  alarm_actions       = [var.sns_alert_topic_arn]
  treat_missing_data  = "notBreaching"
}

# ─── Lambda QR ────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_qr_errors" {
  alarm_name          = "${var.prefix}-lambda-qr-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  dimensions          = { FunctionName = "${var.prefix}-qr-generator" }
  alarm_description   = "Lambda QR errors > 5 in 1 minute"
  alarm_actions       = [var.sns_alert_topic_arn]
  treat_missing_data  = "notBreaching"
}
