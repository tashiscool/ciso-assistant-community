# ---------------------------------------------------------------------------
# Terragrunt v0.19 configuration for CISO Assistant production
# ---------------------------------------------------------------------------
# Usage:
#   cd terraform/environments/production
#   terragrunt plan
#   terragrunt apply
#
# Secrets via environment variables:
#   export TF_VAR_db_master_password="..."
#   export TF_VAR_django_secret_key="..."
# ---------------------------------------------------------------------------

terragrunt = {
  terraform {
    source = "../../modules/ciso-assistant-eb"

    extra_arguments "common_vars" {
      commands = ["plan", "apply", "destroy"]

      arguments = [
        "-var-file=terraform.tfvars",
      ]
    }
  }

  # Remote state in S3 — update bucket/region to match your account
  remote_state {
    backend = "s3"

    config {
      bucket         = "ciso-assistant-terraform-state"
      key            = "production/ciso-assistant-eb/terraform.tfstate"
      region         = "us-east-1"
      encrypt        = true
      dynamodb_table = "ciso-assistant-terraform-locks"
    }
  }
}
