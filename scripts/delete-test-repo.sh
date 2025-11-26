#!/bin/bash
# Delete a test GitRepo
# Usage: ./scripts/delete-test-repo.sh <name>
#        ./scripts/delete-test-repo.sh --all

CONTEXT="rancher-desktop"
NAMESPACE="fleet-local"

if [ -z "$1" ]; then
  echo "Usage: $0 <name>"
  echo "       $0 --all  (delete all GitRepos)"
  echo ""
  echo "Current GitRepos:"
  kubectl --context $CONTEXT get gitrepos -n $NAMESPACE -o custom-columns=NAME:.metadata.name,REPO:.spec.repo,STATE:.status.display.state
  exit 1
fi

if [ "$1" == "--all" ]; then
  echo "Deleting all GitRepos..."
  kubectl --context $CONTEXT delete gitrepos --all -n $NAMESPACE
else
  echo "Deleting GitRepo: $1"
  kubectl --context $CONTEXT delete gitrepo "$1" -n $NAMESPACE
fi

echo ""
echo "Remaining GitRepos:"
kubectl --context $CONTEXT get gitrepos -n $NAMESPACE 2>/dev/null || echo "(none)"
