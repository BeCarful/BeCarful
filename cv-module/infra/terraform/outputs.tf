output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "worker_url" {
  value     = google_cloud_run_v2_service.worker.uri
  sensitive = true
}

output "storage_bucket" {
  value = google_storage_bucket.images.name
}

output "artifact_repository" {
  value = google_artifact_registry_repository.containers.name
}

