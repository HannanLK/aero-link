output "cmk_pci_arn"   { value = aws_kms_key.cmk_pci.arn }
output "cmk_pci_id"    { value = aws_kms_key.cmk_pci.key_id }
output "cmk_pii_arn"   { value = aws_kms_key.cmk_pii.arn }
output "cmk_pii_id"    { value = aws_kms_key.cmk_pii.key_id }
output "cmk_infra_arn" { value = aws_kms_key.cmk_infra.arn }
output "cmk_infra_id"  { value = aws_kms_key.cmk_infra.key_id }
