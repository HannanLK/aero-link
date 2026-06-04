resource "aws_guardduty_detector" "main" {
  enable = true

  datasources {
    s3_logs              { enable = true }
    kubernetes {
      audit_logs { enable = true }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes { enable = true }
      }
    }
  }
}

resource "aws_cloudwatch_event_rule" "guardduty_high" {
  name        = "${var.prefix}-guardduty-high-severity"
  description = "GuardDuty findings with severity >= 7"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", 7] }]
    }
  })
}

resource "aws_cloudwatch_event_target" "guardduty_sns" {
  rule      = aws_cloudwatch_event_rule.guardduty_high.name
  target_id = "SendToSNS"
  arn       = var.sns_alert_topic_arn
}
