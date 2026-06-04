resource "aws_cognito_user_pool" "main" {
  name = "${var.prefix}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  schema {
    name                = "roles"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  user_pool_add_ons {
    advanced_security_mode = "AUDIT"
  }
}

resource "random_string" "cognito_domain_suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.prefix}-auth-${random_string.cognito_domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# SPA App Client (PKCE flow, no client secret)
resource "aws_cognito_user_pool_client" "spa" {
  name         = "${var.prefix}-spa-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  callback_urls = [
    "https://${var.domain_name}/auth/callback",
    "http://localhost:5173/auth/callback",  # local dev
  ]

  logout_urls = [
    "https://${var.domain_name}",
    "http://localhost:5173",
  ]

  supported_identity_providers = ["COGNITO"]

  access_token_validity  = 60    # minutes
  id_token_validity      = 60
  refresh_token_validity = 30    # days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  read_attributes = [
    "email", "given_name", "family_name", "phone_number",
    "custom:roles",
  ]

  write_attributes = [
    "email", "given_name", "family_name", "phone_number",
  ]
}

# Resource server defining the 'internal' scope used by the service client
resource "aws_cognito_resource_server" "internal" {
  identifier   = var.prefix
  name         = "${var.prefix}-internal"
  user_pool_id = aws_cognito_user_pool.main.id

  scope {
    scope_name        = "internal"
    scope_description = "Service-to-service internal access"
  }
}

# Service-to-service App Client (client credentials)
resource "aws_cognito_user_pool_client" "service" {
  depends_on = [aws_cognito_resource_server.internal]
  name         = "${var.prefix}-service-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = true
  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["${var.prefix}/internal"]
  supported_identity_providers         = ["COGNITO"]

  access_token_validity = 60
  token_validity_units { access_token = "minutes" }
}

# Default roles — created in Cognito as initial users' group
resource "aws_cognito_user_group" "roles" {
  for_each = toset([
    "CUSTOMER",
    "FLIGHT_ATTENDANT",
    "GATE_AGENT",
    "IMMIGRATION_OFFICER",
    "AIRLINE_ADMIN",
    "AIRCRAFT_CREW",
  ])

  name         = each.value
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "AeroLink role: ${each.value}"
}
