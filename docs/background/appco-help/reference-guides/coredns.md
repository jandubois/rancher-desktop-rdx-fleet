---
description: Learn how to install and use CoreDNS
lang: en
robots: index, follow
title: CoreDNS \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use CoreDNS
twitter:title: CoreDNS
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  CoreDNS


# CoreDNS


Learn how to install and use CoreDNS


![CoreDNS Logo](images/reference-guides/logo-coredns.png "CoreDNS Logo")

## Get started

[CoreDNS](https://apps.rancher.io/applications/coredns) is a DNS server/forwarder, written in Go, that chains plugins. Each plugin performs a (DNS) function.

Before getting into the chart’s possibilities, let’s start by deploying the default configuration to run CoreDNS as an external service DNS:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/coredns \
    --set isClusterService=false \
    --set global.imagePullSecrets={application-collection}
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

Our CoreDNS chart is based on the official [Helm chart for CoreDNS](https://github.com/coredns/helm) and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. You can check the official documentation [here](https://coredns.io/manual/toc/).

By default, the chart will be installed as a cluster DNS service and a drop-in replacement for Kube/SkyDNS. This is intended for clusters where no DNS provider exists yet. The chart can also be installed as an external DNS service in a user-specified namespace, which is the configuration mode we will use throughout this guide.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/coredns
```


### Configure a server block

To configure a server block you need to define it in the `servers` parameter. The chart comes with the default server block configured, which we will use and expand its configuration by adding custom A records. We will use the following configuration for our example:


```
# custom_values.yaml
servers:
  - zones:
      - zone: .
        use_tcp: true
    port: 53
    plugins:
      # We'll put the 'hosts' block before the default plugins
      - name: hosts
        configBlock: |
          # Add a host record
          192.168.10.100 example.com

          # Blocklist a specific domain
          0.0.0.0 not.example.com
          
          fallthrough
      # We'll keep the rest of defaults plugin configs
      ...
```


The above configuration creates an A record to “override” `example.com` and point it to the internal IP `192.168.10.100` and another one to “block” `not.example.com` by resolving it to a non-routable IP. Finally, this directive passes any query not matching this list (like `one.one.one.one`) to the next plugin.

Let’s see how we can verify our configuration is working in a newly deployed chart:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/coredns \
    --set isClusterService=false \
    --set global.imagePullSecrets={application-collection} \
    --values custom_values.yaml
```


Once deployed, we need to retrieve the CoreDNS service IP and then check our new DNS server by using an auxiliary `bci-busybox` pod. With this pod we will query for the `example.com` domain and verify our server correctly resolves the domain to the custom IP we assigned in the hosts plugin:


```
$ export COREDNS_SERVICE_IP=$(kubectl get svc -l app.kubernetes.io/instance=<release-name> -o jsonpath='{.items[0].spec.clusterIP}')
$ kubectl run busybox -it --rm --restart=Never \
    --image dp.apps.rancher.io/containers/bci-busybox:15.7 \
    --overrides='{"spec": {"imagePullSecrets":[{"name": "application-collection"}]}}' \
    -- nslookup example.com $COREDNS_SERVICE_IP
Server:    <COREDNS_SERVICE_IP>
Address 1: <COREDNS_SERVICE_IP> <release-name>-coredns.default.svc.cluster.local

Name:      example.com
Address 1: 192.168.10.100 example.com
```


In the same way, we can verify the fallthrough directive is working. A query for a domain not in our hosts block will be passed to the `forward` plugin (next one in the list of plugins) to be resolved externally:


```
$ kubectl run busybox -it --rm --restart=Never \
    --image dp.apps.rancher.io/containers/bci-busybox:15.7 \
    --overrides='{"spec": {"imagePullSecrets":[{"name": "application-collection"}]}}' \
    -- nslookup one.one.one.one $COREDNS_SERVICE_IP
Server:    <COREDNS_SERVICE_IP>
Address 1: <COREDNS_SERVICE_IP> <release-name>-coredns.default.svc.cluster.local

Name:      one.one.one.one
Address 1: 1.1.1.1
Address 2: 1.0.0.1
```


### Configure autoscaling

The CoreDNS Helm chart provides two different methods for autoscaling:

- Horizontal Pod Autoscaler (HPA): Scales the number of CoreDNS pods based on CPU/memory load.
- Cluster Proportional Autoscaler: Scales the number of CoreDNS pods based on the size of the cluster (number of nodes and cores).

Each HPA and cluster proportional autoscaler can be configured by setting the `hpa` and `autoscaler` parameters respectively. These parameters default to:


```
hpa:
  enabled: false
  minReplicas: 1
  maxReplicas: 2
autoscaler:
  # Enable the cluster-proportional-autoscaler
  enabled: false
  # Number of cores in the cluster per coredns replica
  coresPerReplica: 256
  # Number of nodes in the cluster per coredns replica
  nodesPerReplica: 16
```


As an example, to deploy a Cluster Proportional Autoscaler pod you will need to install the chart as follows:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/coredns \
    --set isClusterService=false \
    --set autoscaler.enabled=true \
    --set global.imagePullSecrets={application-collection}
```


We can then verify the Autoscaler is targeting the CoreDNS deployment and using the specified configuration:


```
$ kubectl logs deployment/<release-name>-coredns-autoscaler
I1029 14:46:28.920865       1 autoscaler.go:49] Scaling Namespace: default, Target: deployment/<release-name>
I1029 14:46:30.281505       1 linear_controller.go:61] Params from apiserver:
{
  "coresPerReplica": 256,
  "nodesPerReplica": 16,
  "preventSinglePointFailure": true,
  "min": 0,
  "max": 0,
  "includeUnschedulableNodes": false
}
```


## Operations

### Use CoreDNS as a cluster DNS service

As previously explained, the Helm chart is configured to work as a cluster DNS service out of the box. This mode is intended for clusters you build from scratch where no DNS provider exists yet. To use this mode, simply specify `kube-system` as the target namespace while keeping the default `isClusterService=true`:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/coredns \
    --namespace kube-system \
    --set global.imagePullSecrets={application-collection}
```


### Upgrade the chart

In general, an in-place upgrade of your CoreDNS installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/coredns
```


> Be aware that changes from version to version may include breaking changes in CoreDNS itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Refer to the official [release notes](https://coredns.io/tags/notes/) and always check the upstream [Helm chart’s Release page](https://github.com/coredns/helm/releases) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed CoreDNS instance is simple:


```
helm uninstall <release-name>
```


Last modified October 31, 2025


