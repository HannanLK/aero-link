variable "prefix" { type = string }
variable "scope"  {
  type    = string
  default = "REGIONAL"
  validation {
    condition     = contains(["REGIONAL", "CLOUDFRONT"], var.scope)
    error_message = "scope must be REGIONAL or CLOUDFRONT"
  }
}
