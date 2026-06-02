# ─── AWS Load Balancer Controller ────────────────────────────────────────────

resource "helm_release" "aws_lbc" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "1.7.2"
  namespace  = "kube-system"

  set { name = "clusterName";                          value = var.eks_cluster_name }
  set { name = "serviceAccount.create";                value = "true" }
  set { name = "serviceAccount.name";                  value = "aws-load-balancer-controller" }
  set { name = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"; value = var.lbc_role_arn }
  set { name = "region";                               value = var.aws_region }
  set { name = "vpcId";                                value = var.vpc_id }
  set { name = "replicaCount";                         value = "2" }
}

# ─── External Secrets Operator ────────────────────────────────────────────────

resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  version    = "0.9.16"
  namespace  = "external-secrets"
  create_namespace = true

  set { name = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"; value = var.external_secrets_role_arn }
  set { name = "replicaCount"; value = "2" }
}

# ClusterSecretStore pointing to AWS Secrets Manager
resource "kubernetes_manifest" "cluster_secret_store" {
  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = "ClusterSecretStore"
    metadata   = { name = "aws-secrets-manager" }
    spec = {
      provider = {
        aws = {
          service = "SecretsManager"
          region  = var.aws_region
          auth    = { jwt = { serviceAccountRef = { name = "external-secrets", namespace = "external-secrets" } } }
        }
      }
    }
  }
  depends_on = [helm_release.external_secrets]
}

# ─── Metrics Server ───────────────────────────────────────────────────────────

resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  version    = "3.12.1"
  namespace  = "kube-system"
}

# ─── Cluster Autoscaler ───────────────────────────────────────────────────────

resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  version    = "9.37.0"
  namespace  = "kube-system"

  set { name = "autoDiscovery.clusterName";            value = var.eks_cluster_name }
  set { name = "awsRegion";                            value = var.aws_region }
  set { name = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"; value = var.cluster_autoscaler_role_arn }
  set { name = "extraArgs.balance-similar-node-groups"; value = "true" }
  set { name = "extraArgs.skip-nodes-with-system-pods"; value = "false" }
}

# ─── KEDA ─────────────────────────────────────────────────────────────────────

resource "helm_release" "keda" {
  name       = "keda"
  repository = "https://kedacore.github.io/charts"
  chart      = "keda"
  version    = "2.14.2"
  namespace  = "keda"
  create_namespace = true

  set { name = "replicaCount"; value = "2" }
}

# ─── Fluent Bit (logs → CloudWatch) ──────────────────────────────────────────

resource "helm_release" "fluent_bit" {
  name       = "fluent-bit"
  repository = "https://fluent.github.io/helm-charts"
  chart      = "fluent-bit"
  version    = "0.46.11"
  namespace  = "logging"
  create_namespace = true

  values = [yamlencode({
    serviceAccount = {
      annotations = {
        "eks.amazonaws.com/role-arn" = var.fluent_bit_role_arn
      }
    }
    config = {
      outputs = <<-EOF
        [OUTPUT]
            Name              cloudwatch_logs
            Match             kube.*
            region            ${var.aws_region}
            log_group_name    /aerolink/dev/$(kubernetes['namespace_name'])/$(kubernetes['labels']['app'])
            log_stream_prefix pod/
            auto_create_group true
      EOF
      filters = <<-EOF
        [FILTER]
            Name                kubernetes
            Match               kube.*
            Merge_Log           On
            Keep_Log            Off
            K8S-Logging.Parser  On
            K8S-Logging.Exclude On
      EOF
    }
  })]
}

# ─── OpenTelemetry Collector (traces → X-Ray + Elastic APM) ──────────────────

resource "helm_release" "otel_collector" {
  name       = "opentelemetry-collector"
  repository = "https://open-telemetry.github.io/opentelemetry-helm-charts"
  chart      = "opentelemetry-collector"
  version    = "0.89.0"
  namespace  = "monitoring"
  create_namespace = true

  values = [yamlencode({
    mode = "deployment"
    config = {
      receivers = {
        otlp = { protocols = { grpc = { endpoint = "0.0.0.0:4317" }, http = { endpoint = "0.0.0.0:4318" } } }
      }
      exporters = {
        awsxray = { region = var.aws_region }
        otlp = {
          endpoint = "$(ELASTIC_APM_SERVER_URL)"
          headers  = { Authorization = "Bearer $(ELASTIC_APM_SECRET_TOKEN)" }
        }
      }
      service = {
        pipelines = {
          traces = { receivers = ["otlp"], exporters = ["awsxray", "otlp"] }
        }
      }
    }
  })]
}

# ─── Argo CD ──────────────────────────────────────────────────────────────────

resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = "6.10.2"
  namespace        = "argocd"
  create_namespace = true

  values = [yamlencode({
    server = {
      ingress = {
        enabled          = true
        ingressClassName = "alb"
        annotations = {
          "alb.ingress.kubernetes.io/scheme"           = "internet-facing"
          "alb.ingress.kubernetes.io/target-type"      = "ip"
          "alb.ingress.kubernetes.io/certificate-arn"  = var.argocd_ingress_certificate_arn
          "alb.ingress.kubernetes.io/listen-ports"     = "[{\"HTTPS\":443}]"
          "alb.ingress.kubernetes.io/ssl-redirect"     = "443"
        }
        hosts = ["argocd.${var.domain_name}"]
        tls   = [{ hosts = ["argocd.${var.domain_name}"], secretName = "argocd-tls" }]
      }
      extraArgs = ["--insecure"]  # TLS terminated at ALB
    }
    configs = {
      params = { "server.insecure" = "true" }
    }
    repoServer = { replicas = 2 }
    applicationSet = { replicaCount = 2 }
  })]

  depends_on = [helm_release.aws_lbc]
}

# Argo CD ApplicationSet — auto-deploy all services from GitOps repo
resource "kubernetes_manifest" "argocd_appset" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "ApplicationSet"
    metadata   = { name = "aerolink-services", namespace = "argocd" }
    spec = {
      generators = [{
        list = {
          elements = [
            { service = "identity-service",      namespace = "aerolink" },
            { service = "flight-service",         namespace = "aerolink" },
            { service = "booking-service",        namespace = "aerolink" },
            { service = "payment-service",        namespace = "aerolink" },
            { service = "checkin-service",        namespace = "aerolink" },
            { service = "baggage-service",        namespace = "aerolink" },
            { service = "notification-service",   namespace = "aerolink" },
            { service = "webui",                  namespace = "aerolink" },
          ]
        }
      }]
      template = {
        metadata = { name = "{{service}}" }
        spec = {
          project = "default"
          source = {
            repoURL        = "https://github.com/your-org/aero-link"
            targetRevision = "HEAD"
            path           = "services/{{service}}/helm"
          }
          destination = {
            server    = "https://kubernetes.default.svc"
            namespace = "{{namespace}}"
          }
          syncPolicy = {
            automated = { prune = true, selfHeal = true }
            syncOptions = ["CreateNamespace=true"]
          }
        }
      }
    }
  }
  depends_on = [helm_release.argocd]
}

# ─── ALB DNS name (output for API Gateway VPC Link) ──────────────────────────

data "kubernetes_ingress_v1" "argocd" {
  metadata {
    name      = "argocd-server"
    namespace = "argocd"
  }
  depends_on = [helm_release.argocd]
}
