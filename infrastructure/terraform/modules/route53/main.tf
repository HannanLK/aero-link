# Creates the hosted zone only. DNS records (api, www, argocd) are added by
# api-gateway, s3-cloudfront, and eks-addons modules which receive zone_id.

resource "aws_route53_zone" "main" {
  name = var.domain_name
}

resource "aws_route53_health_check" "api" {
  fqdn              = "api.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = { Name = "${var.prefix}-api-health-check" }
}
