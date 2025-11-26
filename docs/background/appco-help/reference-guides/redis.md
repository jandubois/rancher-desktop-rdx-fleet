---
description: Learn how to install and use Redis
lang: en
robots: index, follow
title: Redis \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Redis
twitter:title: Redis
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Redis


# Redis


Learn how to install and use Redis


![Redis Logo](images/reference-guides/logo-redis.png "Redis Logo")

## Get started

[Redis](https://apps.rancher.io/applications/redis) is an open-source, in-memory data store used by millions of developers as a cache, vector database, document database, streaming engine, and message broker.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The Redis Helm chart distributed in Application Collection is made from scratch, which allowed us to include every best practice and standardization we deemed necessary. When creating it, the objective was to keep the underlying Redis features intact while simplifying some of its mechanisms when deployed in a Kubernetes environment.

By default, the chart will deploy the `standalone` architecture: A [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) with a single Redis server enabling password-based authentication. The Redis data is stored in a `8Gi` persistent volume defined by the related volume claim template. This is the minimum setup supported by the Helm chart and is configured to work out of the box.

### Architectures

The Helm chart is designed to work in multiple architectures or modes, depending on the installation use case. The supported architectures can be selected via the `architecture` Helm chart parameter:


```
# -- Redis architecture to deploy. Valid values: standalone, sentinel, cluster
architecture: standalone
```


- *Standalone*: This is the default architecture and the simplest to use and configure. Starting from one master node, it can scale to one master plus multiple replica nodes that are exact read-only copies of the master by using [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/).
- *Sentinel*: This architecture adds additional monitoring and configuration capabilities and provides high availability for Redis by deploying Redis Sentinel nodes. Read more on this in the official documentation: [High availability with Redis Sentinel](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/).
- *Cluster*: This topology or architecture adds high availability, high performance and full horizontal scaling with data sharding to Redis. Find more information about this particular architecture in the official documentation section [Scale with Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/) and the [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/).

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/redis
```


To view the contents of the Helm chart’s README file, run:


```
helm show readme oci://dp.apps.rancher.io/charts/redis
```


### Configure the architecture

As introduced in the [section above](index.html#architectures), the Helm chart supports multiple architectures, the default being a simple Redis standalone node, a single pod. There are a few details to keep in mind for each of the architectures.

#### Deploy Redis replication

[Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/) can be used to deploy one master node and multiple read-only replicas.

The architecture should be `standalone` and the number of total nodes can be specified via the `nodeCount` Helm chart parameter. For example, to deploy one master and two replicas, the values file below (`replication.yaml`) can be used:


```
# -- Redis architecture to deploy. Valid values: standalone, sentinel, cluster
architecture: standalone
# -- Desired number of Redis nodes to deploy (counting the Redis master node)
nodeCount: 3
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --values replication.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --set architecture=standalone,nodeCount=3
```


After the nodes are initialized, you can see how doing certain write operations in the master node, for example, creating a key, is reflected in the replica nodes:


```
$ kubectl exec <release-name>-redis-0 -- redis-cli INFO replication
# Replication
role:master
connected_slaves:2
...

$ kubectl exec <release-name>-redis-0 -- redis-cli SET foo bar
OK
$ kubectl exec <release-name>-redis-1 -- redis-cli GET foo
bar
```


#### Deploy Redis Sentinel

[Redis Sentinel](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/) nodes can be deployed on top of the replication mechanism.

The architecture should be `sentinel`. The number of Redis Sentinel nodes can be specified via the `sentinel.nodeCount` Helm chart parameter. Find all the Helm chart options related to Redis Sentinel in the [values and the README files](index.html#chart-configuration), under `sentinel.*`. The following values file (`sentinel.yaml`) can be used to deploy one master, two replicas and three Redis Sentinel nodes.


```
# -- Redis architecture to deploy. Valid values: standalone, sentinel, cluster
architecture: sentinel
# -- Desired number of Redis nodes to deploy (counting the Redis master node)
nodeCount: 3
# Redis configurations for Sentinel (HA without partitioning)
sentinel:
  # -- Number of Sentinels to deploy (must be 3 or greater for cluster consistency in case of failover)
  nodeCount: 3
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --values sentinel.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --set architecture=sentinel,nodeCount=3,sentinel.nodeCount=3
```


After the nodes are initialized, you can see how two statefulsets are deployed:


```
$ kubectl get statefulsets --selector app.kubernetes.io/instance=<release-name>
NAME                            READY   AGE
<release-name>-redis            3/3     55s
<release-name>-redis-sentinel   3/3     55s
```


For demonstration purposes, a failure in the master node can be simulated to [test the failover](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/#testing-the-failover).

- Let’s identify that the master node is `<release-name>-redis-0`:

  

  ```
  $ kubectl exec <release-name>-redis-0 -- redis-cli INFO replication
  # Replication
  role:master
  connected_slaves:2

  $ kubectl exec statefulset/<release-name>-redis-sentinel -- redis-cli -p 26379 INFO sentinel
  # Sentinel
  sentinel_masters:1
  ...
  master0:name=mymaster,status=ok,address=<release-name>-redis-0.<release-name>-redis-headless.default.svc.cluster.local:6379,slaves=2,sentinels=3
  ```

  

- Run the command below that simulates a failure in the master node:

  

  ```
  kubectl delete pod <release-name>-redis-0
  ```

  

- Wait a few seconds for the command to finish. The Redis Sentinel nodes should have voted a new master:

  

  ```
  $ kubectl logs statefulset/<release-name>-redis-sentinel | grep switch-master
  1:X 30 Oct 2025 15:25:31.945 # +switch-master mymaster <release-name>-redis-0.<release-name>-redis-headless.default.svc.cluster.local 6379 <release-name>-redis-2.<release-name>-redis-headless.default.svc.cluster.local 6379

  $ kubectl exec statefulset/<release-name>-redis-sentinel -- redis-cli -p 26379 INFO sentinel
  # Sentinel
  sentinel_masters:1
  ...
  master0:name=mymaster,status=ok,address=<release-name>-redis-2.<release-name>-redis-headless.default.svc.cluster.local:6379,slaves=2,sentinels=3

  $ kubectl exec <release-name>-redis-0 -- redis-cli INFO replication
  # Replication
  role:slave

  $ kubectl exec <release-name>-redis-2 -- redis-cli INFO replication
  # Replication
  role:master
  connected_slaves:2
  ```

  

#### Deploy Redis Cluster

The [Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/) topology is another architecture supported by the Helm chart and it is identified by the `cluster` value in the `architecture` Helm chart parameter.

In this mode, there are constraints in the total number of nodes to deploy (`nodeCount = masterCount + (masterCount * replicasPerMaster)`) and the minimum number of masters should be three.


```
# Redis Cluster configurations (HA with partitioning)
cluster:
  # -- Amount of replicas per master node that will be configured in the cluster. It must satisfy this rule: `nodeCount = masterCount + (masterCount * replicasPerMaster)`.
  # Or alternatively: `replicasPerMaster = (nodeCount - masterCount) / masterCount`. And all values must be whole numbers.
  # For example, for 6 nodes, if you want 3 masters, then the replicasPerMaster value (number of replicas per master) must be set to 1.
  replicasPerMaster: 0
```


The following values file (`cluster.yaml`) can be used to deploy three masters and three replicas:


```
# -- Redis architecture to deploy. Valid values: standalone, sentinel, cluster
architecture: cluster
# -- Desired number of Redis nodes to deploy
nodeCount: 6
# Redis Cluster configurations (HA with partitioning)
cluster:
  # For example, for 6 nodes, if you want 3 masters, then the replicasPerMaster value (number of replicas per master) must be set to 1.
  replicasPerMaster: 1
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --values cluster.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --set architecture=cluster,nodeCount=6,cluster.replicasPerMaster=1
```


After the nodes are initialized, you can see how the statefulset is deployed and inspect the status of the Redis Cluster:


```
$ kubectl get statefulsets --selector app.kubernetes.io/instance=<release-name>
NAME                   READY   AGE
<release-name>-redis   6/6     51s

$ kubectl exec statefulset/<release-name>-redis -- redis-cli CLUSTER INFO
cluster_state:ok
...
cluster_known_nodes:6
cluster_size:3
...

$ kubectl exec statefulset/<release-name>-redis -- redis-cli CLUSTER NODES
3cb589016a65bfb27fb2f123880863649ae7d5f6 10.42.0.135:6379@16379,<release-name>-redis-0.<release-name>-redis-headless.default.svc.cluster.local myself,master - 0 0 1 connected 0-5460
bff996dfed2c299201eb977c28a5cc0db62dd21e 10.42.0.138:6379@16379,<release-name>-redis-2.<release-name>-redis-headless.default.svc.cluster.local master - 0 1761857249302 3 connected 10923-16383
37f1531bd802eda6e2ded083bd87093662e111ae 10.42.0.139:6379@16379,<release-name>-redis-1.<release-name>-redis-headless.default.svc.cluster.local master - 0 1761857249000 2 connected 5461-10922
62781b659c8c054d454be2438ab81db7082ee539 10.42.0.137:6379@16379,<release-name>-redis-3.<release-name>-redis-headless.default.svc.cluster.local slave bff996dfed2c299201eb977c28a5cc0db62dd21e 0 1761857248278 3 connected
868042e31d3d5238c14fbd3dc77b17b2e7bd71d8 10.42.0.142:6379@16379,<release-name>-redis-4.<release-name>-redis-headless.default.svc.cluster.local slave 3cb589016a65bfb27fb2f123880863649ae7d5f6 0 1761857248000 1 connected
f6aaf32dd22a4992ac4064d9542cc2fe4847f4ad 10.42.0.141:6379@16379,<release-name>-redis-5.<release-name>-redis-headless.default.svc.cluster.local slave 37f1531bd802eda6e2ded083bd87093662e111ae 0 1761857246000 2 connected
```


In this architecture all the nodes are able to handle write queries by redirecting the requests to the proper node. Note the `-c` flag in the `redis-cli` command to enable cluster mode and be able to follow the redirections:


```
$ kubectl exec -it <release-name>-redis-3 -- redis-cli -c
127.0.0.1:6379> INFO replication
# Replication
role:slave
...

127.0.0.1:6379> SET foo bar
-> Redirected to slot [12182] located at <release-name>-redis-2.<release-name>-redis-headless.default.svc.cluster.local:6379
OK
```


For a complete overview of the capabilities of this architecture, follow the official documentation section [Scale with Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/).

### Redis authentication

By default, authentication is enabled and the Redis Helm chart configures the [legacy password-based authentication](https://redis.io/docs/latest/operate/oss_and_stack/management/security/#authentication) that is used by all the clients. If not specified via the `auth.password` Helm chart parameter, the password is randomly generated on installation.


```
auth:
  # -- Enable Redis password authentication
  enabled: true
  # -- Redis password
  password: ""
```


The Helm chart also allows to disable authentication (`no_auth.yaml`):


```
auth:
  enabled: false
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --values no_auth.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --set auth.enabled=false
```


Alternatively to the legacy password-base authentication, [Redis ACL](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/) can be used.

### TLS

SSL/TLS can be enabled via the `tls.*` Helm chart parameters. Find all the TLS options in the [values and the README files](index.html#chart-configuration). TLS can be enabled to encrypt client to node connections as well as node-to-node communications at different levels as well as to allow client certificate authentication. Dig into the topic by reading the [TLS section](https://redis.io/docs/latest/operate/oss_and_stack/management/security/encryption) of the official documentation.

To cover this feature with a simple example, let’s configure a Redis installation to authenticate client connections to the nodes via TLS.

- First, generate client and server TLS certificates. Read how to do it [here](https://kubernetes.io/docs/tasks/administer-cluster/certificates) if needed. You can use [cert-manager](https://apps.rancher.io/applications/cert-manager) or the [`gen-test-certs.sh`](https://github.com/redis/redis/blob/unstable/utils/gen-test-certs.sh) script from the official Redis repository as well.

- Once they are generated, create the Kubernetes secrets for the certificates:

  

  ```
  kubectl create secret generic redis-cert --from-file ca.crt --from-file redis.crt --from-file redis.key
  ```

  

- Install the Redis Helm chart providing the following parameters (`tls.yaml`):

  

  ```
  tls:
    # -- Enable TLS
    enabled: true
    # -- Whether to require Redis clients to authenticate with a valid certificate (authenticated against the trusted root CA certificate)
    authClients: true
    # -- Name of the secret containing the Redis certificates
    existingSecret: "redis-cert"
    # -- Certificate filename in the secret
    certFilename: "redis.crt"
    # -- Certificate key filename in the secret
    keyFilename: "redis.key"
    # -- CA certificate filename in the secret
    caCertFilename: "ca.crt"
  ```

  

  

  ```
  helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
      --set global.imagePullSecrets={application-collection} \
      --values tls.yaml
  ```

  

- Check TLS connections. They are now required:

  

  ```
  $ kubectl exec statefulset/<release-name>-redis -- redis-cli PING
  I/O error
  Error: Connection reset by peer

  $ kubectl exec statefulset/<release-name>-redis -- redis-cli --tls PING
  Could not connect to Redis at 127.0.0.1:6379: SSL_connect failed: certificate verify failed

  $ kubectl exec statefulset/<release-name>-redis -- redis-cli --tls --cacert /mnt/redis/certs/ca.crt --cert /mnt/redis/certs/redis.crt --key /mnt/redis/certs/redis.key PING
  PONG
  ```

  

### Configuration files

The Helm chart allows to provide extra configurations to be read by Redis. Find more details in the [values and the README files](index.html#chart-configuration) and in the [official documentation](https://redis.io/docs/latest/operate/oss_and_stack/management/config-file/):


```
configurationFile: redis.conf
# -- Extra configurations to add to the Redis configuration file. Can be defined as a string, a key-value map, or an array of entries.
# See: https://redis.io/docs/latest/operate/oss_and_stack/management/config-file/
configuration: ""
# -- Name of an existing config map for extra configurations to add to the Redis configuration file
existingConfigMap: ""
```


In the same way, Sentinel can also receive extra configuration:


```
sentinel:
  # -- Sentinel configuration file name in the config map
  configurationFile: sentinel.conf
  # -- Extra configurations to add to the Sentinel configuration file. Can be defined as a string, a key-value map, or an array of entries.
  # See: https://github.com/redis/redis/blob/unstable/sentinel.conf
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
  include /mnt/redis/conf/maxmemory.conf
configMap:
  maxmemory.conf: |
    maxmemory 7777
```


Then, install the Helm chart as follows:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --values config.yaml
```


Now the `maxmemory` variable is set to the desired value:


```
$ kubectl exec statefulset/<release-name>-redis -- redis-cli CONFIG GET maxmemory
maxmemory
7777
```


> It is also possible to [reconfigure Redis on the fly](https://redis.io/docs/latest/operate/oss_and_stack/management/config/#changing-redis-configuration-while-the-server-is-running) with the `CONFIG SET` and `CONFIG REWRITE` commands and the configuration will be persisted.

### Additional configurations

There are certain specially relevant settings that can be configured directly via Helm chart parameters. Some of these are `disableCommands`, `appendOnlyFile` or `redisModules`. Find more details in the [values and the README files](index.html#chart-configuration).


```
# -- List of Redis commands to disable
disableCommands:
  - FLUSHALL
  - FLUSHDB
# -- Whether to enable Append Only File (AOF) mode
# See: https://redis.io/docs/latest/operate/oss_and_stack/management/config-file/
appendOnlyFile: true
# -- List of Redis modules to enable during startup. In Redis 8.0.x and 8.2.x, the following modules are supported: redisbloom, redisearch, redistimeseries, rejson.
# See: https://redis.io/docs/latest/operate/oss_and_stack/management/config-file/
redisModules: []
```


For example, to enable the RediSearch and RedisJSON modules, you would pass the following values file (`modules.yaml`):


```
redisModules:
  - redisearch
  - rejson
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --values modules.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --set redisModules='{redisearch,rejson}'
```


The modules are enabled now:


```
$ kubectl exec statefulset/<release-name>-redis -- redis-cli MODULE LIST
name
search
ver
80205
path
/usr/lib64/redis/modules/redisearch.so
...
name
ReJSON
ver
80201
path
/usr/lib64/redis/modules/rejson.so
```


### Persistence

By default, the Redis data persistence is achieved via persistent volume claims, one per replica, of `8Gi` each. The size and other persistence settings are configurable via Helm chart `persistence.*` parameters. Find all the persistence options in the [values and the README files](index.html#chart-configuration).

As an example, to configure `16Gi` sized persistent volume claims, you would pass the following values file (`persistence.yaml`) to the installation command:


```
persistence:
  resources:
    requests:
      storage: 16Gi
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --values persistence.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --set persistence.resources.requests.storage=16Gi
```


### Metrics

The Redis Helm chart can deploy a metrics exporter as a sidecar container that exposes Prometheus metrics to be scraped by a Prometheus server. The metrics exporter is disabled by default but it can be enabled via Helm chart parameters (`metrics.yaml`):


```
metrics:
  enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --values metrics.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --set metrics.enabled=true
```


Prometheus metrics can be scraped now:


```
$ kubectl port-forward svc/<release-name>-redis-metrics 9121

$ curl -s localhost:9121/metrics | grep redis_uptime_in_seconds
# HELP redis_uptime_in_seconds uptime_in_seconds metric
# TYPE redis_uptime_in_seconds gauge
redis_uptime_in_seconds 87
```


## Operations

### Adapt volume permissions

The Redis Helm chart has a feature to adapt and prepare volume permissions before the database initialization. Depending on the environment where you are deploying the Helm chart, this can be necessary to run the application. You can activate the feature via Helm chart parameters (`adapt_permissions.yaml`):


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
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --values adapt_permissions.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/redis \
    --set global.imagePullSecrets={application-collection} \
    --set podTemplates.initContainers.volume-permissions.enabled=true \
    --set sentinel.podTemplates.initContainers.volume-permissions.enabled=true
```


Usually, you only need to adapt the permissions once. After Redis is properly running, you can [upgrade the Helm chart](index.html#upgrade-the-chart) and deactivate the volume-permissions init container:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/redis \
    --reuse-values \
    --set podTemplates.initContainers.volume-permissions.enabled=false \
    --set sentinel.podTemplates.initContainers.volume-permissions.enabled=false
```


### Upgrade the chart

In general, an in-place upgrade of your Redis installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/redis
```


The pods will be upgraded by following the update strategy defined in the `values.yaml` file.

> Be aware that changes from version to version may include breaking changes in Redis itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Always check the [release notes](https://github.com/redis/redis/releases) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed Redis Helm chart release is simple:


```
helm uninstall <release-name>
```


The Redis nodes are deployed as [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/), hence using [Volume Claim Templates](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates) to store your most precious resource in a database installation: your data. These PVCs are not directly controlled by Helm and they are not removed when uninstalling the related chart.

When you are ready to remove the PVCs and your data, you will need to explicitly delete them:


```
kubectl delete pvc --selector app.kubernetes.io/instance=<release-name>
```


Last modified October 31, 2025


