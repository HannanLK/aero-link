output "http_api_id"         { value = aws_apigatewayv2_api.http.id }
output "http_api_url"        { value = "https://api.${var.domain_name}" }
output "websocket_api_id"    { value = aws_apigatewayv2_api.websocket.id }
output "websocket_api_url"   { value = aws_apigatewayv2_stage.ws.invoke_url }
