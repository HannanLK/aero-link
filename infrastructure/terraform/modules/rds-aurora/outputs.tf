output "cluster_endpoint"  { value = aws_rds_cluster.main.endpoint; sensitive = true }
output "reader_endpoint"   { value = aws_rds_cluster.main.reader_endpoint; sensitive = true }
output "cluster_id"        { value = aws_rds_cluster.main.id }
output "cluster_arn"       { value = aws_rds_cluster.main.arn }
output "security_group_id" { value = aws_security_group.aurora.id }
output "master_username"   { value = aws_rds_cluster.main.master_username }
