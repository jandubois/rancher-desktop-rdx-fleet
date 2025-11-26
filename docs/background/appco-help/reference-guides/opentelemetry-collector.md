---
description: Learn how to install and use OpenTelemetry Collector
lang: en
robots: index, follow
title: OpenTelemetry Collector \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use OpenTelemetry Collector
twitter:title: OpenTelemetry Collector
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  OpenTelemetry Collector


# OpenTelemetry Collector


Learn how to install and use OpenTelemetry Collector


![OpenTelemetry Collector Logo](images/reference-guides/logo-opentelemetry-collector.png "OpenTelemetry Collector Logo")

## Get started

The [OpenTelemetry Collector](https://apps.rancher.io/applications/opentelemetry-collector) offers a vendor-agnostic implementation on how to receive, process and export telemetry data. In addition, it removes the need to run, operate and maintain multiple agents/collectors in order to support open-source telemetry data formats (Jaeger, Prometheus, etc.) to multiple open-source or commercial back-ends.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/opentelemetry-collector \
    --set global.imagePullSecrets={application-collection} \
    --set mode=deployment
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Container overview

Application Collection offers flavored container images for several of the [OpenTelemetry Collector distributions](https://opentelemetry.io/docs/collector/distributions/). These distributions can be differentiated by their container tags. For example, to choose the [OpenTelemetry Collector Kubernetes Distro](https://github.com/open-telemetry/opentelemetry-collector-releases/blob/main/distributions/otelcol-k8s/README.md), which is the default in the Helm chart package, the container version tag is suffixed by `*-k8s`. Find the latest OpenTelemetry Collector container artifacts in [Application Collection](https://apps.rancher.io/artifacts?name=%22opentelemetry-collector%22).

The [section below](index.html#override-the-opentelemetry-collector-distribution) explains how to override the default distribution in the OpenTelemetry Collector Helm chart.

## Chart overview

The OpenTelemetry Collector Helm chart distributed in Application Collection is based on the [OpenTelemetry Collector Helm chart](https://github.com/open-telemetry/opentelemetry-helm-charts/tree/main/charts/opentelemetry-collector) and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. Additionally to the upstream chart repository, you can check the [official OpenTelemetry Collector documentation](https://opentelemetry.io/docs/collector/).

By default, the chart will install the [OpenTelemetry Collector Kubernetes Distro](https://github.com/open-telemetry/opentelemetry-collector-releases/blob/main/distributions/otelcol-k8s/README.md), but other distributions are supported. The Helm chart requires the `mode` parameter to be set. The mode can be either `daemonset`, `deployment`, or `statefulset` depending on your installation use case.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/opentelemetry-collector
```


Refer to the OpenTelemetry Collector [examples](https://github.com/open-telemetry/opentelemetry-helm-charts/tree/main/charts/opentelemetry-collector/examples) to know more ways of configuring the Helm chart.

### Override the OpenTelemetry Collector distribution

The Helm chart parameters allow to override the default distribution [OpenTelemetry Collector Kubernetes Distro](https://github.com/open-telemetry/opentelemetry-collector-releases/blob/main/distributions/otelcol-k8s/README.md) used in the installation by setting another specific container image tag as explained in the [Container overview](index.html#container-overview) section:


```
image:
  # Replace the tag with the desired OpenTelemetry Collector version and distribution:
  #   * "0.127.0" (OpenTelemetry Collector Core Distro)
  #   * "0.127.0-k8s" (OpenTelemetry Collector Kubernetes Distro)
  tag: "0.127.0-k8s"
```


To use the [OpenTelemetry Collector Core Distro](https://github.com/open-telemetry/opentelemetry-collector-releases/blob/main/distributions/otelcol/README.md), you would install the Helm chart providing the following values file (`core_distro.yaml`):


```
image:
  tag: "0.127.0"
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/opentelemetry-collector \
    --set global.imagePullSecrets={application-collection} \
    --set mode=deployment \
    --values core_distro.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/opentelemetry-collector \
    --set global.imagePullSecrets={application-collection} \
    --set mode=deployment \
    --set image.tag=0.127.0
```


### Configuration presets

The OpenTelemetry Collector Helm chart offers several configuration presets that can be used to bootstrap the application configuration automatically and handle certain common predefined use cases. You can use these presets as a starting point and then move to manual configuration when you need to cover more complex scenarios.

To illustrate these configuration options, the example below shows how to activate the [Cluster Metrics](https://opentelemetry.io/docs/platforms/kubernetes/helm/collector/#cluster-metrics-preset) and [Kubernetes Events](https://opentelemetry.io/docs/platforms/kubernetes/helm/collector/#kubernetes-events-preset) presets via Helm chart parameters.


```
mode: deployment
replicaCount: 1

presets:
  # Configures the Kubernetes Cluster Receiver to collect cluster-level metrics.
  clusterMetrics:
    enabled: true
  # Configures the collector to collect Kubernetes events.
  kubernetesEvents:
    enabled: true

config:
  exporters:
    debug:
      verbosity: detailed
```


You would install the Helm chart providing the values file (`presets.yaml`):


```
helm install <release-name> oci://dp.apps.rancher.io/charts/opentelemetry-collector \
    --set global.imagePullSecrets={application-collection} \
    --values presets.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/opentelemetry-collector \
    --set global.imagePullSecrets={application-collection} \
    --set mode=deployment,replicaCount=1 \
    --set presets.clusterMetrics.enabled=true,presets.kubernetesEvents.enabled=true \
    --set config.exporters.debug.verbosity=detailed
```


When these presets are set, OpenTelemetry Collector can collect metrics and events from the cluster. The following commands are an example of this. They create a test Kubernetes event named `otel-col-test` and the logs show how OpenTelemetry Collector collects that event:


```
kubectl create -f - <<<'{"apiVersion": "v1", "kind": "Event", "metadata": {"name": "otel-col-test" }}'
kubectl logs deploy/<release-name> | grep event.name | grep otel-col-test
    -> event.name: Str(otel-col-test)
kubectl delete event otel-col-test
```


Refer to the official OpenTelemetry Collector documentation to know more about the [supported presets](https://opentelemetry.io/docs/platforms/kubernetes/helm/collector/#presets) and the suitability for different scenarios.

## Operations

### Upgrade the chart

In general, an in-place upgrade of your OpenTelemetry Collector installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/opentelemetry-collector
```


The pods will be upgraded by following the update strategy defined in the `values.yaml` file.

> Be aware that changes from version to version may include breaking changes in OpenTelemetry Collector itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Refer to the official [release notes](https://github.com/open-telemetry/opentelemetry-collector/releases) and always check the [UPGRADING.md](https://github.com/open-telemetry/opentelemetry-helm-charts/blob/main/charts/opentelemetry-collector/UPGRADING.md) notes before proceeding with an upgrade.

### Uninstall the chart

Removing an installed OpenTelemetry Collector Helm chart release is simple:


```
helm uninstall <release-name>
```


Last modified November 21, 2025


