---
description: Learn how to install and use Valkey
lang: en
robots: index, follow
title: Valkey \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Valkey
twitter:title: Valkey
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Valkey


# Valkey


Learn how to install and use Valkey


![Valkey Logo](images/reference-guides/logo-valkey.png "Valkey Logo")

## Get started

[Valkey](https://apps.rancher.io/applications/valkey) is a high-performance data structure server that primarily serves key/value workloads. It supports a wide range of native structures and an extensible plug-in system for adding new data structures and access patterns. This project was forked from the open source Redis project right before the transition to their new source available licenses.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The Valkey Helm chart distributed in Application Collection is made from scratch, which allowed us to include every best practice and standardization we deemed necessary. When creating it, the objective was to keep the underlying Valkey features intact while simplifying some of its mechanisms when deployed in a Kubernetes environment.

By default, the chart will deploy the `standalone` architecture: A [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) with a single Valkey server enabling password-based authentication. The Valkey data is stored in a `8Gi` persistent volume defined by the related volume claim template. This is the minimum setup supported by the Helm chart and is configured to work out of the box.

### Architectures

The Helm chart is designed to work in multiple architectures or modes, depending on the installation use case. The supported architectures can be selected via the `architecture` Helm chart parameter:


```
# -- Valkey architecture to deploy. Valid values: standalone, sentinel, cluster
architecture: standalone
```


- *Standalone*: This is the default architecture and the simplest to use and configure. Starting from one master node, it can scale to one master plus multiple replica nodes that are exact read-only copies of the master by using [Valkey replication](https://valkey.io/topics/replication/).
- *Sentinel*: This architecture adds additional monitoring and configuration capabilities and provides high availability for Valkey by deploying Valkey Sentinel nodes. Read more on this in the official documentation: [High availability with Valkey Sentinel](https://valkey.io/topics/sentinel/).
- *Cluster*: This topology or architecture adds high availability, high performance and full horizontal scaling with data sharding to Valkey. Find more information about this particular architecture in the official documentation section [Cluster tutorial](https://valkey.io/topics/cluster-tutorial/) and the [Cluster specification](https://valkey.io/topics/cluster-spec/).

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/valkey
```


To view the contents of the Helm chart’s README file, run:


```
helm show readme oci://dp.apps.rancher.io/charts/valkey
```


### Configure the architecture

As introduced in the [section above](index.html#architectures), the Helm chart supports multiple architectures, the default being a simple Valkey standalone node, a single pod. There are a few details to keep in mind for each of the architectures.

#### Deploy Valkey replication

[Valkey replication](https://valkey.io/topics/replication/) can be used to deploy one master node and multiple read-only replicas.

The architecture should be `standalone` and the number of total nodes can be specified via the `nodeCount` Helm chart parameter. For example, to deploy one master and two replicas, the values file below (`replication.yaml`) can be used:


```
# -- Valkey architecture to deploy. Valid values: standalone, sentinel, cluster
architecture: standalone
# -- Desired number of Valkey nodes to deploy (counting the Valkey master node)
nodeCount: 3
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --values replication.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --set architecture=standalone,nodeCount=3
```


After the nodes are initialized, you can see how doing certain write operations in the master node, for example, creating a key, is reflected in the replica nodes:


```
$ kubectl exec <release-name>-valkey-0 -- valkey-cli INFO replication
# Replication
role:master
connected_slaves:2
...

$ kubectl exec <release-name>-valkey-0 -- valkey-cli SET foo bar
OK
$ kubectl exec <release-name>-valkey-1 -- valkey-cli GET foo
bar
```


#### Deploy Valkey Sentinel

[Valkey Sentinel](https://valkey.io/topics/sentinel/) nodes can be deployed on top of the replication mechanism.

The architecture should be `sentinel`. The number of Valkey Sentinel nodes can be specified via the `sentinel.nodeCount` Helm chart parameter. Find all the Helm chart options related to Valkey Sentinel in the [values and the README files](index.html#chart-configuration), under `sentinel.*`. The following values file (`sentinel.yaml`) can be used to deploy one master, two replicas and three Valkey Sentinel nodes.


```
# -- Valkey architecture to deploy. Valid values: standalone, sentinel, cluster
architecture: sentinel
# -- Desired number of Valkey nodes to deploy (counting the Valkey master node)
nodeCount: 3
# Valkey configurations for Sentinel (HA without partitioning)
sentinel:
  # -- Number of Sentinels to deploy (must be 3 or greater for cluster consistency in case of failover)
  nodeCount: 3
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --values sentinel.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --set architecture=sentinel,nodeCount=3,sentinel.nodeCount=3
```


After the nodes are initialized, you can see how two statefulsets are deployed:


```
$ kubectl get statefulsets --selector app.kubernetes.io/instance=<release-name>
NAME                             READY   AGE
<release-name>-valkey            3/3     21s
<release-name>-valkey-sentinel   3/3     21s
```


For demonstration purposes, a failure in the master node can be simulated to [test the failover](https://valkey.io/topics/sentinel/#testing-the-failover).

- Let’s identify that the master node is `<release-name>-valkey-0`:

  

  ```
  $ kubectl exec <release-name>-valkey-0 -- valkey-cli INFO replication
  # Replication
  role:master
  connected_slaves:2

  $ kubectl exec statefulset/<release-name>-valkey-sentinel -- valkey-cli -p 26379 INFO sentinel
  # Sentinel
  sentinel_masters:1
  ...
  master0:name=mymaster,status=ok,address=<release-name>-valkey-0.<release-name>-valkey-headless.default.svc.cluster.local:6379,slaves=2,sentinels=3
  ```

  

- Run the command below that simulates a failure in the master node:

  

  ```
  kubectl delete pod <release-name>-valkey-0
  ```

  

- Wait a few seconds for the command to finish. The Valkey Sentinel nodes should have voted a new master:

  

  ```
  $ kubectl logs statefulset/<release-name>-valkey-sentinel | grep switch-master
  1:X 31 Oct 2025 08:48:48.116 # +switch-master mymaster <release-name>-valkey-0.<release-name>-valkey-headless.default.svc.cluster.local 6379 <release-name>-valkey-2.<release-name>-valkey-headless.default.svc.cluster.local 6379

  $ kubectl exec statefulset/<release-name>-valkey-sentinel -- valkey-cli -p 26379 INFO sentinel
  # Sentinel
  sentinel_masters:1
  ...
  master0:name=mymaster,status=ok,address=<release-name>-valkey-2.<release-name>-valkey-headless.default.svc.cluster.local:6379,slaves=2,sentinels=3

  $ kubectl exec <release-name>-valkey-0 -- valkey-cli INFO replication
  # Replication
  role:slave

  $ kubectl exec <release-name>-valkey-2 -- valkey-cli INFO replication
  # Replication
  role:master
  connected_slaves:2
  ```

  

#### Deploy Valkey Cluster

The [Valkey Cluster](https://valkey.io/topics/cluster-tutorial/) topology is another architecture supported by the Helm chart and it is identified by the `cluster` value in the `architecture` Helm chart parameter.

In this mode, there are constraints in the total number of nodes to deploy (`nodeCount = masterCount + (masterCount * replicasPerMaster)`) and the minimum number of masters should be three.


```
# Valkey Cluster configurations (HA with partitioning)
cluster:
  # -- Amount of replicas per master node that will be configured in the cluster. It must satisfy this rule: `nodeCount = masterCount + (masterCount * replicasPerMaster)`.
  # Or alternatively: `replicasPerMaster = (nodeCount - masterCount) / masterCount`. And all values must be whole numbers.
  # For example, for 6 nodes, if you want 3 masters, then the replicasPerMaster value (number of replicas per master) must be set to 1.
  replicasPerMaster: 0
```


The following values file (`cluster.yaml`) can be used to deploy three masters and three replicas:


```
# -- Valkey architecture to deploy. Valid values: standalone, sentinel, cluster
architecture: cluster
# -- Desired number of Valkey nodes to deploy
nodeCount: 6
# Valkey Cluster configurations (HA with partitioning)
cluster:
  # For example, for 6 nodes, if you want 3 masters, then the replicasPerMaster value (number of replicas per master) must be set to 1.
  replicasPerMaster: 1
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --values cluster.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --set architecture=cluster,nodeCount=6,cluster.replicasPerMaster=1
```


After the nodes are initialized, you can see how the statefulset is deployed and inspect the status of the Valkey Cluster:


```
$ kubectl get statefulsets --selector app.kubernetes.io/instance=<release-name>
NAME                    READY   AGE
<release-name>-valkey   6/6     41s

$ kubectl exec statefulset/<release-name>-valkey -- valkey-cli CLUSTER INFO
cluster_state:ok
...
cluster_known_nodes:6
cluster_size:3
...

$ kubectl exec statefulset/<release-name>-valkey -- valkey-cli CLUSTER NODES
fea47da0a68741e51d86f9f4a2cae905ad1a4c00 10.42.0.37:6379@16379,cucumber-valkey-0.cucumber-valkey-headless.default.svc.cluster.local master - 0 1761872043000 1 connected 0-5460
4a9a256afde9112da184d68753892b476c59f873 10.42.0.39:6379@16379,cucumber-valkey-1.cucumber-valkey-headless.default.svc.cluster.local master - 0 1761872042228 2 connected 5461-10922
47a29569b19778361a59c67b8c90a4da5477731b 10.42.0.38:6379@16379,cucumber-valkey-2.cucumber-valkey-headless.default.svc.cluster.local master - 0 1761872040183 3 connected 10923-16383
247a4a7510c44d1c29bd95367742ae1558c162cb 10.42.0.35:6379@16379,cucumber-valkey-3.cucumber-valkey-headless.default.svc.cluster.local myself,slave 47a29569b19778361a59c67b8c90a4da5477731b 0 0 3 connected
bb433c858ad73339441adfc691be84962673b844 10.42.0.41:6379@16379,cucumber-valkey-4.cucumber-valkey-headless.default.svc.cluster.local slave fea47da0a68741e51d86f9f4a2cae905ad1a4c00 0 1761872042000 1 connected
58810d4201e30494358fcb4654ed75494628ce3f 10.42.0.42:6379@16379,cucumber-valkey-5.cucumber-valkey-headless.default.svc.cluster.local slave 4a9a256afde9112da184d68753892b476c59f873 0 1761872043249 2 connected
```


In this architecture all the nodes are able to handle write queries by redirecting the requests to the proper node. Note the `-c` flag in the `valkey-cli` command to enable cluster mode and be able to follow the redirections:


```
$ kubectl exec -it <release-name>-valkey-3 -- valkey-cli -c
127.0.0.1:6379> INFO replication
# Replication
role:slave
...

127.0.0.1:6379> SET foo bar
-> Redirected to slot [12182] located at <release-name>-valkey-2.<release-name>-valkey-headless.default.svc.cluster.local:6379
OK
```


For a complete overview of the capabilities of this architecture, follow the official documentation section [Cluster tutorial](https://valkey.io/topics/cluster-tutorial/).

### Valkey authentication

By default, authentication is enabled and the Valkey Helm chart configures the legacy password-based authentication that is used by all the clients. If not specified via the `auth.password` Helm chart parameter, the password is randomly generated on installation.


```
auth:
  # -- Enable Valkey password authentication
  enabled: true
  # -- Valkey password
  password: ""
```


The Helm chart also allows to disable authentication (`no_auth.yaml`):


```
auth:
  enabled: false
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --values no_auth.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --set auth.enabled=false
```


Alternatively to the legacy password-base authentication, [Valkey ACL](https://valkey.io/topics/acl/) can be used.

### TLS

SSL/TLS can be enabled via the `tls.*` Helm chart parameters. Find all the TLS options in the [values and the README files](index.html#chart-configuration). TLS can be enabled to encrypt client to node connections as well as node-to-node communications at different levels as well as to allow client certificate authentication. Dig into the topic by reading the [TLS section](https://valkey.io/topics/encryption/) of the official documentation.

To cover this feature with a simple example, let’s configure a Valkey installation to authenticate client connections to the nodes via TLS.

- First, generate client and server TLS certificates. Read how to do it [here](https://kubernetes.io/docs/tasks/administer-cluster/certificates) if needed. You can use [cert-manager](https://apps.rancher.io/applications/cert-manager) or the [`gen-test-certs.sh`](https://github.com/valkey-io/valkey/blob/unstable/utils/gen-test-certs.sh) script from the official Valkey repository as well.

- Once they are generated, create the Kubernetes secrets for the certificates:

  

  ```
  kubectl create secret generic valkey-cert --from-file ca.crt --from-file valkey.crt --from-file valkey.key
  ```

  

- Install the Valkey Helm chart providing the following parameters (`tls.yaml`):

  

  ```
  tls:
    # -- Enable TLS
    enabled: true
    # -- Whether to require Valkey clients to authenticate with a valid certificate (authenticated against the trusted root CA certificate)
    authClients: true
    # -- Name of the secret containing the Valkey certificates
    existingSecret: "valkey-cert"
    # -- Certificate filename in the secret
    certFilename: "valkey.crt"
    # -- Certificate key filename in the secret
    keyFilename: "valkey.key"
    # -- CA certificate filename in the secret
    caCertFilename: "ca.crt"
  ```

  

  

  ```
  helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
      --set global.imagePullSecrets={application-collection} \
      --values tls.yaml
  ```

  

- Check TLS connections. They are now required:

  

  ```
  $ kubectl exec statefulset/<release-name>-valkey -- valkey-cli PING
  I/O error
  Error: Connection reset by peer

  $ kubectl exec statefulset/<release-name>-valkey -- valkey-cli --tls PING
  Could not connect to Valkey at 127.0.0.1:6379: SSL_connect failed: certificate verify failed

  $ kubectl exec statefulset/<release-name>-valkey -- valkey-cli --tls --cacert /mnt/valkey/certs/ca.crt --cert /mnt/valkey/certs/valkey.crt --key /mnt/valkey/certs/valkey.key PING
  PONG
  ```

  

### Configuration files

The Helm chart allows to provide extra configurations to be read by Valkey. Find more details in the [values and the README files](index.html#chart-configuration) and in the [official documentation](https://github.com/valkey-io/valkey/blob/unstable/valkey.conf):


```
configurationFile: valkey.conf
# -- Extra configurations to add to the Valkey configuration file. Can be defined as a string, a key-value map, or an array of entries.
# See: https://github.com/valkey-io/valkey/blob/unstable/valkey.conf
configuration: ""
# -- Name of an existing config map for extra configurations to add to the Valkey configuration file
existingConfigMap: ""
```


In the same way, Sentinel can also receive extra configuration:


```
sentinel:
  # -- Sentinel configuration file name in the config map
  configurationFile: sentinel.conf
  # -- Extra configurations to add to the Sentinel configuration file. Can be defined as a string, a key-value map, or an array of entries.
  # See:https://github.com/valkey-io/valkey/blob/unstable/sentinel.conf
  configuration: ""
  # -- Name of an existing config map for extra configurations to add to the Sentinel configuration file
  existingConfigMap: ""
```


As an example, to customize the maximum memory to `7777`, the Helm chart values below can be provided (`config.yaml`):


```
configuration: |
  maxmemory 7777
```


Alternatively, to split the configuration in multiple files:


```
configuration: |
  include /mnt/valkey/conf/maxmemory.conf
configMap:
  maxmemory.conf: |
    maxmemory 7777
```


Then, install the Helm chart as follows:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --values config.yaml
```


Now the `maxmemory` variable is set to the desired value:


```
$ kubectl exec statefulset/<release-name>-valkey -- valkey-cli CONFIG GET maxmemory
maxmemory
7777
```


> It is also possible to [reconfigure Valkey on the fly](https://valkey.io/topics/valkey.conf/#changing-valkey-configuration-while-the-server-is-running) with the `CONFIG SET` and `CONFIG REWRITE` commands and the configuration will be persisted.

### Additional configurations

There are certain specially relevant settings that can be configured directly via Helm chart parameters. Some of these are `disableCommands` or `appendOnlyFile`. Find more details in the [values and the README files](index.html#chart-configuration).


```
# -- List of Valkey commands to disable
disableCommands:
  - FLUSHALL
  - FLUSHDB
# -- Whether to enable Append Only File (AOF) mode
# See: https://github.com/valkey-io/valkey/blob/unstable/valkey.conf
appendOnlyFile: true
```


For example, to disable Append Only File (AOF) mode, you would pass the following values file (`no_aof.yaml`):


```
appendOnlyFile: false
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --values no_aof.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --set appendOnlyFile=false
```


The Append Only File (AOF) mode is disabled now:


```
$ kubectl exec statefulset/<release-name>-valkey -- valkey-cli CONFIG GET appendonly
appendonly
no
```


### Persistence

By default, the Valkey data persistence is achieved via persistent volume claims, one per replica, of `8Gi` each. The size and other persistence settings are configurable via Helm chart `persistence.*` parameters. Find all the persistence options in the [values and the README files](index.html#chart-configuration).

As an example, to configure `16Gi` sized persistent volume claims, you would pass the following values file (`persistence.yaml`) to the installation command:


```
persistence:
  resources:
    requests:
      storage: 16Gi
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --values persistence.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --set persistence.resources.requests.storage=16Gi
```


### Metrics

The Valkey Helm chart can deploy a metrics exporter as a sidecar container that exposes Prometheus metrics to be scraped by a Prometheus server. The metrics exporter is disabled by default but it can be enabled via Helm chart parameters (`metrics.yaml`):


```
metrics:
  enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --values metrics.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --set metrics.enabled=true
```


Prometheus metrics can be scraped now:


```
$ kubectl port-forward svc/<release-name>-valkey-metrics 9121

$ curl -s localhost:9121/metrics | grep redis_uptime_in_seconds
# HELP redis_uptime_in_seconds uptime_in_seconds metric
# TYPE redis_uptime_in_seconds gauge
redis_uptime_in_seconds 25
```


## Operations

### Adapt volume permissions

The Valkey Helm chart has a feature to adapt and prepare volume permissions before the database initialization. Depending on the environment where you are deploying the Helm chart, this can be necessary to run the application. You can activate the feature via Helm chart parameters (`adapt_permissions.yaml`):


```
podTemplates:
  initContainers:
    volume-permissions:
      enabled: true

sentinel:
  podTemplates:
    initContainers:
      volume-permissions:
        enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --values adapt_permissions.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --set global.imagePullSecrets={application-collection} \
    --set podTemplates.initContainers.volume-permissions.enabled=true \
    --set sentinel.podTemplates.initContainers.volume-permissions.enabled=true
```


Usually, you only need to adapt the permissions once. After Valkey is properly running, you can [upgrade the Helm chart](index.html#upgrade-the-chart) and deactivate the volume-permissions init container:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/valkey \
    --reuse-values \
    --set podTemplates.initContainers.volume-permissions.enabled=false \
    --set sentinel.podTemplates.initContainers.volume-permissions.enabled=false
```


### Upgrade the chart

In general, an in-place upgrade of your Valkey installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/valkey
```


The pods will be upgraded by following the update strategy defined in the `values.yaml` file.

> Be aware that changes from version to version may include breaking changes in Valkey itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Always check the [release notes](https://github.com/valkey-io/valkey/releases) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed Valkey Helm chart release is simple:


```
helm uninstall <release-name>
```


The Valkey nodes are deployed as [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/), hence using [Volume Claim Templates](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates) to store your most precious resource in a database installation: your data. These PVCs are not directly controlled by Helm and they are not removed when uninstalling the related chart.

When you are ready to remove the PVCs and your data, you will need to explicitly delete them:


```
kubectl delete pvc --selector app.kubernetes.io/instance=<release-name>
```


Last modified October 31, 2025


