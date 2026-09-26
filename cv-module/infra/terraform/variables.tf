variable "project_id" {
  description = "Google Cloud project containing the evaluation environment."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Cloud Tasks, Storage, and optional Firestore creation."
  type        = string
  default     = "us-central1"
}

variable "auth_mode" {
  description = "API authentication mode. Use disabled only for non-production evaluation."
  type        = string
  default     = "disabled"

  validation {
    condition     = contains(["disabled", "firebase"], var.auth_mode)
    error_message = "auth_mode must be disabled or firebase."
  }
}

variable "gemini_location" {
  description = "Gemini multi-region used for inference."
  type        = string
  default     = "us"
}

variable "gemini_model" {
  description = "Configurable Gemini model ID persisted with each assessment."
  type        = string
  default     = "gemini-3.8-flash"
}

variable "gemini_input_cost_per_million_usd" {
  description = "Optional current input-token price used only for per-claim cost reporting."
  type        = string
  default     = ""
}

variable "gemini_output_cost_per_million_usd" {
  description = "Optional current output-token price used only for per-claim cost reporting."
  type        = string
  default     = ""
}

variable "container_image" {
  description = "Immutable API/worker image URL, preferably pinned by digest."
  type        = string
}

variable "storage_bucket" {
  description = "Globally unique private image bucket name; defaults to project-id-becarful-cv."
  type        = string
  default     = ""
}

variable "create_firestore_database" {
  description = "Create the project's default Firestore Native database. Disable if it already exists."
  type        = bool
  default     = true
}

variable "git_revision" {
  description = "Source revision embedded in assessment metadata."
  type        = string
  default     = "unknown"
}

variable "api_min_instances" {
  type    = number
  default = 0
}

variable "worker_max_instances" {
  type    = number
  default = 5
}
