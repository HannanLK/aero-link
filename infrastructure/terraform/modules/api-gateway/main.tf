# ─── HTTP API ─────────────────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.prefix}-http-api"
  protocol_type = "HTTP"
  description   = "AeroLink HTTP API — routes to EKS ALB"

  cors_configuration {
    allow_origins = ["https://${var.domain_name}", "http://localhost:5173"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Correlation-ID", "Idempotency-Key"]
    max_age       = 3600
  }
}

# JWT Authorizer using Cognito
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.http.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [var.cognito_app_client_id]
    issuer   = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# ─── ALB Integration (INTERNET — ALB is public-facing) ───────────────────────
# NOTE: VPC Link requires an ELB listener ARN as integration_uri, which is not
# available until the ALB is created by the LBC controller (chicken-and-egg).
# We use INTERNET connection type since the ALB is internet-facing (public subnets).
resource "aws_apigatewayv2_integration" "alb" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = "https://${var.alb_dns_name}"
  connection_type    = "INTERNET"

  # NOTE: For HTTP_PROXY with INTERNET, the full request path is forwarded automatically.
  # Do NOT use {proxy} in the URI — it requires all routes to have a matching path variable.
}

# Routes — protected (JWT required)
locals {
  protected_routes = [
    "ANY /api/v1/flights/{proxy+}",
    "ANY /api/v1/bookings/{proxy+}",
    "ANY /api/v1/payments/{proxy+}",
    "ANY /api/v1/checkin/{proxy+}",
    "ANY /api/v1/baggage/{proxy+}",
    "ANY /api/v1/notifications/{proxy+}",
    "ANY /api/v1/users/{proxy+}",
  ]
}

resource "aws_apigatewayv2_route" "protected" {
  for_each = toset(local.protected_routes)

  api_id             = aws_apigatewayv2_api.http.id
  route_key          = each.value
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

# Public routes (no auth — login/register)
resource "aws_apigatewayv2_route" "public_auth" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /api/v1/auth/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /api/v1/health/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

# Stage with access logging
resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/apigateway/${var.prefix}"
  retention_in_days = 30
  kms_key_id        = var.cmk_infra_arn
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    throttling_burst_limit   = 1000
    throttling_rate_limit    = 500
    detailed_metrics_enabled = true
  }
}

# NOTE: WAFv2 cannot be associated with an HTTP (apigatewayv2) API; WAF is
# applied at the CloudFront layer instead (see module.waf_cloudfront).

# Custom domain
resource "aws_apigatewayv2_domain_name" "main" {
  domain_name = "api.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "main" {
  api_id      = aws_apigatewayv2_api.http.id
  domain_name = aws_apigatewayv2_domain_name.main.id
  stage       = aws_apigatewayv2_stage.default.id
}

resource "aws_route53_record" "api" {
  zone_id = var.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.main.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.main.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# ─── WebSocket API ────────────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.prefix}-ws-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_integration" "ws_alb" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "HTTP_PROXY"
  integration_method = "POST"
  integration_uri    = "http://${var.alb_dns_name}/ws"
  connection_type    = "INTERNET"
}

resource "aws_apigatewayv2_route" "ws_connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_alb.id}"
}

resource "aws_apigatewayv2_route" "ws_disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_alb.id}"
}

resource "aws_apigatewayv2_route" "ws_default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.ws_alb.id}"
}

resource "aws_apigatewayv2_stage" "ws" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = "v1"
  auto_deploy = true
}

data "aws_region" "current" {}
