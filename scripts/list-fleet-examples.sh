#!/bin/bash
# List available examples from rancher/fleet-examples
# These can be used as paths when adding GitRepos

cat << 'EOF'
=== Available fleet-examples paths ===

Basic Examples (recommended for testing):
  simple              - Single ConfigMap deployment
  multi-cluster/helm  - Helm chart example

Helm Examples:
  helm/kustomize      - Helm with Kustomize overlays
  helm/local-chart    - Local Helm chart
  helm/default-values - Helm chart with values

Advanced:
  bundle-diffs        - Bundle customization
  single-cluster      - Single cluster targeting

Usage in the extension:
  Repository URL: https://github.com/rancher/fleet-examples
  Paths: simple (or any path above, comma-separated for multiple)

To add via kubectl directly:
  ./scripts/add-test-repo.sh simple
  ./scripts/add-test-repo.sh helm/local-chart
EOF
