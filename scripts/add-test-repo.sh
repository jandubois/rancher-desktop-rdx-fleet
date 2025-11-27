#!/bin/bash
# Quickly add a test GitRepo from fleet-examples
# Usage: ./scripts/add-test-repo.sh <path> [name]
# Example: ./scripts/add-test-repo.sh simple
#          ./scripts/add-test-repo.sh helm/local-chart helm-test

CONTEXT="rancher-desktop"
NAMESPACE="fleet-local"
REPO_URL="https://github.com/rancher/fleet-examples"

if [ -z "$1" ]; then
  echo "Usage: $0 <path> [name]"
  echo "Example: $0 simple"
  echo "         $0 helm/local-chart helm-test"
  echo ""
  echo "Common paths: simple, multi-cluster/helm, helm/local-chart"
  exit 1
fi

PATH_NAME="$1"
# Generate name from path if not provided (replace / with -)
REPO_NAME="${2:-$(echo $PATH_NAME | tr '/' '-')}"

echo "Adding GitRepo: $REPO_NAME (path: $PATH_NAME)"

cat <<EOF | kubectl --context $CONTEXT apply -f -
apiVersion: fleet.cattle.io/v1alpha1
kind: GitRepo
metadata:
  name: $REPO_NAME
  namespace: $NAMESPACE
spec:
  repo: $REPO_URL
  paths:
    - $PATH_NAME
EOF

echo ""
echo "Waiting for sync..."
sleep 2

# Show status
kubectl --context $CONTEXT get gitrepo $REPO_NAME -n $NAMESPACE -o jsonpath='
Status: {.status.display.state}
Message: {.status.display.message}
'
echo ""
echo ""
echo "Run './scripts/verify-deployment.sh $REPO_NAME' to see full details"
