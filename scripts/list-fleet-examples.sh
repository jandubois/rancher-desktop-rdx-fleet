#!/bin/bash
# List available examples from rancher/fleet-examples
# These can be used as paths when adding GitRepos

cat << 'EOF'
=== Available paths in rancher/fleet-examples ===

Simple (best for testing):
  simple                        - Single ConfigMap

Single-Cluster Examples:
  single-cluster/manifests      - Raw YAML manifests
  single-cluster/helm           - Helm chart
  single-cluster/helm-multi-chart - Multiple Helm charts
  single-cluster/kustomize      - Kustomize
  single-cluster/helm-kustomize - Helm + Kustomize

Multi-Cluster Examples:
  multi-cluster/manifests       - Raw YAML manifests
  multi-cluster/helm            - Helm chart
  multi-cluster/helm-external   - External Helm repo
  multi-cluster/kustomize       - Kustomize
  multi-cluster/helm-kustomize  - Helm + Kustomize

Other:
  appco                         - App co-deployment
  hardened                      - Hardened example

Usage in the extension:
  Repository URL: https://github.com/rancher/fleet-examples
  Paths: simple (or comma-separated for multiple)

Quick add via script:
  ./scripts/add-test-repo.sh simple
  ./scripts/add-test-repo.sh single-cluster/helm
EOF
