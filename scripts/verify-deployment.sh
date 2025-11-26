#!/bin/bash
# Verify Fleet deployments are working
# Usage: ./scripts/verify-deployment.sh [gitrepo-name]

CONTEXT="rancher-desktop"
NAMESPACE="fleet-local"

echo "=== Fleet GitRepo Status ==="
kubectl --context $CONTEXT get gitrepos -n $NAMESPACE

echo ""
echo "=== GitRepo Details ==="
if [ -n "$1" ]; then
  kubectl --context $CONTEXT get gitrepo "$1" -n $NAMESPACE -o jsonpath='
Name: {.metadata.name}
Repo: {.spec.repo}
Paths: {.spec.paths[*]}
State: {.status.display.state}
Ready: {.status.conditions[?(@.type=="Ready")].status}
Message: {.status.display.message}
Resources: {range .status.resources[*]}
  - {.kind}/{.name} ({.state}){end}
'
  echo ""
else
  for repo in $(kubectl --context $CONTEXT get gitrepos -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}'); do
    echo "--- $repo ---"
    kubectl --context $CONTEXT get gitrepo "$repo" -n $NAMESPACE -o jsonpath='
Repo: {.spec.repo}
Paths: {.spec.paths[*]}
State: {.status.display.state}
Ready: {.status.conditions[?(@.type=="Ready")].status}
Resources: {range .status.resources[*]}
  - {.kind}/{.name} ({.state}){end}
'
    echo ""
  done
fi

echo ""
echo "=== Bundles (Fleet internal) ==="
kubectl --context $CONTEXT get bundles -n $NAMESPACE

echo ""
echo "=== Deployed Workloads ==="
echo "Deployments:"
kubectl --context $CONTEXT get deployments -A --field-selector metadata.namespace!=kube-system,metadata.namespace!=cattle-fleet-system 2>/dev/null | grep -v "^NAMESPACE" || echo "  (none)"
echo ""
echo "ConfigMaps (non-system):"
kubectl --context $CONTEXT get configmaps -A --field-selector metadata.namespace!=kube-system,metadata.namespace!=cattle-fleet-system 2>/dev/null | grep -v "^NAMESPACE" | grep -v "kube-root-ca" || echo "  (none)"
