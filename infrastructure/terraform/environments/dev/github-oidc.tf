# ─────────────────────────────────────────────────────────────────────────────
# GitHub Actions OIDC — lets the Service CI assume an AWS role to push to ECR
# WITHOUT long-lived access keys. After `terraform apply`, take the
# `github_actions_role_arn` output and set it as the GitHub repo secret
# AWS_DEPLOY_ROLE_ARN (Settings → Secrets and variables → Actions).
#
# This is what was missing: the pipeline referenced `secrets.AWS_DEPLOY_ROLE_ARN`
# but no such role existed, so configure-aws-credentials had nothing to assume
# ("Could not load credentials from any providers").
# ─────────────────────────────────────────────────────────────────────────────

variable "github_repository" {
  description = "GitHub repo (owner/name) allowed to assume the CI role. CASE-SENSITIVE — must match github.com/<owner>/<repo> exactly."
  type        = string
  default     = "HannanLK/aero-link"
}

variable "create_github_oidc_provider" {
  description = "Keep TRUE — Terraform owns this provider. Setting it false makes Terraform DESTROY the provider (causes 'No OpenIDConnect provider found')."
  type        = bool
  default     = true
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_github_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

locals {
  github_oidc_provider_arn = var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Restrict to this repo (any branch/tag). Tighten to a branch with
    # "repo:${var.github_repository}:ref:refs/heads/main" if desired.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.project}-${var.environment}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json
}

data "aws_iam_policy_document" "github_actions_ecr" {
  statement {
    sid       = "EcrAuthToken"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid    = "EcrPushPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = ["arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/aerolink-dev/*"]
  }
}

resource "aws_iam_role_policy" "github_actions_ecr" {
  name   = "ecr-push"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_ecr.json
}

output "github_actions_role_arn" {
  description = "Set this as the GitHub repo secret AWS_DEPLOY_ROLE_ARN"
  value       = aws_iam_role.github_actions.arn
}
