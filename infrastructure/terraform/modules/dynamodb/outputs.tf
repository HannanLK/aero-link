output "baggage_table_name"       { value = aws_dynamodb_table.baggage.name }
output "baggage_table_arn"        { value = aws_dynamodb_table.baggage.arn }
output "notification_table_name"  { value = aws_dynamodb_table.notifications.name }
output "notification_table_arn"   { value = aws_dynamodb_table.notifications.arn }
