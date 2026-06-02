output "primary_endpoint"       { value = aws_elasticache_replication_group.main.primary_endpoint_address; sensitive = true }
output "reader_endpoint"        { value = aws_elasticache_replication_group.main.reader_endpoint_address; sensitive = true }
output "replication_group_id"   { value = aws_elasticache_replication_group.main.id }
output "security_group_id"      { value = aws_security_group.redis.id }
