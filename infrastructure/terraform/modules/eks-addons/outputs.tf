output "alb_dns_name" {
  description = "ALB DNS name provisioned by AWS Load Balancer Controller"
  value       = try(data.kubernetes_ingress_v1.argocd.status[0].load_balancer[0].ingress[0].hostname, "")
}
