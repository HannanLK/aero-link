# Baggage tracking table
resource "aws_dynamodb_table" "baggage" {
  name         = "${var.prefix}-baggage"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "bagId"

  attribute {
    name = "bagId"
    type = "S"
  }

  attribute {
    name = "barcode"
    type = "S"
  }

  attribute {
    name = "bookingId"
    type = "S"
  }

  attribute {
    name = "flightId"
    type = "S"
  }

  global_secondary_index {
    name            = "barcode-index"
    hash_key        = "barcode"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "booking-index"
    hash_key        = "bookingId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "flight-index"
    hash_key        = "flightId"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.cmk_pii_arn
  }

  point_in_time_recovery { enabled = true }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = { Name = "${var.prefix}-baggage" }
}

# Notification delivery log table
resource "aws_dynamodb_table" "notifications" {
  name         = "${var.prefix}-notifications"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "createdAt"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "type"
    type = "S"
  }

  global_secondary_index {
    name            = "type-index"
    hash_key        = "type"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.cmk_pii_arn
  }

  point_in_time_recovery { enabled = true }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = { Name = "${var.prefix}-notifications" }
}
