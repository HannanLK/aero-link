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

# VPC Link to ALB (private integration)
resource "aws_apigatewayv2_vpc_link" "main" {
  name               = "${var.prefix}-vpc-link"
  security_group_ids = [aws_security_group.api_gw.id]
  subnet_ids         = var.private_subnet_ids
}

resource "aws_security_group" "api_gw" {
  name        = "${var.prefix}-apigw-sg"
  description = "API Gateway VPC Link security group"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ALB Integration
resource "aws_apigatewayv2_integration" "alb" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = "http://${var.alb_dns_name}/{proxy}"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.main.id

  request_parameters = {
    "overwrite:header.x-user-id"    = "$context.authorizer.claims.sub"
    "overwrite:header.x-user-roles" = "$context.authorizer.claims.custom:roles"
    "overwrite:header.x-correlation-id" = "$context.requestId"
  }
}

# Routes — protected (JWT required)
locals {
  protected_routes = [
    "ANY /flights/{proxy+}",
    "ANY /bookings/{proxy+}",
    "ANY /payments/{proxy+}",
    "ANY /checkin/{proxy+}",
    "ANY /baggage/{proxy+}",
    "ANY /notifications/{proxy+}",
    "ANY /users/{proxy+}",
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
  route_key = "ANY /auth/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /health"
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

# WAF association
resource "aws_wafv2_web_acl_association" "api_gw" {
  resource_arn = aws_apigatewayv2_stage.default.arn
  web_acl_arn  = var.waf_web_acl_arn
}

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
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.main.id
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
