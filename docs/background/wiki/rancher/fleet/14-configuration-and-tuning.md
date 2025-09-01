# Configuration and Tuning

[Get free private DeepWikis in Devin](/private-repo)

[DeepWiki](https://deepwiki.com)

[DeepWiki](/)

[rancher/fleet](https://github.com/rancher/fleet)

[Get free private DeepWikis with

Devin](/private-repo)Share

Last indexed: 3 June 2025 ([01abaa](https://github.com/rancher/fleet/commits/01abaa07))

* [Overview](/rancher/fleet/1-overview)
* [Architecture](/rancher/fleet/2-architecture)
* [Core APIs and Custom Resources](/rancher/fleet/2.1-core-apis-and-custom-resources)
* [Controllers and Reconcilers](/rancher/fleet/2.2-controllers-and-reconcilers)
* [Agent System](/rancher/fleet/2.3-agent-system)
* [Core Components](/rancher/fleet/3-core-components)
* [GitOps System](/rancher/fleet/3.1-gitops-system)
* [Bundle Management](/rancher/fleet/3.2-bundle-management)
* [Cluster Management](/rancher/fleet/3.3-cluster-management)
* [CLI Tools](/rancher/fleet/3.4-cli-tools)
* [Deployment and Installation](/rancher/fleet/4-deployment-and-installation)
* [Helm Charts](/rancher/fleet/4.1-helm-charts)
* [Container Images](/rancher/fleet/4.2-container-images)
* [Configuration and Tuning](/rancher/fleet/4.3-configuration-and-tuning)
* [Development](/rancher/fleet/5-development)
* [Development Environment](/rancher/fleet/5.1-development-environment)
* [Testing](/rancher/fleet/5.2-testing)
* [CI/CD and Release Process](/rancher/fleet/5.3-cicd-and-release-process)
* [Operations and Troubleshooting](/rancher/fleet/6-operations-and-troubleshooting)
* [Troubleshooting and Support](/rancher/fleet/6.1-troubleshooting-and-support)
* [Git Webhooks and Integrations](/rancher/fleet/6.2-git-webhooks-and-integrations)

Menu

# Configuration and Tuning

Relevant source files

* [.github/scripts/release-against-test-charts.sh](https://github.com/rancher/fleet/blob/01abaa07/.github/scripts/release-against-test-charts.sh)
* [charts/fleet-agent/templates/deployment.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet-agent/templates/deployment.yaml)
* [charts/fleet-agent/templates/network\_policy\_allow\_all.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet-agent/templates/network_policy_allow_all.yaml)
* [charts/fleet-agent/values.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet-agent/values.yaml)
* [charts/fleet/templates/deployment.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment.yaml)
* [charts/fleet/templates/deployment\_gitjob.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment_gitjob.yaml)
* [charts/fleet/templates/deployment\_helmops.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment_helmops.yaml)
* [charts/fleet/tests/agent-leader-election.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/tests/agent-leader-election.yaml)
* [charts/fleet/tests/extraAnnotations\_test.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/tests/extraAnnotations_test.yaml)
* [charts/fleet/tests/extraLabels\_test.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/tests/extraLabels_test.yaml)
* [charts/fleet/values.yaml](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml)
* [internal/cmd/controller/agentmanagement/agent/agent.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/agent/agent.go)
* [internal/cmd/controller/agentmanagement/agent/manifest.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/agent/manifest.go)
* [internal/cmd/controller/agentmanagement/agent/manifest\_test.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/agent/manifest_test.go)
* [internal/cmd/controller/agentmanagement/controllers/cluster/controller.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/controllers/cluster/controller.go)
* [internal/cmd/controller/agentmanagement/controllers/cluster/import.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/controllers/cluster/import.go)
* [internal/cmd/controller/agentmanagement/controllers/clusterregistration/controller.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/controllers/clusterregistration/controller.go)
* [internal/cmd/controller/agentmanagement/controllers/clusterregistration/controller\_test.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/controllers/clusterregistration/controller_test.go)
* [internal/cmd/controller/agentmanagement/controllers/clusterregistrationtoken/handler.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/controllers/clusterregistrationtoken/handler.go)
* [internal/cmd/controller/agentmanagement/controllers/manageagent/manageagent.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/controllers/manageagent/manageagent.go)
* [internal/cmd/controller/agentmanagement/controllers/manageagent/manageagent\_test.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/controllers/manageagent/manageagent_test.go)
* [internal/cmd/options.go](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/options.go)
* [pkg/apis/fleet.cattle.io/v1alpha1/cluster\_types.go](https://github.com/rancher/fleet/blob/01abaa07/pkg/apis/fleet.cattle.io/v1alpha1/cluster_types.go)
* [pkg/durations/durations.go](https://github.com/rancher/fleet/blob/01abaa07/pkg/durations/durations.go)

This document covers Fleet's configuration options, performance tuning parameters, and operational settings for production deployments. It focuses on the Helm chart values, environment variables, and runtime parameters that control Fleet's behavior and performance characteristics.

For installation procedures, see [Helm Charts](/rancher/fleet/4.1-helm-charts). For container image configuration, see [Container Images](/rancher/fleet/4.2-container-images).

## Controller Configuration

Fleet's controller components can be configured through Helm chart values and environment variables. The main configuration is handled through the `fleet` Helm chart values.

### Core Controller Settings

The Fleet controller supports several key configuration areas:

```
controller:
  replicas: 1
  reconciler:
    workers:
      gitrepo: "50"
      bundle: "50" 
      bundledeployment: "50"
      cluster: "50"
      clustergroup: "50"
      imagescan: "50"
```

**Worker Configuration**: Each reconciler type can have its worker count configured independently. The default is 50 workers per reconciler type, which provides good parallelism for most deployments.

**Replica Configuration**: The controller runs as a single replica by default but supports leader election for high availability scenarios.

Sources: [charts/fleet/values.yaml107-118](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L107-L118) [charts/fleet/templates/deployment.yaml72-91](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment.yaml#L72-L91)

### GitOps System Configuration

```
gitops:
  enabled: true
  syncPeriod: 2h

gitjob:
  replicas: 1
```

The GitOps system handles Git repository monitoring and synchronization. The `syncPeriod` controls how often the system checks for lost GitRepo events and should be larger than the largest GitRepo polling interval.

Sources: [charts/fleet/values.yaml82-87](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L82-L87) [charts/fleet/values.yaml119-121](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L119-L121)

### Leader Election Configuration

```
leaderElection:
  leaseDuration: 30s
  retryPeriod: 10s
  renewDeadline: 25s
```

These settings control the leader election behavior for controller components. The values are passed as environment variables to the containers:

* `CATTLE_ELECTION_LEASE_DURATION`: Duration non-leader candidates wait to force acquire leadership
* `CATTLE_ELECTION_RETRY_PERIOD`: Duration between leadership acquisition attempts
* `CATTLE_ELECTION_RENEW_DEADLINE`: Duration the acting leader retries refreshing leadership before giving up

Sources: [charts/fleet/values.yaml101-105](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L101-L105) [charts/fleet/templates/deployment.yaml56-67](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment.yaml#L56-L67) [internal/cmd/options.go12-25](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/options.go#L12-L25)

## Agent Configuration

Fleet agents are configured through both the `fleet` chart (for managed agents) and the `fleet-agent` chart (for standalone agents).

### Agent Deployment Settings

```
agent:
  replicas: 1
  reconciler:
    workers:
      bundledeployment: "50"
      drift: "50"
  leaderElection:
    leaseDuration: 30s
    retryPeriod: 10s
    renewDeadline: 25s
```

**Worker Configuration**: Agents handle `bundledeployment` and `drift` reconcilers, each configurable independently.

**Leader Election**: Agents support their own leader election configuration, separate from the controller settings.

Sources: [charts/fleet-agent/values.yaml74-87](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet-agent/values.yaml#L74-L87) [charts/fleet/values.yaml125-138](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L125-L138) [charts/fleet-agent/templates/deployment.yaml21-40](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet-agent/templates/deployment.yaml#L21-L40)

### Agent Connectivity Configuration

```
agentTLSMode: "system-store"
agentCheckinInterval: "15m"
garbageCollectionInterval: "15m"
```

**TLS Mode**: Controls how agents validate TLS certificates:

* `system-store`: Trust CA bundles from the operating system's trust store
* `strict`: Only connect to servers using the exact configured CA

**Check-in Interval**: How often agents report status to the management cluster.

**Garbage Collection**: How often agents clean up old Helm releases.

Sources: [charts/fleet/values.yaml21-28](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L21-L28) [charts/fleet-agent/values.yaml15-20](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet-agent/values.yaml#L15-L20) [internal/cmd/controller/agentmanagement/controllers/cluster/import.go501-505](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/controllers/cluster/import.go#L501-L505)

## Performance Tuning

### Reconciler Worker Configuration

Fleet provides fine-grained control over reconciler worker counts through environment variables:

![Mermaid Diagram](images/14__diagram_0.svg)

**Controller Workers**: Each controller reconciler can be tuned independently based on workload characteristics:

* `gitrepo`: For Git repository processing
* `bundle`: For bundle creation and management
* `bundledeployment`: For deployment coordination
* `cluster`: For cluster lifecycle management

**Agent Workers**: Agents focus on deployment execution:

* `bundledeployment`: For applying resources via Helm
* `drift`: For detecting configuration drift

Sources: [charts/fleet/templates/deployment.yaml72-91](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment.yaml#L72-L91) [charts/fleet-agent/templates/deployment.yaml21-28](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet-agent/templates/deployment.yaml#L21-L28) [internal/cmd/controller/agentmanagement/agent/manifest.go176-182](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/agent/manifest.go#L176-L182)

### Sharding Configuration

Fleet supports horizontal scaling through sharding:

```
shards:
  - id: shard0
    nodeSelector:
      kubernetes.io/hostname: k3d-upstream-server-0
  - id: shard1  
    nodeSelector:
      kubernetes.io/hostname: k3d-upstream-server-1
```

Sharding allows distributing workload across multiple controller instances, each handling a subset of resources.

Sources: [charts/fleet/values.yaml147-156](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L147-L156) [charts/fleet/templates/deployment.yaml1-11](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment.yaml#L1-L11)

## Timing Parameters

Fleet includes numerous timing configurations that affect system behavior and performance:

### Core Timing Constants

![Mermaid Diagram](images/14__diagram_1.svg)

### Configurable Timing Parameters

Several timing parameters can be configured through Helm values:

* `clusterEnqueueDelay`: Delay before retrying cluster operations (default: 15s)
* `gitClientTimeout`: Timeout for Git operations (default: 30s)
* `agentCheckinInterval`: Agent heartbeat interval (default: 15m)
* `garbageCollectionInterval`: Cleanup interval (default: 15m)

Sources: [pkg/durations/durations.go9-40](https://github.com/rancher/fleet/blob/01abaa07/pkg/durations/durations.go#L9-L40) [charts/fleet/values.yaml35-47](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L35-L47)

## Resource Management

### Resource Limits and Requests

Fleet supports configuring resource requirements for agent deployments:

```
agentResources:
  limits:
    cpu: 100m
    memory: 100Mi
  requests:
    cpu: 50m
    memory: 50Mi
```

**Resource Configuration**: Applied to agent containers to ensure proper resource allocation and prevent resource contention.

**Affinity and Tolerations**: Agents support custom affinity rules and tolerations for advanced scheduling:

```
agentAffinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 1
      preference:
        matchExpressions:
        - key: "fleet.cattle.io/agent"
          operator: In
          values: ["true"]

agentTolerations:
- key: "cattle.io/os"
  operator: "Equal"
  value: "linux"
  effect: "NoSchedule"
```

Sources: [pkg/apis/fleet.cattle.io/v1alpha1/cluster\_types.go123-136](https://github.com/rancher/fleet/blob/01abaa07/pkg/apis/fleet.cattle.io/v1alpha1/cluster_types.go#L123-L136) [internal/cmd/controller/agentmanagement/agent/manifest.go272-281](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/agent/manifest.go#L272-L281)

### Replica Management

```
controller:
  replicas: 1
agent:
  replicas: 1
gitjob:
  replicas: 1
```

**Agent Replica Count**: Can be overridden via environment variable `FLEET_AGENT_REPLICA_COUNT` for dynamic scaling scenarios.

Sources: [internal/cmd/options.go69-78](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/options.go#L69-L78) [charts/fleet/values.yaml108](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L108-L108)

## Security Configuration

### Security Context Settings

```
disableSecurityContext: false
```

When enabled, Fleet applies security contexts to all containers:

* `allowPrivilegeEscalation: false`
* `readOnlyRootFilesystem: true`
* `privileged: false`
* `runAsNonRoot: true`
* `runAsUser: 1000`
* `runAsGroup: 1000`

**Host Network**: Agents can be configured with `hostNetwork: true` for special networking scenarios like CNI provisioning.

Sources: [charts/fleet/values.yaml94](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L94-L94) [charts/fleet/templates/deployment.yaml117-125](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment.yaml#L117-L125) [internal/cmd/controller/agentmanagement/agent/manifest.go264-271](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/controller/agentmanagement/agent/manifest.go#L264-L271)

### TLS Configuration

```
agentTLSMode: "system-store"
insecureSkipHostKeyChecks: false
```

**TLS Modes**:

* `system-store`: Use OS certificate store
* `strict`: Use only configured certificates

**SSH Security**: Controls whether SSH operations skip host key verification.

Sources: [charts/fleet/values.yaml21](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L21-L21) [charts/fleet/values.yaml80](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L80-L80)

## Network Configuration

### Proxy Configuration

```
proxy: "http://username:password@proxy.example.com:8080"
noProxy: "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,.svc,.cluster.local"
```

Fleet supports HTTP/HTTPS proxy configuration with bypass rules for internal networks.

### API Server Configuration

```
apiServerURL: "https://kubernetes.example.com:6443"
apiServerCA: |
  -----BEGIN CERTIFICATE-----
  ...
  -----END CERTIFICATE-----
```

**Connectivity**: Essential for agent-to-controller communication. Can be configured globally or per-cluster via secrets.

Sources: [charts/fleet/values.yaml11-17](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L11-L17) [charts/fleet/values.yaml38-42](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L38-L42) [charts/fleet/templates/deployment.yaml48-55](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment.yaml#L48-L55)

## Debugging and Observability

### Debug Configuration

```
debug: false
debugLevel: 0
propagateDebugSettingsToAgents: true
```

**Debug Settings**: Enable verbose logging and propagate debug configuration to managed agents automatically.

### Metrics Configuration

```
metrics:
  enabled: true
```

**Metrics Endpoints**: Controllers expose metrics on port 8080, GitJob on 8081 when enabled.

Sources: [charts/fleet/values.yaml91-93](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L91-L93) [charts/fleet/values.yaml88-89](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L88-L89) [charts/fleet/templates/deployment.yaml98-102](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment.yaml#L98-L102)

### Environment Variable Configuration

Fleet supports extensive configuration through environment variables:

![Mermaid Diagram](images/14__diagram_2.svg)

**Configuration Priority**: Environment variables override Helm chart values, providing runtime flexibility for operational adjustments.

Sources: [charts/fleet/templates/deployment.yaml39-94](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/templates/deployment.yaml#L39-L94) [internal/cmd/options.go41-66](https://github.com/rancher/fleet/blob/01abaa07/internal/cmd/options.go#L41-L66) [charts/fleet/values.yaml140-146](https://github.com/rancher/fleet/blob/01abaa07/charts/fleet/values.yaml#L140-L146)

Dismiss

Refresh this wiki

Enter email to refresh

### On this page

* [Configuration and Tuning](#configuration-and-tuning)
* [Controller Configuration](#controller-configuration)
* [Core Controller Settings](#core-controller-settings)
* [GitOps System Configuration](#gitops-system-configuration)
* [Leader Election Configuration](#leader-election-configuration)
* [Agent Configuration](#agent-configuration)
* [Agent Deployment Settings](#agent-deployment-settings)
* [Agent Connectivity Configuration](#agent-connectivity-configuration)
* [Performance Tuning](#performance-tuning)
* [Reconciler Worker Configuration](#reconciler-worker-configuration)
* [Sharding Configuration](#sharding-configuration)
* [Timing Parameters](#timing-parameters)
* [Core Timing Constants](#core-timing-constants)
* [Configurable Timing Parameters](#configurable-timing-parameters)
* [Resource Management](#resource-management)
* [Resource Limits and Requests](#resource-limits-and-requests)
* [Replica Management](#replica-management)
* [Security Configuration](#security-configuration)
* [Security Context Settings](#security-context-settings)
* [TLS Configuration](#tls-configuration)
* [Network Configuration](#network-configuration)
* [Proxy Configuration](#proxy-configuration)
* [API Server Configuration](#api-server-configuration)
* [Debugging and Observability](#debugging-and-observability)
* [Debug Configuration](#debug-configuration)
* [Metrics Configuration](#metrics-configuration)
* [Environment Variable Configuration](#environment-variable-configuration)

Ask Devin about rancher/fleet

Deep Research