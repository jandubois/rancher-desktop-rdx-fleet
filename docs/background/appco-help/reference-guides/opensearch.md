---
description: Learn how to install and use OpenSearch
lang: en
robots: index, follow
title: OpenSearch \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use OpenSearch
twitter:title: OpenSearch
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  OpenSearch


# OpenSearch


Learn how to install and use OpenSearch


![OpenSearch Logo](images/reference-guides/logo-opensearch.png "OpenSearch Logo")

## Get started

[OpenSearch](https://apps.rancher.io/applications/opensearch) is an open-source, enterprise-grade search and observability suite that brings order to unstructured data at scale..

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/opensearch \
    --set global.imagePullSecrets={application-collection}
    --set "extraEnvs[0].name=$OPENSEARCH_INITIAL_ADMIN_PASSWORD,extraEnvs[0].value=$OPENSEARCH_INITIAL_ADMIN_PASSWORD"
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The OpenSearch Helm chart distributed in Application Collection is based on the official [OpenSearch](https://github.com/opensearch-project/helm-charts/tree/main/charts/opensearch) Helm chart and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. In addition to the upstream chart repository, you can check the [official OpenSearch documentation](https://docs.opensearch.org/latest).

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/opensearch
```


Refer to the OpenSearch [Helm chart documentation](https://docs.opensearch.org/latest/install-and-configure/configuring-opensearch/index/) to learn more about configuring the Helm chart.

### Security configuration

A security demo configuration is enabled by default and includes the setup of security-related components, such as internal users, roles, role mappings, audit configuration, basic authentication, tenants, and allow lists. See the OpenSearch security configuration [documentation](https://docs.opensearch.org/latest/security/configuration/index/) to learn how to create a custom security configuration.

The demo configuration can be disabled by setting the `DISABLE_INSTALL_DEMO_CONFIG` environment variable in `values.yaml` as follows:


```
extraEnvs:
  - name: DISABLE_INSTALL_DEMO_CONFIG
    value: "true"
```


Security plug-in requires a strong custom password. Without this password, the cluster will not start, unless security settings are managed manually by the user.

A custom admin password can be set by adding the OPENSEARCH_INITIAL_ADMIN_PASSWORD environment variable in `values.yaml` as follows:


```
extraEnvs:
  - name: OPENSEARCH_INITIAL_ADMIN_PASSWORD
    value: <strong-password>
```


Security plug-in can be disabled in the `values.yml` as follows:


```
config:
  opensearch.yml: |
    plugins.security.disabled: true
```


When security is disabled, OpenSearch runs without authentication, role-based access control, or TLS. All APIs are open, and the admin password is ignored, so the cluster is fully exposed.

### Data persistence

OpenSearch requires data persistence for any production deployment. Persistence is enabled by default in the `values.yml` as follows:


```
persistence:
  enabled: true
  size: "8Gi" # size of the Persistent Volume
```


With persistence enabled, the chart provisions a PersistentVolume that stores all data from the `/usr/share/opensearch/data` directory. This ensures that if an OpenSearch pod restarts or is rescheduled to another node, your data remains safe and is automatically reattached.

If persistence is explicitly disabled by setting `persistence.enabled: false`, OpenSearch uses a temporary, ephemeral directory. In this configuration, all data will be permanently lost whenever the pod is restarted.

### Monitoring and observability

OpenSearch exposes metrics in Prometheus format through the [Prometheus Exporter](https://github.com/opensearch-project/opensearch-prometheus-exporter) Plug-in. To enable observability, the Prometheus Exporter Plug-in can be installed or activated in the `values.yml` as follows:


```
serviceMonitor:
  # Set to true to enable the ServiceMonitor resource
  enabled: true
plugins:
  enabled: true
  installList:
    - https://github.com/opensearch-project/opensearch-prometheus-exporter/releases/download/${OPENSEARCH_VERSION}/prometheus-exporter-${OPENSEARCH_VERSION}.zip
```


Once enabled, OpenSearch nodes publish performance and health metrics at the HTTP endpoint `/_prometheus/metrics`, which Prometheus can scrape. You can then visualize and build dashboards in Grafana to monitor cluster performance, query latency, JVM usage, and more.

## Operations

### Upgrade the chart

In general, an in-place upgrade of your OpenSearch installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/opensearch
```


The pods will be upgraded by following the update strategy defined in the `values.yaml` file which defaults to `RollingUpdate`:


```
updateStrategy: RollingUpdate
```


> Be aware that changes from version to version may include breaking changes in OpenSearch itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Refer to the official [release notes](https://github.com/opensearch-project/OpenSearch/releases) before proceeding with an upgrade and [breaking changes notes](https://docs.opensearch.org/latest/breaking-changes/).

### Uninstall the chart

Removing an installed OpenSearch Helm chart release is simple:


```
helm uninstall <release-name>
```


The OpenSearch nodes are deployed as [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) and therefore using [Volume Claim Templates](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates) to store the indices. These PVCs are not directly controlled by Helm and they are not removed when uninstalling the related chart.

When you are ready to remove the PVCs and your indices, you will need to explicitly delete them:


```
kubectl delete pvc --selector app.kubernetes.io/instance=<release-name>
```


Last modified September 9, 2025


