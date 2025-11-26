# Helm Controller Integration

This document covers the k3s Helm Controller, which provides declarative Helm chart management through Kubernetes CRDs. While Fleet uses Helm internally for deployments, the Helm Controller can be used independently or alongside Fleet for simpler scenarios.

## Overview

The Helm Controller watches `HelmChart` and `HelmChartConfig` Custom Resources and creates Kubernetes Jobs to execute Helm operations. This provides a declarative, GitOps-friendly way to manage Helm releases.

**Key Benefits:**
- Declarative chart management (no imperative `helm install` commands)
- Native Kubernetes resource (can be managed via GitOps)
- Built into K3s/RKE2 (also available standalone)
- Automatic retries and failure handling

## When to Use Helm Controller vs Fleet

| Use Case | Recommended Tool |
|----------|-----------------|
| Single chart, simple config | Helm Controller |
| Multiple charts from Git repo | Fleet |
| Multi-cluster deployments | Fleet |
| OCI registry charts | Fleet (better support) |
| K3s/RKE2 built-in charts | Helm Controller |
| Enterprise standard configs | Fleet |

For the Fleet extension, Fleet is preferred, but understanding the Helm Controller helps with debugging and alternative use cases.

## HelmChart Custom Resource

### Basic Structure

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: my-app
  namespace: kube-system  # HelmChart resources typically go here
spec:
  # Chart source (one of these)
  chart: nginx                              # Chart name from repo
  repo: https://charts.bitnami.com/bitnami  # Helm repository URL
  version: "15.0.0"                         # Chart version

  # Or direct URL
  # chart: https://example.com/charts/myapp-1.0.0.tgz

  # Or base64-encoded chart content
  # chartContent: H4sIAAAAAAAC/+y8W...

  # Deployment target
  targetNamespace: my-app-namespace
  createNamespace: true

  # Values configuration
  valuesContent: |
    replicaCount: 2
    service:
      type: ClusterIP

  # Simple value overrides (highest precedence)
  set:
    image.tag: "v1.2.3"
```

### Full Specification Reference

| Field | Default | Description |
|-------|---------|-------------|
| `spec.chart` | - | Chart name in repo, or full HTTPS URL to .tgz |
| `spec.chartContent` | - | Base64-encoded chart .tgz (overrides chart) |
| `spec.repo` | - | Helm repository URL |
| `spec.version` | latest | Chart version |
| `spec.targetNamespace` | default | Namespace for deployed resources |
| `spec.createNamespace` | false | Create namespace if missing |
| `spec.valuesContent` | - | YAML values (inline) |
| `spec.valuesSecrets` | - | Values from Secrets |
| `spec.set` | - | Simple key-value overrides |
| `spec.timeout` | 300s | Operation timeout |
| `spec.backOffLimit` | 1000 | Retry attempts |
| `spec.failurePolicy` | reinstall | `reinstall` or `abort` |
| `spec.authSecret` | - | Basic auth for private repos |
| `spec.repoCA` | - | CA certificate for TLS |
| `spec.insecureSkipTLSVerify` | false | Skip TLS verification |
| `spec.bootstrap` | false | Required for cluster bootstrap |
| `spec.jobImage` | - | Custom klipper-helm image |

## Values Precedence

Values are merged in this order (later overrides earlier):

1. Chart default values
2. `HelmChart.spec.valuesContent`
3. `HelmChart.spec.valuesSecrets` (in order)
4. `HelmChartConfig.spec.valuesContent`
5. `HelmChartConfig.spec.valuesSecrets` (in order)
6. `HelmChart.spec.set` (highest precedence)

## HelmChartConfig for Overrides

`HelmChartConfig` allows overriding values for existing `HelmChart` resources without modifying them. Useful for customizing packaged charts.

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: my-app          # Must match HelmChart name
  namespace: kube-system # Must match HelmChart namespace
spec:
  valuesContent: |
    logging:
      level: debug
  failurePolicy: abort   # Optional override
```

## Chart Source Examples

### From Repository

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: prometheus
  namespace: kube-system
spec:
  repo: https://prometheus-community.github.io/helm-charts
  chart: prometheus
  version: "25.0.0"
  targetNamespace: monitoring
  createNamespace: true
```

### From URL

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: custom-app
  namespace: kube-system
spec:
  chart: https://charts.example.com/custom-app-1.0.0.tgz
  targetNamespace: production
```

### With Authentication

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: private-chart
  namespace: kube-system
spec:
  repo: https://private-repo.example.com
  chart: my-private-app
  version: "2.0.0"
  targetNamespace: apps
  authSecret:
    name: repo-credentials
  repoCAConfigMap:
    name: repo-ca-cert
---
apiVersion: v1
kind: Secret
metadata:
  name: repo-credentials
  namespace: kube-system
type: kubernetes.io/basic-auth
stringData:
  username: myuser
  password: mypassword
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: repo-ca-cert
  namespace: kube-system
data:
  ca.crt: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
```

## Values from Secrets

For sensitive configuration (credentials, API keys):

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: app-with-secrets
  namespace: kube-system
spec:
  repo: https://charts.example.com
  chart: my-app
  targetNamespace: production

  # Public values inline
  valuesContent: |
    replicaCount: 3
    service:
      type: ClusterIP

  # Sensitive values from Secret
  valuesSecrets:
    - name: app-secrets
      keys:
        - database.yaml
        - api-keys.yaml
      ignoreUpdates: false  # Redeploy on secret change
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: kube-system
type: Opaque
stringData:
  database.yaml: |
    database:
      host: db.example.com
      username: appuser
      password: secretpassword
  api-keys.yaml: |
    externalApi:
      key: abc123def456
```

## Status and Monitoring

### Checking Status

```bash
# List all HelmCharts
kubectl get helmcharts -A

# Get details
kubectl describe helmchart my-app -n kube-system

# Check the Helm release
helm list -n my-app-namespace
```

### Status Fields

```yaml
status:
  jobName: helm-install-my-app-abc123
  conditions:
    - type: JobCreated
      status: "True"
      message: "Job helm-install-my-app-abc123 created"
```

### Debugging Failed Installations

```bash
# Check job status
kubectl get jobs -n kube-system -l helmcharts.helm.cattle.io/chart=my-app

# View job logs
kubectl logs -n kube-system job/helm-install-my-app-abc123

# Check events
kubectl get events -n kube-system --field-selector involvedObject.name=my-app
```

## Failure Policies

### reinstall (default)

On failure, the controller will:
1. Uninstall the failed release
2. Retry installation
3. Repeat until `backOffLimit` is reached

### abort

On failure:
1. Stop attempting installation
2. Set `Failed` condition
3. Require manual intervention

```yaml
spec:
  failurePolicy: abort
  backOffLimit: 3
```

## Integration with Fleet Extension

While the Fleet extension primarily uses Fleet for GitOps deployments, the Helm Controller can be useful for:

1. **Bootstrap Charts**: Installing prerequisite tools before Fleet
2. **Simple Standalone Charts**: When GitOps isn't needed
3. **Debugging**: Understanding how Fleet deploys Helm releases

### Using from Extension Code

```typescript
// Create a HelmChart resource
const helmChartYaml = `
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: ${chartName}
  namespace: kube-system
spec:
  repo: ${repoUrl}
  chart: ${chartName}
  version: ${version}
  targetNamespace: ${targetNs}
  createNamespace: true
  valuesContent: |
${valuesYaml.split('\n').map(l => '    ' + l).join('\n')}
`;

await ddClient.extension.host?.cli.exec("kubectl", [
  "apply", "-f", "-"
], {
  stdin: helmChartYaml
});

// Check status
const result = await ddClient.extension.host?.cli.exec("kubectl", [
  "get", "helmchart", chartName,
  "-n", "kube-system",
  "-o", "jsonpath={.status.conditions[*].type}"
]);
```

### Deleting a HelmChart

Deleting the `HelmChart` resource automatically uninstalls the Helm release:

```bash
kubectl delete helmchart my-app -n kube-system
```

## Comparison: Fleet vs Helm Controller

| Feature | Fleet | Helm Controller |
|---------|-------|-----------------|
| Git integration | Built-in | Manual (GitOps tool needed) |
| Multi-cluster | Native | Single cluster |
| Kustomize support | Yes | No |
| Raw YAML support | Yes | No |
| OCI registry | Yes | Limited |
| Dependencies | Fleet controller | Standalone or K3s built-in |
| Use case | Enterprise GitOps | Simple declarative Helm |

## K3s/RKE2 Integration

In K3s and RKE2, the Helm Controller is built-in. Charts placed in `/var/lib/rancher/k3s/server/manifests/` are automatically deployed:

```bash
# Create a HelmChart manifest
cat > /var/lib/rancher/k3s/server/manifests/my-app.yaml << 'EOF'
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: my-app
  namespace: kube-system
spec:
  chart: nginx
  repo: https://charts.bitnami.com/bitnami
  targetNamespace: default
EOF

# K3s automatically applies it
```

## Best Practices

1. **Namespace**: Place HelmChart resources in `kube-system` namespace
2. **Secrets**: Use `valuesSecrets` for sensitive data, not `spec.set`
3. **Versioning**: Always specify `spec.version` for reproducibility
4. **Failure Policy**: Use `abort` in production to prevent reinstall loops
5. **Timeouts**: Set appropriate `spec.timeout` for large charts
6. **Bootstrap**: Use `spec.bootstrap: true` for critical infrastructure charts

## Sources

- Helm Controller Wiki: `docs/background/wiki/k3s-io/helm-controller/`
- K3s Helm Documentation: `docs/background/k3s-helm-controller.md`
- Helm Controller Overview: `docs/background/wiki/k3s-io/helm-controller/1-overview.md`
