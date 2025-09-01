---
description: Learn how to install and use NATS
lang: en
robots: index, follow
title: NATS \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use NATS
twitter:title: NATS
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  NATS


# NATS


Learn how to install and use NATS


![NATS Logo](images/reference-guides/logo-nats.png "NATS Logo")

## Get started

[NATS](https://apps.rancher.io/applications/nats) is a simple, secure and high performance open source data layer for cloud native applications, IoT messaging, and microservices architectures.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/nats \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The NATS Helm chart distributed in Application Collection is based on the [NATS Helm chart](https://github.com/nats-io/k8s/tree/main/helm/charts/nats) and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. Additionally to the upstream chart repository, you can check the official NATS documentation [here](https://docs.nats.io).

By default, the chart will deploy a single NATS Server replica and a single-pod deployment with [nats-box](https://github.com/nats-io/nats-box), a container image shipping utilities to interact with NATS.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/nats
```


### Clustering configuration

[NATS Clustering](https://docs.nats.io/running-a-nats-service/configuration/clustering/cluster_config) can be activated via Helm chart parameters. It defaults to 3 replicas:


```
config:
  cluster:
    enabled: false
    # must be 2 or higher when jetstream is enabled
    replicas: 3
```


As an example, to configure a 2-replicas NATS cluster, you would install the Helm chart providing the following command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/nats \
    --set global.imagePullSecrets={application-collection} \
    --set config.cluster.enabled=true,config.cluster.replicas=2
```


### Activate JetStream

[JetStream](https://docs.nats.io/nats-concepts/jetstream) capabilities can also be activated in a simple manner via Helm chart parameters. Following with the example from the section above, you would install the Helm chart providing the following values file (`nats.yaml`):


```
config:
  cluster:
    enabled: true
    replicas: 2
  jetstream:
    enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/nats \
    --set global.imagePullSecrets={application-collection} \
    --values nats.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/nats \
    --set global.imagePullSecrets={application-collection} \
    --set config.cluster.enabled=true,config.cluster.replicas=2 \
    --set config.jetstream.enabled=true
```


When JetStream is active, messages are persisted and can be replayed at a later time. The following command creates a stream associated to the “test” subject and sends 2 messages:


```
$ kubectl exec -it deployment/<release-name>-box -- nats bench js pub test --create --msgs=2
15:20:01 Starting JetStream publish benchmark [batch=500, clients=1, dedup-window=2m0s, deduplication=false, max-bytes=1,073,741,824, msg-size=128 B, msgs=2, multi-subject=false, multi-subject-max=100,000, purge=false, replicas=1, sleep=0s, storage=file, stream=benchstream, subject=test]
15:20:01 Starting publisher, publishing 2 messages
Finished      0s [===============================================================================================================================================================================] 100%

Pub stats: 2,799 msgs/sec ~ 349.96 KB/sec
```


At a later time, a subscriber can read old messages from the subject:


```
$ kubectl exec -it deployment/<release-name>-box -- nats sub test --all
15:22:28 Subscribing to JetStream Stream holding messages with subject test starting with the first message received
[#1] Received JetStream message: stream: benchstream seq 1 / subject: test / time: 2025-04-02T15:20:01Z


[#2] Received JetStream message: stream: benchstream seq 2 / subject: test / time: 2025-04-02T15:20:01Z
```


### Additional configurations

The NATS Helm chart is highly configurable via merge and patch templating strategies. Refer to the NATS [README.md](https://github.com/nats-io/k8s/tree/main/helm/charts/nats) to know more about these advanced templating features.

## Operations

### Check connectivity

As explained earlier, the Helm chart deploys nats-box. You can use the [NATS CLI](https://github.com/nats-io/natscli) utility to verify the connectivity:


```
$ kubectl exec -it deployment/<release-name>-box -- nats server check connection
OK Connection OK:connected to nats://<release-name>:4222 in 825.666µs OK:rtt time 101.875µs OK:round trip took 0.000100s | connect_time=0.0008s;0.5000;1.0000 rtt=0.0001s;0.5000;1.0000 request_time=0.0001s;0.5000;1.0000
```


You can also check the connectivity by sending and receiving messages. Start a subscriber waiting to receive messages from the “test” subject:


```
$ kubectl exec -it deployment/<release-name>-box -- nats sub test
15:10:06 Subscribing on test
```


On a different terminal, publish a message to the “test” subject:


```
$ kubectl exec -it deployment/<release-name>-box -- nats pub test 'hello world'
15:10:12 Published 11 bytes to "test"
```


The subscriber should receive the message:


```
$ kubectl exec -it deployment/<release-name>-box -- nats sub test
15:10:06 Subscribing on test
[#1] Received on "test"
hello world
```


### Upgrade the chart

In general, an in-place upgrade of your NATS installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/nats
```


> Be aware that changes from version to version may include breaking changes in NATS itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Refer to the official [release notes](https://docs.nats.io/release-notes) and always check the [Helm chart’s Upgrade notes](https://github.com/nats-io/k8s/tree/main/helm/charts/nats#upgrade-nodes) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed NATS Helm chart release is simple:


```
helm uninstall <release-name>
```


When you enable [JetStream](https://docs.nats.io/nats-concepts/jetstream) or [NATS Resolver](https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_intro/jwt/resolver), the NATS servers are deployed using [Volume Claim Templates](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates). These PVCs are not directly controlled by Helm and they are not removed when uninstalling the related chart.

When you are ready to remove the PVCs and their data, you will need to explicitly delete them:


```
kubectl delete pvc --selector app.kubernetes.io/instance=<release-name>
```


Last modified July 22, 2025


