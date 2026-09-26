locals {
  bucket_name = var.storage_bucket != "" ? var.storage_bucket : "${var.project_id}-becarful-cv"
  required_apis = toset(concat(
    [
      "aiplatform.googleapis.com",
      "artifactregistry.googleapis.com",
      "cloudtasks.googleapis.com",
      "firestore.googleapis.com",
      "iamcredentials.googleapis.com",
      "run.googleapis.com",
      "storage.googleapis.com",
    ],
    var.auth_mode == "firebase" ? ["identitytoolkit.googleapis.com"] : []
  ))
}

resource "google_project_service" "required" {
  for_each           = local.required_apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "becarful-cv"
  description   = "BeCarful CV module containers"
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "images" {
  name                        = local.bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = false
  }

  depends_on = [google_project_service.required]
}

resource "google_firestore_database" "default" {
  count       = var.create_firestore_database ? 1 : 0
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "api" {
  account_id   = "becarful-cv-api"
  display_name = "BeCarful CV public API"
}

resource "google_service_account" "worker" {
  account_id   = "becarful-cv-worker"
  display_name = "BeCarful CV assessment worker"
}

resource "google_service_account" "tasks" {
  account_id   = "becarful-cv-tasks"
  display_name = "BeCarful CV Cloud Tasks invoker"
}

resource "google_cloud_tasks_queue" "analysis" {
  name     = "car-damage-analysis"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 5
    max_dispatches_per_second = 2
  }

  retry_config {
    max_attempts       = 3
    max_retry_duration = "3600s"
    min_backoff        = "10s"
    max_backoff        = "300s"
    max_doublings      = 4
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "worker" {
  name                = "becarful-cv-worker"
  location            = var.region
  deletion_protection = true
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.worker.email
    timeout         = "1200s"

    scaling {
      min_instance_count = 0
      max_instance_count = var.worker_max_instances
    }

    containers {
      image   = var.container_image
      command = ["uvicorn"]
      args = [
        "cv_module.worker.app:app",
        "--host", "0.0.0.0",
        "--port", "8080",
      ]

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }

      dynamic "env" {
        for_each = {
          APP_ENV                       = "staging"
          BACKEND_MODE                   = "gcp"
          AUTH_MODE                      = var.auth_mode
          GCP_PROJECT                    = var.project_id
          GCP_REGION                     = var.region
          GEMINI_LOCATION                = var.gemini_location
          GEMINI_MODEL                   = var.gemini_model
          GEMINI_INPUT_COST_PER_MILLION_USD  = var.gemini_input_cost_per_million_usd
          GEMINI_OUTPUT_COST_PER_MILLION_USD = var.gemini_output_cost_per_million_usd
          STORAGE_BUCKET                 = google_storage_bucket.images.name
          TASKS_QUEUE                    = google_cloud_tasks_queue.analysis.name
          WORKER_URL                     = "unused-by-worker"
          TASK_INVOKER_SERVICE_ACCOUNT   = google_service_account.tasks.email
          GIT_REVISION                   = var.git_revision
        }
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "api" {
  name                = "becarful-cv-api"
  location            = var.region
  deletion_protection = true
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.api.email
    timeout         = "60s"

    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = 10
    }

    containers {
      image   = var.container_image
      command = ["uvicorn"]
      args = [
        "cv_module.api.app:app",
        "--host", "0.0.0.0",
        "--port", "8080",
      ]

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      dynamic "env" {
        for_each = {
          APP_ENV                       = "staging"
          BACKEND_MODE                   = "gcp"
          AUTH_MODE                      = var.auth_mode
          GCP_PROJECT                    = var.project_id
          GCP_REGION                     = var.region
          GEMINI_LOCATION                = var.gemini_location
          GEMINI_MODEL                   = var.gemini_model
          GEMINI_INPUT_COST_PER_MILLION_USD  = var.gemini_input_cost_per_million_usd
          GEMINI_OUTPUT_COST_PER_MILLION_USD = var.gemini_output_cost_per_million_usd
          STORAGE_BUCKET                 = google_storage_bucket.images.name
          TASKS_QUEUE                    = google_cloud_tasks_queue.analysis.name
          WORKER_URL                     = google_cloud_run_v2_service.worker.uri
          TASK_INVOKER_SERVICE_ACCOUNT   = google_service_account.tasks.email
          GIT_REVISION                   = var.git_revision
        }
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service_iam_member" "public_api" {
  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "task_invokes_worker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.worker.location
  name     = google_cloud_run_v2_service.worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.tasks.email}"
}

resource "google_storage_bucket_iam_member" "api_objects" {
  bucket = google_storage_bucket.images.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_storage_bucket_iam_member" "worker_objects" {
  bucket = google_storage_bucket.images.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "api_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "worker_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "api_tasks" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "worker_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_service_account_iam_member" "api_signs_upload_urls" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.api.email}"
}

resource "google_service_account_iam_member" "api_acts_as_task_invoker" {
  service_account_id = google_service_account.tasks.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.api.email}"
}
