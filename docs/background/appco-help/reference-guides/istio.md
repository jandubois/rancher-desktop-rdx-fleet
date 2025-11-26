---
description: Learn how to install and use Istio
lang: en
robots: index, follow
title: Istio \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Istio
twitter:title: Istio
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Istio


# Istio


Learn how to install and use Istio


![Istio Logo](images/reference-guides/logo-istio.png "Istio Logo")

## Get started

[Istio](https://apps.rancher.io/applications/istio) is an open source service mesh that layers transparently onto existing distributed applications. Istio’s powerful features provide a uniform and more efficient way to secure, connect and monitor services. Istio is the path to load balancing, service-to-service authentication and monitoring – with few or no service code changes.

Before getting into the chart’s possibilities, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/istio -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Wrapper chart overview

The Istio Helm chart offers a one-click installation solution, which installs the five official Istio charts as modified subcharts.

### Istio subcharts

To achieve a one-command deployment without the use of external tools, we decided to use an original wrapper chart containing the following subcharts:

- The **base** subchart, containing Istio CRDs, serviceAccounts and roles configurations. Default: **enabled**.
- The **cni** subchart, which installs the CNI plug-in. Optionally used in sidecar mode. Default: **disabled**.
- The **gateway** subchart, in case you prefer using the Istio gateway. Default: **disabled**.
- The **istiod** subchart. Deploys the `istiod` service. Default: **enabled**.
- The **ztunnel** subchart, only used in ambient mode. Default: **disabled**.

By default, our chart only installs the minimum components for the Istio’s [sidecar mode](index.html#sidecar-mode) to work; the `base` and `istiod` subcharts.

As in any standard Helm chart, each subchart can be enabled by setting `--set <subchartName>.enabled=true` with any of their sub-parameters modified by using `--set <subchartName>.<parameterKey>=<parameterValue>`. The bundled `README` contains ordered lists of every configurable parameter.

Keep in mind that every subchart (even the `base` one) can be disabled or enabled as needed. This can be useful in some scenarios where you may want to only install a single subchart.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/istio
```


### Configuration profiles

The Istio Helm chart has the concept of a `profile`, which is a bundled collection of value presets. These can be set with `--set <subchart>.profile=<profile>`. For example, the `demo` profile offers a preset configuration to try out Istio in a test environment, with additional features enabled and lowered resource requirements.

For consistency, the same profiles are used across each subchart, even if they do not impact a given chart.

Explicitly set values have the highest priority, then profile settings, then chart defaults.

As an implementation detail of profiles, the default values for the chart are all nested under `defaults`. When configuring the chart, you should not include this. That is, `--set <subchart>.some.field=true` should be passed, not `--set <subchart>.defaults.some.field=true`.


```
helm install <release-name> oci://dp.apps.rancher.io/charts/istio -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --set base.profile=demo,istiod.profile=demo
```


> By default, Istio uses the `istio-system` namespace.

### Sidecar vs. Ambient mode

Istio supports two main data plane modes:

- **Sidecar** mode, which deploys an Envoy proxy along with each pod that you start in your cluster.
- **Ambient** mode, which uses a per-node Layer 4 proxy, and optionally a per-namespace Envoy proxy for Layer 7 features.

#### Sidecar mode

The Sidecar configuration provides a way to fine tune the set of ports and protocols that the proxy will accept when forwarding traffic to and from the workload.


```
helm install <release-name> oci://dp.apps.rancher.io/charts/istio -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection}
```


Once installed, you’ll need to enable the sidecar auto-injection per namespace as follows:


```
kubectl label namespace default istio-injection=enabled
```


After labeling a namespace, every deployed pod will include an Istio proxy sidecar:


```
kubectl run nginx --image dp.apps.rancher.io/containers/nginx:1.26.0 \
    --overrides='{"spec": {"imagePullSecrets":[{"name": "application-collection"}]}}'
```


```
$ kubectl get pods
NAME    READY   STATUS    RESTARTS   AGE
nginx   2/2     Running   0          4s
```


#### Ambient mode

The ambient mode will use every subchart packaged in our Istio chart. Additionally, it will require some modifications already included in the `ambient` profile.


```
helm install <release-name> oci://dp.apps.rancher.io/charts/istio -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --set cni.enabled=true,ztunnel.enabled=true \
    --set istiod.cni.enabled=true \
    --set cni.profile=ambient,istiod.profile=ambient,ztunnel.profile=ambient
```


## Operations

### Use the Istio gateway

#### Install the gateway as a stand-alone

There are scenarios where you may want to only install the Istio Gateway. Given the gateway is seen as a subchart on our Istio chart, we can just install the needed subchart disabling the default ones:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/istio -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --set base.enabled=false,istiod.enabled=false \
    --set gateway.enabled=true
```


#### Install the gateway in a different namespace

By default, the Istio gateway will be installed in the chart’s namespace. This can be modified by overriding the `gateway` subchart’s namespace:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/istio -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --set gateway.enabled=true,gateway.namespaceOverride=default
```


### Upgrade the chart

There are two ways to upgrade your current Istio Helm chart:

- Canary upgrade
- In-place upgrade

#### Canary upgrade

Having an already installed Istio chart:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/istio -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection}
```


You can install a canary version of the Istio control plane to validate that the new version is compatible with your existing configuration and data plane running the following commands:


```
helm install <release-name>-canary oci://dp.apps.rancher.io/charts/istio -n istio-system \
    --set global.imagePullSecrets={application-collection} \
    --set istiod.revision=canary,base.defaultRevision=canary
```


After the canary chart is installed, you will need to migrate the existing workloads to use the canary control plane as explained in the [official documentation](https://istio.io/latest/docs/setup/upgrade/canary/#data-plane).

Once you have verified and migrated your workloads to use the canary control plane, you can uninstall your old control plane:


```
helm uninstall <release-name> -n istio-system
```


#### In-place upgrade

You can perform an in-place upgrade of Istio in your cluster using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/istio -n istio-system \
    --set global.imagePullSecrets={application-collection}
```


> This method is only viable when the installed Istio version is no more than one minor version less than the upgrade version.

### Uninstall the chart

Uninstalling the Istio Helm chart deletes the RBAC permissions and all resources hierarchically under the `istio-system` namespace. It is safe to ignore errors for non-existent resources because they may have been deleted hierarchically.


```
helm uninstall <release-name> -n istio-system
```


The `istio-system` namespace is not removed by default. If no longer needed, use the following command to delete it:


```
kubectl delete namespace istio-system
```


Our Istio chart uses hooks to achieve a one-click install. These hooks may need to be removed if you installed the chart in sidecar mode:


```
kubectl delete mutatingwebhookconfiguration istio-sidecar-injector
kubectl delete configmaps -n istio-system istio-sidecar-injector
```


The label to instruct Istio to automatically inject Envoy sidecar proxies is not removed by default. If no longer needed, use the following command to unlabel the namespaces that apply:


```
kubectl label namespace default istio-injection-
```


Due to Helm’s [design](https://helm.sh/docs/chart_best_practices/custom_resource_definitions/#some-caveats-and-explanations), CustomResourceDefinitions (CRDs) are not removed when uninstalling the related chart. To do so, you will need to explicitly remove them:


```
kubectl delete $(kubectl get CustomResourceDefinition -l='app.kubernetes.io/part-of=istio' -o name -A)
```


Last modified September 9, 2025


