---
description: Learn how to install and use Velero
lang: en
robots: index, follow
title: Velero \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Velero
twitter:title: Velero
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Velero


# Velero


Learn how to install and use Velero


![Velero Logo](images/reference-guides/logo-velero.png "Velero Logo")

## Get started

[Velero](https://apps.rancher.io/applications/velero) is an open source tool to safely backup and restore, perform disaster recovery, and migrate Kubernetes cluster resources and persistent volumes.

## Chart overview

Our Velero chart is based on the official [Velero](https://github.com/vmware-tanzu/helm-charts/tree/main/charts/velero) chart and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. You can check the [official documentation](https://github.com/vmware-tanzu/helm-charts/blob/main/charts/velero/README.md).

## Velero initialization and key concepts

Velero’s initialization using a Helm chart involves configuring several key aspects of its operation. This section provides an overview of the core concepts involved. For specific Helm chart parameters, please refer to the [Chart configuration](index.html#chart-configuration) section.

Velero relies on Custom Resource Definitions (CRDs) to manage its resources. Two important CRDs are:

- **`BackupStorageLocation`:** This CRD configures where Velero backups are stored. Velero requires at least one `BackupStorageLocation` if backups are enabled. A default location named ‘default’ might be created depending on the chart configuration. Multiple `BackupStorageLocation` resources can be defined to support different storage providers or locations.

- **`VolumeSnapshotLocation`:** This CRD defines where volume snapshots are stored. Velero supports snapshots from multiple providers, and you can configure multiple `VolumeSnapshotLocation` resources per provider. However, only one can be selected per provider during a backup operation. Velero requires at least one `VolumeSnapshotLocation` per cloud provider if snapshots are enabled. Each `VolumeSnapshotLocation` specifies a provider and a location.

## Chart configuration

Velero’s Helm chart utilizes several parameters to configure its behavior and the creation of essential CRDs. Here are some key parameters:

- **`backupsEnabled`**: A boolean value that determines whether the chart should create a default `BackupStorageLocation` CRD. If set to `false`, you will need to create your `BackupStorageLocation` manually. Defaults to `true`.

- **`snapshotsEnabled`**: A boolean value that determines whether the chart should create a default `VolumeSnapshotLocation` CRD (if a provider is configured). If set to `false`, the snapshot feature will be disabled, and you will need to create `VolumeSnapshotLocation` resources manually if you wish to use volume snapshots. Defaults to `true`.

- **`initContainer`**: Specifies the plug-in image, tag, and name. This is crucial for enabling Velero to interact with various cloud providers by including the necessary provider-specific plug-ins.

- **`credentials`**: Provides the necessary IAM account credentials (AWS access keys, Azure service principal details, GCP service account keys…) that Velero needs to access your cloud provider’s services for backups and snapshots.

- **`backupStorageLocation`**: While also a CRD, this Helm chart parameter allows you to configure the initial `BackupStorageLocation` during the chart installation. This is typically used in conjunction with `backupsEnabled: true`.

- **`volumeSnapshotLocation`**: Similar to `backupStorageLocation`, this Helm chart parameter lets you configure the initial `VolumeSnapshotLocation` during the chart installation. This is typically used in conjunction with `snapshotsEnabled: true`.

- The Velero server can be started with the `--default-backup-storage-location` flag to set a default `BackupStorageLocation` if none is explicitly specified during backup creation.

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/velero
```


## Operations

### Install the chart

First, let’s install a “stand-alone” instance of MinIO to mimic the AWS Cloud Provider.


```
helm install minio oci://dp.apps.rancher.io/charts/minio \
    --set global.imagePullSecrets={application-collection} \
    --set mode=standalone \
    --set persistence.size=5Gi,resources.requests.memory=512Mi \
    --set rootUser=admin,rootPassword=admin123 \
    --set 'buckets[0].name=velero','buckets[0].policy=none','buckets[0].purge=false' \
    --wait
```


Then, let’s create a file containing all the required configurations to deploy Velero.


```
cat <<EOF > velero-config.yaml
configuration:
  backupStorageLocation:
    - name: default
      provider: aws
      bucket: velero
      config:
        region: minio
        s3ForcePathStyle: "true"
        s3Url: http://minio.default.svc:9000
  volumeSnapshotLocation:
    - name: default
      provider: aws
      config:
        region: minio
initContainers:
  - name: velero-plugin-for-aws
    image: dp.apps.rancher.io/containers/velero-plugin-for-aws:1.11.1
    volumeMounts:
      - mountPath: /target
        name: plugins
credentials:
  useSecret: true
  existingSecret: ""
  secretContents:
    cloud: |
      [default]
      aws_access_key_id=admin
      aws_secret_access_key=admin123
EOF
```


Let’s install the chart using the file we have just created.


```
helm install <release-name> oci://dp.apps.rancher.io/charts/velero \
    --namespace velero \
    --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --values velero-config.yaml \
    --wait
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

### Upgrade the chart

In general, an in-place upgrade of your Velero installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/velero
```


The pods will be upgraded by following the update strategy defined in the `values.yaml` file.

> Be aware that changes from version to version may include breaking changes in Velero itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Refer to the official documentation [Upgrading Chart](https://github.com/vmware-tanzu/helm-charts/tree/main/charts/velero#upgrading-chart) and always check the [release notes](https://github.com/vmware-tanzu/velero/releases) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed Velero instance is simple:


```
helm uninstall <release-name> \
    --namespace velero
```


The `velero` namespace is not removed by default. If no longer needed, use the following command to delete it:


```
kubectl delete namespace velero
```


> Remember to uninstall any MinIO dependency you deployed during this guide.


Last modified July 17, 2025


