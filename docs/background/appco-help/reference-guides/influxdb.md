---
description: Learn how to install and use InfluxDB
lang: en
robots: index, follow
title: InfluxDB \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use InfluxDB
twitter:title: InfluxDB
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  InfluxDB


# InfluxDB


Learn how to install and use InfluxDB


![InfluxDB Logo](images/reference-guides/logo-influxdb.png "InfluxDB Logo")

## Get started

[InfluxDB](https://apps.rancher.io/applications/influxdb) is an open source time series platform. This includes APIs for storing and querying data, processing it in the background for ETL or monitoring and alerting purposes, user dashboards, and visualizing and exploring the data and more.

Before exploring the chart’s characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/influxdb \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The InfluxDB Helm chart distributed in Application Collection is based on the official [InfluxDB](https://github.com/influxdata/helm-charts/tree/master/charts/influxdb2) Helm chart and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. In addition to the upstream chart repository, you can check the [official InfluxDB documentation](https://docs.influxdata.com/influxdb).

> Our Helm chart is currently only provided for branch `2.x.y`. We’ll update to using branch `3.x.y` when upstream does.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/influxdb
```


### Fixed credentials

The Helm chart provides two methods for configuring fixed authentication credentials for the initial admin user. While you can set a password and token directly in the chart’s parameters, the recommended approach is to use an existing Kubernetes Secret.

To use an existing secret, ensure it is created with the keys `admin-password` and `admin-token`. Both should be base64 encoded.


```
apiVersion: v1
kind: Secret
metadata:
  name: influxdb-auth
type: Opaque
data:
  admin-password: cGFzc3dvcmQ=
  admin-token: dG9rZW4=
```


To install the chart while importing the existing secret, run the following installation command:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/influxdb \
    --set global.imagePullSecrets={application-collection} \
    --set adminUser.existingSecret=influxdb-auth
```


Alternatively, you can set these credentials directly within your configuration by setting the `adminUser.password` and `adminUser.token` values.


```
helm install <release-name> oci://dp.apps.rancher.io/charts/influxdb \
    --set global.imagePullSecrets={application-collection} \
    --set adminUser.password=password \
    --set adminUser.token=token
```


If you do not specify an existing secret or set these parameters, an `admin-password` and `admin-token` will be automatically generated upon installation. These auto-generated credentials will remain consistent even after a helm upgrade is performed.

### Data persistence

InfluxDB requires data persistence for any production use case. This is enabled by default in the Helm chart via the `persistence.enabled: true` setting. With persistence active, the chart provisions a PersistentVolume that stores all data from the `/var/lib/influxdb2` directory. This ensures that if the InfluxDB pod restarts or moves to another node, your data is safely reattached and preserved.

If persistence is explicitly disabled by setting `persistence.enabled: false`, InfluxDB uses a temporary, ephemeral directory. In this configuration, all data will be permanently lost whenever the pod is restarted.

### Custom environment variables

You can inject custom environment variables into the InfluxDB container by defining them under the `env` parameter in your `values.yaml` file. This follows the standard Kubernetes container environment variable syntax, allowing you to set static values or reference values from secrets and configmaps.

For example, to change the log level to debug and provide an admin token from a Kubernetes secret, you would add the following to a custom values file:


```
env:
  - name: INFLUXD_LOG_LEVEL
    value: debug
  - name: INFLUXDB_INIT_BUCKET
    value: my-custom-bucket
```


To install the chart while using the custom values file, run the following installation command:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/influxdb \
    --set global.imagePullSecrets={application-collection} \
    -f custom-values.yaml
```


The InfluxDB container image supports other environment variables to customize runtime behavior and initial setup. For a complete list of all available options, please refer to the official upstream container image [documentation](https://github.com/docker-library/docs/blob/master/influxdb/README.md).

## Operations

### Upgrade the chart

In general, an in-place upgrade of your InfluxDB installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/influxdb
```


> Be aware that changes from version to version may include breaking changes in InfluxDB itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps. Refer to the official [release notes](https://github.com/influxdata/influxdb/releases) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed InfluxDB Helm chart release is simple:


```
helm uninstall <release-name>
```


After uninstalling, you must also manually remove the Persistent Volume Claim (PVC) created during the installation to release the storage:


```
kubectl delete pvc <release-name>
```


Last modified July 22, 2025


